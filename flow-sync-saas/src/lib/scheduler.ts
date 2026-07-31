import {
  Machine,
  Order,
  OrderProcess,
  ScheduleSlot,
  ScheduleResult,
  OptimizationMode,
  SetupMatrixRule,
  SHIFT_1_START,
  SHIFT_1_END,
  SHIFT_2_START,
  SHIFT_2_END,
  WORKING_HOURS_PER_DAY,
} from "./types";

export function getSequenceSetupTime(
  fromMaterial: string | null,
  toMaterial: string,
  machineGroupId: string,
  baseSetupMin: number,
  rules: SetupMatrixRule[] = []
): number {
  if (!fromMaterial || rules.length === 0) return baseSetupMin;

  const rule = rules.find((r) => {
    const matchGroup = !r.machineGroupId || r.machineGroupId === machineGroupId;
    const matchFrom = r.fromMaterial === "*" || r.fromMaterial.toLowerCase() === fromMaterial.toLowerCase();
    const matchTo = r.toMaterial === "*" || r.toMaterial.toLowerCase() === toMaterial.toLowerCase();
    return matchGroup && matchFrom && matchTo;
  });

  return rule ? rule.setupTimeMin : baseSetupMin;
}

export function parseSOPDate(dateStr: string, timeStr: string): Date {
  const dateClean = (dateStr || "").trim();
  const timeClean = (timeStr || "").trim() || "00:00:00";

  if (!dateClean) {
    return new Date("2026-06-01T00:00:00");
  }

  // Format 1: "01-06-2026" (dd-MM-yyyy)
  if (dateClean.includes("-")) {
    const parts = dateClean.split("-");
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const timeParts = timeClean.split(":");
      const hours = parseInt(timeParts[0] || "0", 10);
      const minutes = parseInt(timeParts[1] || "0", 10);
      const seconds = parseInt(timeParts[2] || "0", 10);
      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Format 2: "01 July 2026" or "1 July 2026" (d MMMM yyyy)
  const months = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december"
  ];

  const words = dateClean.toLowerCase().split(/\s+/);
  if (words.length === 3) {
    const day = parseInt(words[0], 10);
    const monthName = words[1];
    const year = parseInt(words[2], 10);
    const month = months.indexOf(monthName);

    if (month !== -1) {
      const timeParts = timeClean.split(":");
      const hours = parseInt(timeParts[0] || "0", 10);
      const minutes = parseInt(timeParts[1] || "0", 10);
      const seconds = parseInt(timeParts[2] || "0", 10);
      const d = new Date(year, month, day, hours, minutes, seconds);
      if (!isNaN(d.getTime())) return d;
    }
  }

  // Fallback
  const fallback = new Date(`${dateClean} ${timeClean}`);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }
  return new Date("2026-06-01T00:00:00");
}

