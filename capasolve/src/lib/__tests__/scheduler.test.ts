import { describe, it, expect } from "vitest";
import {
  generateSchedule,
  getSequenceSetupTime,
  parseSOPDate,
  simulateScenario,
} from "../scheduler";
import { Order, OrderProcess, Machine, SetupMatrixRule, ScenarioConfig } from "../types";

describe("CapaSolve Finite Capacity Scheduler", () => {
  const sampleMachines: Machine[] = [
    { id: "M1-01", name: "CNC Milling 01", machineGroupId: "M1" },
    { id: "M1-02", name: "CNC Milling 02", machineGroupId: "M1" },
    { id: "M2-01", name: "Drilling 01", machineGroupId: "M2" },
  ];

  it("handles empty orders and processes gracefully without crashing", () => {
    const result = generateSchedule([], [], sampleMachines);
    expect(result.slots).toEqual([]);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it("schedules a single order and process across working hours (06:00 - 20:00)", () => {
    const orders: Order[] = [
      {
        id: "ord-1",
        orderId: "10001",
        material: "MAT-A",
        sopStartDate: "2026-06-01",
        sopStartTime: "08:00:00",
        orderQty: 10,
        priority: "Med",
      },
    ];

    const processes: OrderProcess[] = [
      {
        id: "proc-1",
        orderId: "10001",
        processId: 10,
        machineId: "M1-01",
        processText: "MILLING",
        baseQty: 1,
        setupTimeMin: 60,
        processTimeMin: 120,
        manpowerUtilizationMin: 1,
        sumV2: 120,
        sumV3: 10,
        totalTimeMin: 180,
        manpowerPct: 1,
        status: "UNSCHEDULED",
        scheduledStart: null,
        scheduledEnd: null,
      },
    ];

    const result = generateSchedule(orders, processes, sampleMachines, "full");
    expect(result.slots.length).toBeGreaterThan(0);

    // Verify all slots obey factory working hours (6 to 20)
    for (const slot of result.slots) {
      expect(slot.hourStart).toBeGreaterThanOrEqual(6);
      expect(slot.hourStart).toBeLessThan(20);
      expect(slot.machineId).toBe("M1-01");
    }

    // Verify process start and end are populated
    expect(processes[0].scheduledStart).toBeTruthy();
    expect(processes[0].scheduledEnd).toBeTruthy();
    expect(processes[0].status).toBe("SCHEDULED");
  });

  it("prioritizes Urgent orders over Low priority orders when competing for the same machine", () => {
    const orders: Order[] = [
      {
        id: "ord-low",
        orderId: "10001",
        material: "MAT-A",
        sopStartDate: "2026-06-01",
        sopStartTime: "06:00:00",
        orderQty: 5,
        priority: "Low",
      },
      {
        id: "ord-urgent",
        orderId: "10002",
        material: "MAT-B",
        sopStartDate: "2026-06-01",
        sopStartTime: "06:00:00",
        orderQty: 5,
        priority: "Urgent",
      },
    ];

    const processes: OrderProcess[] = [
      {
        id: "proc-low",
        orderId: "10001",
        processId: 10,
        machineId: "M1-01",
        processText: "MILLING",
        baseQty: 1,
        setupTimeMin: 60,
        processTimeMin: 60,
        manpowerUtilizationMin: 1,
        sumV2: 60,
        sumV3: 5,
        totalTimeMin: 120,
        manpowerPct: 1,
        status: "UNSCHEDULED",
        scheduledStart: null,
        scheduledEnd: null,
      },
      {
        id: "proc-urgent",
        orderId: "10002",
        processId: 10,
        machineId: "M1-01",
        processText: "MILLING",
        baseQty: 1,
        setupTimeMin: 60,
        processTimeMin: 60,
        manpowerUtilizationMin: 1,
        sumV2: 60,
        sumV3: 5,
        totalTimeMin: 120,
        manpowerPct: 1,
        status: "UNSCHEDULED",
        scheduledStart: null,
        scheduledEnd: null,
      },
    ];

    generateSchedule(orders, processes, sampleMachines, "full");

    const urgentStart = new Date(processes[1].scheduledStart!).getTime();
    const lowStart = new Date(processes[0].scheduledStart!).getTime();

    // Urgent order should start earlier or equal to Low order
    expect(urgentStart).toBeLessThanOrEqual(lowStart);
  });

  it("calculates dynamic sequence-dependent setup time correctly from rules", () => {
    const rules: SetupMatrixRule[] = [
      {
        id: "rule-1",
        fromMaterial: "STEEL",
        toMaterial: "ALUMINUM",
        machineGroupId: "M1",
        setupTimeMin: 90,
      },
      {
        id: "rule-2",
        fromMaterial: "*",
        toMaterial: "TITANIUM",
        machineGroupId: "M1",
        setupTimeMin: 150,
      },
    ];

    // Specific rule match
    const setup1 = getSequenceSetupTime("STEEL", "ALUMINUM", "M1", 30, rules);
    expect(setup1).toBe(90);

    // Wildcard rule match
    const setup2 = getSequenceSetupTime("COPPER", "TITANIUM", "M1", 30, rules);
    expect(setup2).toBe(150);

    // No match fallback to base setup
    const setup3 = getSequenceSetupTime("ALUMINUM", "STEEL", "M1", 45, rules);
    expect(setup3).toBe(45);
  });

  it("enforces multi-step group serialization (step 10 finishes before step 20 starts)", () => {
    const orders: Order[] = [
      {
        id: "ord-multi",
        orderId: "20001",
        material: "MAT-MULTI",
        sopStartDate: "2026-06-01",
        sopStartTime: "06:00:00",
        orderQty: 10,
        priority: "High",
      },
    ];

    const processes: OrderProcess[] = [
      {
        id: "proc-step10",
        orderId: "20001",
        processId: 10,
        machineId: "M1-01",
        processText: "ROUGH MILL",
        baseQty: 1,
        setupTimeMin: 30,
        processTimeMin: 60,
        manpowerUtilizationMin: 1,
        sumV2: 60,
        sumV3: 10,
        totalTimeMin: 90,
        manpowerPct: 1,
        status: "UNSCHEDULED",
        scheduledStart: null,
        scheduledEnd: null,
      },
      {
        id: "proc-step20",
        orderId: "20001",
        processId: 20,
        machineId: "M2-01",
        processText: "DRILL FINISH",
        baseQty: 1,
        setupTimeMin: 30,
        processTimeMin: 60,
        manpowerUtilizationMin: 1,
        sumV2: 60,
        sumV3: 10,
        totalTimeMin: 90,
        manpowerPct: 1,
        status: "UNSCHEDULED",
        scheduledStart: null,
        scheduledEnd: null,
      },
    ];

    generateSchedule(orders, processes, sampleMachines, "full", true);

    const step10End = new Date(processes[0].scheduledEnd!).getTime();
    const step20Start = new Date(processes[1].scheduledStart!).getTime();

    // Step 20 must start at or after Step 10 completes
    expect(step20Start).toBeGreaterThanOrEqual(step10End);
  });

  it("simulates machine stopped scenario without solver failure", () => {
    const orders: Order[] = [
      {
        id: "ord-breakdown",
        orderId: "30001",
        material: "MAT-X",
        sopStartDate: "2026-06-01",
        sopStartTime: "06:00:00",
        orderQty: 10,
        priority: "Med",
      },
    ];

    const processes: OrderProcess[] = [
      {
        id: "proc-breakdown",
        orderId: "30001",
        processId: 10,
        machineId: "M1-01",
        processText: "MILLING",
        baseQty: 1,
        setupTimeMin: 30,
        processTimeMin: 60,
        manpowerUtilizationMin: 1,
        sumV2: 60,
        sumV3: 10,
        totalTimeMin: 90,
        manpowerPct: 1,
        status: "UNSCHEDULED",
        scheduledStart: null,
        scheduledEnd: null,
      },
    ];

    const scenario: ScenarioConfig = {
      type: "machine_stopped",
      machineId: "M1-01",
      machineStopped: true,
      downtimeHours: 24,
      startDate: "2026-06-01",
    };

    const result = generateSchedule(
      orders,
      processes,
      sampleMachines,
      "full",
      false,
      false,
      false,
      false,
      {},
      100,
      200,
      0,
      [],
      scenario,
    );

    expect(result.slots).toBeDefined();
    // Verify solver handled downtime without throwing
    expect(processes[0].status).toBe("SCHEDULED");
  });

  it("optimizes setup times via setup matrix sequence auto-clustering", () => {
    const orders: Order[] = [
      {
        id: "ord-cluster-1",
        orderId: "WO-CL-1",
        material: "MAT_ALUMINUM",
        sopStartDate: "2026-06-01",
        sopStartTime: "08:00:00",
        orderQty: 20,
        priority: "Med",
      },
      {
        id: "ord-cluster-2",
        orderId: "WO-CL-2",
        material: "MAT_STEEL",
        sopStartDate: "2026-06-01",
        sopStartTime: "08:00:00",
        orderQty: 20,
        priority: "Med",
      },
      {
        id: "ord-cluster-3",
        orderId: "WO-CL-3",
        material: "MAT_ALUMINUM",
        sopStartDate: "2026-06-01",
        sopStartTime: "08:00:00",
        orderQty: 20,
        priority: "Med",
      },
    ];

    const processes: OrderProcess[] = [
      {
        id: "p-cl-1",
        orderId: "WO-CL-1",
        processId: 10,
        machineId: "M1-01",
        processText: "MILLING",
        baseQty: 1,
        setupTimeMin: 45,
        processTimeMin: 2,
        manpowerUtilizationMin: 1,
        sumV2: 40,
        sumV3: 20,
        totalTimeMin: 85,
        manpowerPct: 0.5,
        status: "UNSCHEDULED",
        scheduledStart: null,
        scheduledEnd: null,
      },
      {
        id: "p-cl-2",
        orderId: "WO-CL-2",
        processId: 10,
        machineId: "M1-01",
        processText: "MILLING",
        baseQty: 1,
        setupTimeMin: 45,
        processTimeMin: 2,
        manpowerUtilizationMin: 1,
        sumV2: 40,
        sumV3: 20,
        totalTimeMin: 85,
        manpowerPct: 0.5,
        status: "UNSCHEDULED",
        scheduledStart: null,
        scheduledEnd: null,
      },
      {
        id: "p-cl-3",
        orderId: "WO-CL-3",
        processId: 10,
        machineId: "M1-01",
        processText: "MILLING",
        baseQty: 1,
        setupTimeMin: 45,
        processTimeMin: 2,
        manpowerUtilizationMin: 1,
        sumV2: 40,
        sumV3: 20,
        totalTimeMin: 85,
        manpowerPct: 0.5,
        status: "UNSCHEDULED",
        scheduledStart: null,
        scheduledEnd: null,
      },
    ];

    const rules: SetupMatrixRule[] = [
      {
        id: "sm-1",
        fromMaterial: "MAT_ALUMINUM",
        toMaterial: "MAT_ALUMINUM",
        setupTimeMin: 10,
      },
    ];

    const result = generateSchedule(
      orders,
      processes,
      sampleMachines,
      "full",
      false,
      false,
      false,
      false,
      {},
      100,
      200,
      0,
      rules,
    );

    expect(result.slots.length).toBeGreaterThan(0);
    expect(result.totalSetupMinutesSaved).toBeGreaterThan(0);
    expect(result.totalChangeoverMinutes).toBeDefined();
  });

  it("enforces dual-resource constraints (delays second machine setup when setter pool is saturated)", () => {
    // Machine 1 and Machine 2 both have urgent orders wanting to start at 08:00
    // Each requires 60 mins of setup (R).
    // With globalSetterCapacity = 100 (1 FTE = 60 mins/hr), both cannot setup simultaneously!
    const orders: Order[] = [
      {
        id: "ord-setter-1",
        orderId: "WO-SET-1",
        material: "MAT_A",
        sopStartDate: "2026-06-01",
        sopStartTime: "08:00:00",
        orderQty: 10,
        priority: "Urgent",
      },
      {
        id: "ord-setter-2",
        orderId: "WO-SET-2",
        material: "MAT_B",
        sopStartDate: "2026-06-01",
        sopStartTime: "08:00:00",
        orderQty: 10,
        priority: "Urgent",
      },
    ];

    const processes: OrderProcess[] = [
      {
        id: "p-setter-1",
        orderId: "WO-SET-1",
        processId: 10,
        machineId: "M1-01",
        processText: "OP1",
        baseQty: 1,
        setupTimeMin: 60,
        processTimeMin: 60,
        manpowerUtilizationMin: 1,
        sumV2: 60,
        sumV3: 10,
        totalTimeMin: 120,
        manpowerPct: 1,
        status: "UNSCHEDULED",
        scheduledStart: null,
        scheduledEnd: null,
      },
      {
        id: "p-setter-2",
        orderId: "WO-SET-2",
        processId: 10,
        machineId: "M1-02", // Different machine!
        processText: "OP2",
        baseQty: 1,
        setupTimeMin: 60,
        processTimeMin: 60,
        manpowerUtilizationMin: 1,
        sumV2: 60,
        sumV3: 10,
        totalTimeMin: 120,
        manpowerPct: 1,
        status: "UNSCHEDULED",
        scheduledStart: null,
        scheduledEnd: null,
      },
    ];

    // Run scheduler with 1 FTE setter capacity (100)
    generateSchedule(
      orders,
      processes,
      sampleMachines,
      "full",
      false,
      false,
      false,
      false,
      {},
      100,
      200,
    );

    const start1 = new Date(processes[0].scheduledStart!).getTime();
    const start2 = new Date(processes[1].scheduledStart!).getTime();

    // Although both machines are completely idle and free at 08:00,
    // they cannot start setup at the exact same hour because there is only 1 setter!
    expect(start1).not.toBe(start2);
    // One starts at 08:00, the other must wait until 09:00 (at least 1 hour difference)
    expect(Math.abs(start1 - start2)).toBeGreaterThanOrEqual(3600000);
  });

  describe("parseSOPDate parser", () => {
    it("parses ISO YYYY-MM-DD dates without year corruption", () => {
      const d = parseSOPDate("2026-06-15", "08:30:00");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(5); // June is month index 5
      expect(d.getDate()).toBe(15);
      expect(d.getHours()).toBe(8);
      expect(d.getMinutes()).toBe(30);
    });

    it("parses European DD-MM-YYYY dates correctly", () => {
      const d = parseSOPDate("01-06-2026", "14:00:00");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(5);
      expect(d.getDate()).toBe(1);
      expect(d.getHours()).toBe(14);
    });

    it("parses slash-delimited dates correctly", () => {
      const d1 = parseSOPDate("2026/08/20", "10:00:00");
      expect(d1.getFullYear()).toBe(2026);
      expect(d1.getMonth()).toBe(7);
      expect(d1.getDate()).toBe(20);

      const d2 = parseSOPDate("20/08/2026", "10:00:00");
      expect(d2.getFullYear()).toBe(2026);
      expect(d2.getMonth()).toBe(7);
      expect(d2.getDate()).toBe(20);
    });

    it("parses full ISO strings with 'T'", () => {
      const d = parseSOPDate("2026-06-01T07:30:00", "");
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(5);
      expect(d.getDate()).toBe(1);
    });
  });

  describe("Weekend & Working Calendar Scheduling", () => {
    it("skips Saturdays and Sundays by default when scheduling multi-day workloads", () => {
      // 2026-06-05 is a Friday. A 120-minute job starting at 19:00 will have 60m on Friday 19:00-20:00,
      // and the remaining 60m must advance to Monday 2026-06-08 06:00, skipping Sat June 6 and Sun June 7!
      const orders: Order[] = [
        {
          id: "ord-weekend-skip",
          orderId: "WO-WKND-1",
          material: "MAT_STEEL",
          sopStartDate: "2026-06-05",
          sopStartTime: "19:00:00",
          orderQty: 10,
          priority: "High",
        },
      ];

      const processes: OrderProcess[] = [
        {
          id: "p-weekend-skip",
          orderId: "WO-WKND-1",
          processId: 10,
          machineId: "M1-01",
          processText: "OP1",
          baseQty: 1,
          setupTimeMin: 0,
          processTimeMin: 120,
          manpowerUtilizationMin: 1,
          sumV2: 120,
          sumV3: 10,
          totalTimeMin: 120,
          manpowerPct: 1,
          status: "UNSCHEDULED",
          scheduledStart: null,
          scheduledEnd: null,
        },
      ];

      const result = generateSchedule(orders, processes, sampleMachines, "full");
      expect(result.slots.length).toBe(2);

      const slotDates = result.slots.map((s) => s.date);
      expect(slotDates).toContain("2026-06-05"); // Friday
      expect(slotDates).not.toContain("2026-06-06"); // Saturday SKIPPED!
      expect(slotDates).not.toContain("2026-06-07"); // Sunday SKIPPED!
      expect(slotDates).toContain("2026-06-08"); // Monday!
    });

    it("allows scheduling on weekends when weekend_overtime scenario is activated", () => {
      const orders: Order[] = [
        {
          id: "ord-wknd-ot",
          orderId: "WO-WKND-OT",
          material: "MAT_STEEL",
          sopStartDate: "2026-06-05",
          sopStartTime: "19:00:00",
          orderQty: 10,
          priority: "High",
        },
      ];

      const processes: OrderProcess[] = [
        {
          id: "p-wknd-ot",
          orderId: "WO-WKND-OT",
          processId: 10,
          machineId: "M1-01",
          processText: "OP1",
          baseQty: 1,
          setupTimeMin: 0,
          processTimeMin: 120,
          manpowerUtilizationMin: 1,
          sumV2: 120,
          sumV3: 10,
          totalTimeMin: 120,
          manpowerPct: 1,
          status: "UNSCHEDULED",
          scheduledStart: null,
          scheduledEnd: null,
        },
      ];

      const scenario: ScenarioConfig = {
        type: "shift_change",
        shiftOption: "weekend_overtime",
      };

      const result = generateSchedule(
        orders,
        processes,
        sampleMachines,
        "full",
        false,
        false,
        false,
        false,
        {},
        100,
        200,
        0,
        [],
        scenario,
      );

      const slotDates = result.slots.map((s) => s.date);
      expect(slotDates).toContain("2026-06-05"); // Friday
      expect(slotDates).toContain("2026-06-06"); // Saturday worked due to overtime!
    });
  });

  describe("Real Utilization and On-Time Delivery (OTD) KPI Formulas", () => {
    it("computes exact mathematical utilization and 100% OTD when orders complete on time", () => {
      const orders: Order[] = [
        {
          id: "ord-kpi-1",
          orderId: "WO-KPI-1",
          material: "MAT_A",
          sopStartDate: "2026-06-01",
          sopStartTime: "08:00:00",
          dueDate: "2026-06-01",
          orderQty: 10,
          priority: "Med",
        },
      ];

      const processes: OrderProcess[] = [
        {
          id: "p-kpi-1",
          orderId: "WO-KPI-1",
          processId: 10,
          machineId: "M1-01",
          processText: "MILL",
          baseQty: 1,
          setupTimeMin: 60,
          processTimeMin: 120,
          manpowerUtilizationMin: 1,
          sumV2: 120,
          sumV3: 10,
          totalTimeMin: 180,
          manpowerPct: 1,
          status: "UNSCHEDULED",
          scheduledStart: null,
          scheduledEnd: null,
        },
      ];

      const sim = simulateScenario(orders, processes, sampleMachines, {
        type: "rush_order",
        rushOrderId: "WO-KPI-1",
      });

      // Total allocated = 180 mins (60m setup + 120m machining)
      // 3 sample machines over 1 working day (14 hrs/day * 60 = 840 mins each) = 2520 available mins
      // Real utilization = (180 / 2520) * 100 = 7.1%
      expect(sim.utilizationPct).toBeGreaterThan(0);
      expect(sim.utilizationPct).toBeLessThan(15);
      // Order finishes at 11:00 on June 1, which is before the end-of-day due date!
      expect(sim.otdPct).toBe(100);
    });
  });
});