function formatDate(d: Date): string {
  if (isNaN(d.getTime())) {
    return "2026-06-01";
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function alignToWorkingHours(d: Date) {
  if (isNaN(d.getTime())) return;
  const h = d.getHours();
  if (h < SHIFT_1_START) {
    d.setHours(SHIFT_1_START, 0, 0, 0);
  } else if (h >= SHIFT_2_END) {
    d.setDate(d.getDate() + 1);
    d.setHours(SHIFT_1_START, 0, 0, 0);
  }
}

export function generateSchedule(
  orders: Order[],
  processes: OrderProcess[],
  machines: Machine[],
  optimizeMode: OptimizationMode = "full",
  groupSerialization = false,
  allowProcessOverlap = false,
  allowSopOverride = false,
  maxUtilizeResources = false,
  dailyCapacities: Record<string, { setter: number; process: number; isHoliday?: boolean }> = {},
  globalSetterCapacity = 100,
  globalOperatorCapacity = 200,
  maxPreponeWeeks = 0,
  setupMatrixRules: SetupMatrixRule[] = []
): ScheduleResult {
  const warnings: string[] = [];
  const slots: ScheduleSlot[] = [];

  const machineToGroupMap = new Map<string, string>();
  machines.forEach((m) => machineToGroupMap.set(m.id, m.machineGroupId));

  // Find the absolute minimum SOP start date across all orders to use as the baseline horizon start when overriding SOP dates
  let horizonStart = new Date();
  if (orders.length > 0) {
    let minTime = Infinity;
    orders.forEach((o) => {
      try {
        const d = parseSOPDate(o.sopStartDate, o.sopStartTime);
        if (d.getTime() < minTime) {
          minTime = d.getTime();
        }
      } catch (_) {}
    });
    if (minTime !== Infinity) {
      horizonStart = new Date(minTime);
    }
  }

  // Map to track allocated setup operator minutes: `${dateStr}_${hour}` -> setupMinutes (Global Pool: 1 FTE)
  const globalHourSetupMinutes = new Map<string, number>();

  // Map to track allocated machining operator minutes: `${dateStr}_${hour}` -> machiningOperatorMinutes (Global Pool: 1 FTE)
  const globalHourMachiningOperatorMinutes = new Map<string, number>();

  // Sort orders/processes to schedule in priority
  // 1. Parent SOP Start Date/Time ASC
  // 2. processId (step number) ASC
  const orderMap = new Map<string, Order>();
  orders.forEach((o) => orderMap.set(o.id, o));

  const sortedProcesses = [...processes].map((p) => {
    const order = orderMap.get(p.orderId);
    let startVal = 0;
    if (order) {
      const parsedSop = parseSOPDate(order.sopStartDate, order.sopStartTime);
      startVal = parsedSop.getTime();
    }
    return { p, startVal };
  });

  sortedProcesses.sort((a, b) => {
    if (a.startVal !== b.startVal) {
      return a.startVal - b.startVal;
    }
    return a.p.processId - b.p.processId;
  });

  // Track machine hours occupants: `${machineId}_${date}_${hour}` -> processIds[]
  const machineHourOccupants = new Map<string, string[]>();
  // Track group hours occupants: `${groupId}_${date}_${hour}` -> processIds[]
  const groupHourOccupants = new Map<string, string[]>();

  const registerMachineHour = (mId: string, dStr: string, hr: number, pId: string) => {
    const key = `${mId}_${dStr}_${hr}`;
    if (!machineHourOccupants.has(key)) {
      machineHourOccupants.set(key, []);
    }
    const list = machineHourOccupants.get(key)!;
    if (!list.includes(pId)) {
      list.push(pId);
    }

    const mGroupId = machineToGroupMap.get(mId) || "";
    if (mGroupId) {
      const gKey = `${mGroupId}_${dStr}_${hr}`;
      if (!groupHourOccupants.has(gKey)) {
        groupHourOccupants.set(gKey, []);
      }
      const gList = groupHourOccupants.get(gKey)!;
      if (!gList.includes(pId)) {
        gList.push(pId);
      }
    }
  };

  // Track order end times: `${orderId}` -> Date
  const orderEndTimes = new Map<string, Date>();

  // Helper to schedule a single process at a determined start date
  const allocateSlotsForProcess = (proc: OrderProcess, startDate: Date) => {
    const startIso = new Date(startDate.getTime());
    let currentPointer = new Date(startDate.getTime());
    let remainingMin = proc.totalTimeMin;
    let remainingSetupMin = proc.setupTimeMin;

    const mGroupId = machineToGroupMap.get(proc.machineId) || "";

    while (remainingMin > 0) {
      if (isNaN(currentPointer.getTime())) {
        break;
      }
      alignToWorkingHours(currentPointer);
      const dateStr = formatDate(currentPointer);
      const hour = currentPointer.getHours();
      const shift = hour < SHIFT_1_END ? 1 : 2;

      const minutesInSlot = Math.min(60, remainingMin);
      
      // Consume Setup first, then Machining
      if (remainingSetupMin > 0) {
        const setupInSlot = Math.min(minutesInSlot, remainingSetupMin);
        slots.push({
          id: `${proc.id}-slot-R-${dateStr}-${hour}`,
          processId: proc.id,
          machineId: proc.machineId,
          date: dateStr,
          hourStart: hour,
          hourEnd: hour + 1,
          shift,
          slotType: "R",
          minutesUsed: setupInSlot,
          manpowerPct: 1.0, // Setup R is always 100% dedicated operator
          overloaded: false,
          collision: false,
        });

        // Add to global setup operator minutes tracker
        const globalKey = `${dateStr}_${hour}`;
        globalHourSetupMinutes.set(
          globalKey,
          (globalHourSetupMinutes.get(globalKey) || 0) + setupInSlot * 1.0
        );

        remainingSetupMin -= setupInSlot;

        // If remainder in this slot is machining
        if (setupInSlot < minutesInSlot) {
          const machMins = minutesInSlot - setupInSlot;
          slots.push({
            id: `${proc.id}-slot-M-${dateStr}-${hour}`,
            processId: proc.id,
            machineId: proc.machineId,
            date: dateStr,
            hourStart: hour,
            hourEnd: hour + 1,
            shift,
            slotType: "M",
            minutesUsed: machMins,
            manpowerPct: proc.manpowerPct, // Machining M is process's manpowerPct
            overloaded: false,
            collision: false,
          });

          const globalOperatorKey = `${dateStr}_${hour}`;
          globalHourMachiningOperatorMinutes.set(
            globalOperatorKey,
            (globalHourMachiningOperatorMinutes.get(globalOperatorKey) || 0) + machMins * proc.manpowerPct
          );
        }
      } else {
        slots.push({
          id: `${proc.id}-slot-M-${dateStr}-${hour}`,
          processId: proc.id,
          machineId: proc.machineId,
          date: dateStr,
          hourStart: hour,
          hourEnd: hour + 1,
          shift,
          slotType: "M",
          minutesUsed: minutesInSlot,
          manpowerPct: proc.manpowerPct, // Machining M is process's manpowerPct
          overloaded: false,
          collision: false,
        });

        const globalOperatorKey = `${dateStr}_${hour}`;
        globalHourMachiningOperatorMinutes.set(
          globalOperatorKey,
          (globalHourMachiningOperatorMinutes.get(globalOperatorKey) || 0) + minutesInSlot * proc.manpowerPct
        );
      }

      // Mark machine hour as busy and register occupant (both R and M block the machine)
      registerMachineHour(proc.machineId, dateStr, hour, proc.id);

      remainingMin -= minutesInSlot;
      currentPointer.setHours(currentPointer.getHours() + 1);
    }

    const endIso = new Date(currentPointer.getTime());
    
    // Write scheduled date ranges back to the process
    proc.scheduledStart = startIso.toISOString();
    proc.scheduledEnd = endIso.toISOString();
    proc.status = "SCHEDULED";

    // Update latest order completion tracker
    const parentOrder = orderMap.get(proc.orderId);
    if (parentOrder) {
      const currentEnd = orderEndTimes.get(parentOrder.orderId);
      if (!currentEnd || endIso > currentEnd) {
        orderEndTimes.set(parentOrder.orderId, endIso);
      }
    }
  };

  // Two-pass scheduling:
  // PASS 1: Allocate and register manual overrides first so they lock their hours
  const manualOverrides = sortedProcesses.filter(item => item.p.status === "SCHEDULED" && item.p.scheduledStart);
  for (const item of manualOverrides) {
    const proc = item.p;
    allocateSlotsForProcess(proc, new Date(proc.scheduledStart!));
  }

  // PASS 2: Dynamically schedule unscheduled processes around locked manual slots
  const dynamicItems = sortedProcesses.filter(item => !(item.p.status === "SCHEDULED" && item.p.scheduledStart));
  for (const item of dynamicItems) {
    const proc = item.p;
    const order = orderMap.get(proc.orderId);
    if (!order) continue;

    // Calculate parent order SOP start date & time
    const orderSopStart = parseSOPDate(order.sopStartDate, order.sopStartTime);

    // Sequence dependency: Step N waits for Step N-1 to fully complete (both R & M)
    let earliestStart = allowSopOverride ? new Date(horizonStart.getTime()) : new Date(orderSopStart.getTime());

    // Enforce maximum preponement limit
    if (allowSopOverride && maxPreponeWeeks > 0) {
      const maxPreponeMs = maxPreponeWeeks * 7 * 24 * 60 * 60 * 1000;
      const limitDate = new Date(orderSopStart.getTime() - maxPreponeMs);
      if (earliestStart < limitDate) {
        earliestStart = limitDate;
      }
    }

    const priorEnd = orderEndTimes.get(order.orderId);
    if (priorEnd && priorEnd > earliestStart) {
      earliestStart = new Date(priorEnd.getTime());
    }

    // Round start to next available working hour if there are fractional minutes
    if (
      earliestStart.getMinutes() > 0 ||
      earliestStart.getSeconds() > 0 ||
      earliestStart.getMilliseconds() > 0
    ) {
      earliestStart.setHours(earliestStart.getHours() + 1, 0, 0, 0);
    }
    alignToWorkingHours(earliestStart);

    // Find earliest starting hour on machine with zero overlap for total duration
    const totalTimeMin = proc.totalTimeMin;
    let scheduledStartPointer = new Date(earliestStart.getTime());

    // Helper to find the earliest valid start date/time on a given machine ID
    const findEarliestStartForMachine = (mId: string) => {
      let tempStart = new Date(earliestStart.getTime());
      let searchIterations = 0;
      const targetMGroupId = machineToGroupMap.get(mId) || "";

      while (true) {
        searchIterations++;
        if (searchIterations > 1000) {
          // Safety cutoff to prevent browser hanging, but keep the current tempStart
          // so we don't fall back and overlap at the beginning of the schedule!
          break;
        }

        if (isNaN(tempStart.getTime())) {
          break;
        }

        alignToWorkingHours(tempStart);
        let testPointer = new Date(tempStart.getTime());
        let remainingMin = totalTimeMin;
        let remainingSetupMin = proc.setupTimeMin;
        let conflict = false;

        while (remainingMin > 0) {
          alignToWorkingHours(testPointer);
          const dateStr = formatDate(testPointer);
          const hour = testPointer.getHours();
          const key = `${mId}_${dateStr}_${hour}`;

          // 0. Holiday constraint check: no work can be scheduled on a holiday
          if (dailyCapacities?.[dateStr]?.isHoliday) {
            conflict = true;
            break;
          }

          // 1. Workstation occupancy constraint check (for both 'workstation' and 'full')
          if (machineHourOccupants.has(key) && machineHourOccupants.get(key)!.length > 0) {
            conflict = true;
            break;
          }

          // 1b. Group occupancy constraint check (if groupSerialization or full optimizeMode is enabled, unless process overlap is allowed)
          if (((groupSerialization || optimizeMode === "full") && !allowProcessOverlap) && targetMGroupId) {
            const gKey = `${targetMGroupId}_${dateStr}_${hour}`;
            if (groupHourOccupants.has(gKey) && groupHourOccupants.get(gKey)!.length > 0) {
              conflict = true;
              break;
            }
          }

          // 1c. Sequenced setups check: if allowProcessOverlap is enabled, setups (R) in the same group must not overlap
          if (allowProcessOverlap && targetMGroupId && remainingSetupMin > 0) {
            const groupSetupConflict = slots.some((s) => {
              if (s.slotType !== "R") return false;
              if (s.date !== dateStr || s.hourStart !== hour) return false;
              const otherGroup = machineToGroupMap.get(s.machineId);
              return otherGroup === targetMGroupId;
            });
            if (groupSetupConflict) {
              conflict = true;
              break;
            }
          }

          // 2. Operator capacity constraint check (only for 'full')
          if (optimizeMode === "full") {
            const minutesUsedInSlot = Math.min(60, remainingMin);
            const setupUsedInSlot = Math.min(minutesUsedInSlot, remainingSetupMin);
            const machiningUsedInSlot = minutesUsedInSlot - setupUsedInSlot;

            const dayCap = dailyCapacities?.[dateStr] || { setter: globalSetterCapacity, process: globalOperatorCapacity };
            const setterCapMin = (dayCap.setter / 100) * 60;
            const processCapMin = (dayCap.process / 100) * 60;

            // Setup capacity check (Global pool: max setterCapMin minutes of setups running globally)
            if (setupUsedInSlot > 0) {
              const globalKey = `${dateStr}_${hour}`;
              const existingSetup = globalHourSetupMinutes.get(globalKey) || 0;
              if (existingSetup + setupUsedInSlot > setterCapMin + 0.01) {
                conflict = true;
                break;
              }
            }

            // Machining capacity check (Global pool: max processCapMin minutes of machining operator minutes globally)
            if (machiningUsedInSlot > 0) {
              const proposedOperatorMinutes = machiningUsedInSlot * proc.manpowerPct;
              const cappedProposed = Math.min(60, proposedOperatorMinutes);

              const globalOperatorKey = `${dateStr}_${hour}`;
              const existingMachining = globalHourMachiningOperatorMinutes.get(globalOperatorKey) || 0;

              if (existingMachining + cappedProposed > processCapMin + 0.01) {
                conflict = true;
                break;
              }
            }

            remainingSetupMin = Math.max(0, remainingSetupMin - setupUsedInSlot);
          }

          remainingMin -= 60;
          testPointer.setHours(testPointer.getHours() + 1);
        }

        if (!conflict) {
          break; // found clean window satisfying all active constraints!
        }

        // If conflict, try next hour slot
        tempStart.setHours(tempStart.getHours() + 1);
      }

      return tempStart;
    };

    if (optimizeMode !== "pre") {
      const mGroupId = machineToGroupMap.get(proc.machineId) || "";

      if (optimizeMode === "full" && maxUtilizeResources && mGroupId) {
        // Find all machines in the same machine group
        const groupMachines = machines.filter((m) => m.machineGroupId === mGroupId);
        
        let bestMachineId = proc.machineId;
        let earliestMachineStart = new Date(findEarliestStartForMachine(proc.machineId).getTime());

        for (const candMachine of groupMachines) {
          if (candMachine.id === proc.machineId) continue;
          
          const candStart = findEarliestStartForMachine(candMachine.id);
          if (candStart.getTime() < earliestMachineStart.getTime()) {
            earliestMachineStart = candStart;
            bestMachineId = candMachine.id;
          }
        }

        proc.machineId = bestMachineId;
        scheduledStartPointer = earliestMachineStart;
      } else {
        // If Max Utilize is false, keep original machine assignment
        scheduledStartPointer = findEarliestStartForMachine(proc.machineId);
      }
    } else {
      alignToWorkingHours(scheduledStartPointer);
    }

    allocateSlotsForProcess(proc, scheduledStartPointer);
  }

  // 5. Evaluate manpower stacking warnings & flag overloaded slots
  // Stacking check per machine group per hour: sum only M-slot operator loads (R slots are excluded)
  const groupHourOperatorMinutes = new Map<string, number>();
  const groupHourActiveSlots = new Map<string, typeof slots>();

  // Global setup technician capacity evaluation (R slots)
  const globalHourSetupMinutesMap = new Map<string, number>();
  const globalHourSetupActiveSlots = new Map<string, typeof slots>();

  slots.forEach((s) => {
    if (s.slotType === "M") {
      const key = `${s.date}_${s.hourStart}`;
      
      if (!groupHourOperatorMinutes.has(key)) {
        groupHourOperatorMinutes.set(key, 0);
        groupHourActiveSlots.set(key, []);
      }
      
      const loadContribution = s.minutesUsed * s.manpowerPct;
      groupHourOperatorMinutes.set(key, groupHourOperatorMinutes.get(key)! + loadContribution);
      groupHourActiveSlots.get(key)!.push(s);
    } else if (s.slotType === "R") {
      const key = `${s.date}_${s.hourStart}`;
      if (!globalHourSetupMinutesMap.has(key)) {
        globalHourSetupMinutesMap.set(key, 0);
        globalHourSetupActiveSlots.set(key, []);
      }
      globalHourSetupMinutesMap.set(key, globalHourSetupMinutesMap.get(key)! + s.minutesUsed * 1.0);
      globalHourSetupActiveSlots.get(key)!.push(s);
    }
  });

  // Flag overloaded slots and generate warnings
  const warningsSet = new Set<string>();

  // 5.1 Machining Operator overload warnings
  groupHourOperatorMinutes.forEach((demandedMinutes, key) => {
    const [dateStr, hourStartStr] = key.split("_");
    const dayCap = dailyCapacities?.[dateStr] || { setter: globalSetterCapacity, process: globalOperatorCapacity };
    const processCapMin = (dayCap.process / 100) * 60;

    if (demandedMinutes > processCapMin) {
      const activeSlots = groupHourActiveSlots.get(key) || [];
      activeSlots.forEach((s) => {
        s.overloaded = true;
      });

      const hourStart = parseInt(hourStartStr, 10);
      
      const formattedAlertDate = formatDateToGerman(dateStr);
      const timeIntervalStr = `${formattedAlertDate} ${String(hourStart).padStart(2, "0")}:00–${String(hourStart + 1).padStart(2, "0")}:00`;
      
      const loadPct = Math.round((demandedMinutes / processCapMin) * 100);
      
      const orderMinMap = new Map<string, number>();
      activeSlots.forEach((s) => {
        const orderCode = s.processId.split("-")[1] || s.processId;
        const opMin = s.minutesUsed * s.manpowerPct;
        orderMinMap.set(orderCode, (orderMinMap.get(orderCode) || 0) + opMin);
      });

      const ordersInvolvedStr = Array.from(orderMinMap.entries())
        .map(([orderCode, min]) => `${orderCode} (${min.toFixed(0)} min)`)
        .join(" + ");

      warningsSet.add(
        `Operator overload — Shop-wide | ${timeIntervalStr}\n` +
        `Demanded: ${demandedMinutes.toFixed(0)} operator-min | Available: ${processCapMin.toFixed(0)} operator-min (${dayCap.process}% capacity) | Load: ${loadPct}%\n` +
        `Orders involved: ${ordersInvolvedStr}`
      );
    }
  });

  // 5.2 Setup Technician overload warnings (Global)
  globalHourSetupMinutesMap.forEach((demandedMinutes, key) => {
    const [dateStr, hourStartStr] = key.split("_");
    const dayCap = dailyCapacities?.[dateStr] || { setter: globalSetterCapacity, process: globalOperatorCapacity };
    const setterCapMin = (dayCap.setter / 100) * 60;

    if (demandedMinutes > setterCapMin) {
      const activeSlots = globalHourSetupActiveSlots.get(key) || [];
      activeSlots.forEach((s) => {
        s.overloaded = true;
      });

      const hourStart = parseInt(hourStartStr, 10);
      
      const formattedAlertDate = formatDateToGerman(dateStr);
      const timeIntervalStr = `${formattedAlertDate} ${String(hourStart).padStart(2, "0")}:00–${String(hourStart + 1).padStart(2, "0")}:00`;
      
      const loadPct = Math.round((demandedMinutes / setterCapMin) * 100);
      
      const orderMinMap = new Map<string, number>();
      const orderMachineMap = new Map<string, string>();
      activeSlots.forEach((s) => {
        const orderCode = s.processId.split("-")[1] || s.processId;
        orderMinMap.set(orderCode, (orderMinMap.get(orderCode) || 0) + s.minutesUsed);
        orderMachineMap.set(orderCode, s.machineId);
      });

      const setupsInvolvedStr = Array.from(orderMinMap.entries())
        .map(([orderCode, min]) => `${orderMachineMap.get(orderCode)} [Order ${orderCode}] (${min.toFixed(0)} min)`)
        .join(" + ");

      warningsSet.add(
        `Setup Technician Overload | ${timeIntervalStr}\n` +
        `Demanded: ${demandedMinutes.toFixed(0)} setup-min | Available: ${setterCapMin.toFixed(0)} setup-min (${dayCap.setter}% capacity) | Load: ${loadPct}%\n` +
        `Setup tasks overlapping simultaneously across machines: ${setupsInvolvedStr}`
      );
    }
  });

  // Flag machine collisions if multiple processes occupy the same workstation in the same hour
  slots.forEach((s) => {
    const machineHourKey = `${s.machineId}_${s.date}_${s.hourStart}`;
    const occupants = machineHourOccupants.get(machineHourKey) || [];
    if (occupants.length > 1) {
      s.collision = true;
      const timeStr = `${s.date} ${String(s.hourStart).padStart(2, "0")}:00`;
      const orderIds = occupants.map(pid => pid.split("-")[1] || pid);
      warningsSet.add(
        `Collision on workstation ${s.machineId} at ${timeStr}: Orders ${orderIds.join(" & ")} scheduled simultaneously!`
      );
    }
  });

  // Flag group collisions if multiple processes occupy the same group in the same hour when serialization is enabled
  slots.forEach((s) => {
    const mGroupId = machineToGroupMap.get(s.machineId) || "";
    if (mGroupId) {
      const groupHourKey = `${mGroupId}_${s.date}_${s.hourStart}`;
      const occupants = groupHourOccupants.get(groupHourKey) || [];
      if (((groupSerialization || optimizeMode === "full") && !allowProcessOverlap) && occupants.length > 1) {
        s.collision = true;
        const timeStr = `${s.date} ${String(s.hourStart).padStart(2, "0")}:00`;
        const orderIds = occupants.map(pid => pid.split("-")[1] || pid);
        warningsSet.add(
          `Group collision on ${mGroupId} at ${timeStr}: Orders ${orderIds.join(" & ")} scheduled simultaneously in the same group!`
        );
      }
    }
  });

  return {
    slots,
    warnings: Array.from(warningsSet),
  };
}

function formatDateToGerman(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    const y = parts[0];
    const mIdx = parseInt(parts[1], 10) - 1;
    const d = parts[2];
    const months = ["Jan", "Feb", "Mrz", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    return `${d} ${months[mIdx] || "Jun"} ${y}`;
  }
  return dateStr;
}
