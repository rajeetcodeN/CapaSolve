# CapaSolve — Actual Code Architecture Deep-Dive

How every part of the scheduler, optimizer, capacity planner, and charts actually works at the code level.

---

## Complete Data Flow

```mermaid
flowchart TD
    subgraph "INPUT"
        CSV["CSV File Upload<br/>or default-csv.ts"]
    end

    subgraph "PARSING (store.ts:63-198)"
        Parse["parseCSVData()<br/>PapaParse → batch aggregation"]
        Orders["Order[]<br/>orderId, material, sopStartDate, orderQty"]
        Processes["OrderProcess[]<br/>processId, machineId, setupTimeMin,<br/>processTimeMin, manpowerPct, totalTimeMin"]
    end

    subgraph "STATE (store.ts Zustand)"
        Store["useAppStore<br/>orders + processes + machines +<br/>machineGroups + config flags"]
    end

    subgraph "SCHEDULER ENGINE (scheduler.ts:91-665)"
        Sort["1. Sort by SOP date ASC,<br/>then step number ASC"]
        Pass1["2. PASS 1: Lock manual<br/>overrides (pinned slots)"]
        Pass2["3. PASS 2: Schedule<br/>unscheduled processes"]
        Constraints["5-Layer Constraint Stack:<br/>Holiday → Machine Occupancy →<br/>Group Serialization →<br/>Setup Sequencing →<br/>Operator Capacity"]
        Allocate["allocateSlotsForProcess()<br/>Fills 1-hour ScheduleSlots<br/>R (setup) first, then M (machining)"]
        Warnings["Overload Detection:<br/>Flag overloaded + collision slots"]
    end

    subgraph "OUTPUT"
        Slots["ScheduleSlot[]<br/>id, processId, machineId, date,<br/>hourStart, slotType, minutesUsed,<br/>manpowerPct, overloaded, collision"]
        Warns["warnings: string[]"]
    end

    subgraph "VIEWS"
        Gantt["Gantt Chart<br/>gantt.tsx (2006 lines)"]
        Capacity["Capacity Planner<br/>capacity.tsx (1692 lines)"]
        Monthly["Monthly Planner<br/>monthly.tsx (1716 lines)"]
        Pivot["Pivot Table<br/>pivot.tsx (1258 lines)"]
        Analytics["Analytics/OEE<br/>analytics.tsx (477 lines)"]
    end

    CSV --> Parse
    Parse --> Orders
    Parse --> Processes
    Orders --> Store
    Processes --> Store
    Store -->|"runScheduler()"| Sort
    Sort --> Pass1
    Pass1 --> Pass2
    Pass2 --> Constraints
    Constraints --> Allocate
    Allocate --> Warnings
    Warnings --> Slots
    Warnings --> Warns
    Slots --> Store
    Warns --> Store
    Store --> Gantt
    Store --> Capacity
    Store --> Monthly
    Store --> Pivot
    Store --> Analytics

    style Constraints fill:#f59e0b,color:black
    style Allocate fill:#22c55e,color:white
    style Store fill:#3b82f6,color:white
```

---

## 1. CSV Parsing Pipeline

**File:** [store.ts:63-198](file:///d:/schedulersaas/flow-sync-saas/src/lib/store.ts#L63-L198) — `parseCSVData()`

```mermaid
flowchart LR
    Raw["Raw CSV text"] --> Papa["PapaParse<br/>header: true"]
    Papa --> Rows["Array of row objects"]
    Rows --> Batch["Batch Aggregation<br/>Key: orderCode_step"]
    Batch --> Formulas["Formula Calculation"]
    Formulas --> Output["{ orders[], processes[] }"]
```

### What happens step by step:

1. **PapaParse** reads CSV with `header: true, skipEmptyLines: true`
2. **Batch aggregation** — Groups rows by `${orderCode}_${step}`. If the same order+step appears multiple times, quantities are **summed** and the **earliest SOP date** is kept
3. **Formula calculation** for each process:

| Field          | Formula                                       | Code Location                                                                 |
| -------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| `sumV2`        | `(orderQty / baseQty) × processTimeMin`       | [store.ts:171](file:///d:/schedulersaas/flow-sync-saas/src/lib/store.ts#L171) |
| `sumV3`        | `manpowerUtilizationMin × baseQty × orderQty` | [store.ts:172](file:///d:/schedulersaas/flow-sync-saas/src/lib/store.ts#L172) |
| `manpowerPct`  | `manpowerUtilizationMin / processTimeMin`     | [store.ts:173](file:///d:/schedulersaas/flow-sync-saas/src/lib/store.ts#L173) |
| `totalTimeMin` | `setupTimeMin + sumV2`                        | [store.ts:174](file:///d:/schedulersaas/flow-sync-saas/src/lib/store.ts#L174) |

### Example:

```
Order=1023811, Step=40, OrderQty=104, BaseQty=3
SetupTime=30min, ProcessTime=5min, ManpowerUtil=1.95

sumV2 = (104/3) × 5 = 173.33 min
totalTimeMin = 30 + 173.33 = 203.33 min ← total time to schedule
manpowerPct = 1.95/5 = 0.39 ← 39% operator load during machining
```

---

## 2. The Scheduler Engine — How It Actually Works

**File:** [scheduler.ts:91-665](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts#L91-L665) — `generateSchedule()`

### Input Parameters

```typescript
generateSchedule(
  orders, // Order[] — SOP dates, quantities
  processes, // OrderProcess[] — steps with time calculations
  machines, // Machine[] — {id, machineGroupId}
  optimizeMode, // "pre" | "workstation" | "full"
  groupSerialization, // boolean — serialize within machine group?
  allowProcessOverlap, // boolean — allow parallel M-slots in same group?
  allowSopOverride, // boolean — can schedule before SOP date?
  maxUtilizeResources, // boolean — auto-reassign to fastest available machine?
  dailyCapacities, // Record<date, {setter%, process%, isHoliday?}>
  globalSetterCapacity, // default setter % (100 = 1 FTE)
  globalOperatorCapacity, // default operator % (200 = 2 FTEs)
  maxPreponeWeeks, // max weeks to schedule before SOP
);
```

### Algorithm: 2-Pass Greedy Left-Shift Scheduling

```mermaid
flowchart TD
    Start["Start: Sort all processes by<br/>SOP date ASC, step ASC"]

    P1["PASS 1: Manual Overrides<br/>(isManual=true, scheduledStart set)"]
    P1A["For each pinned process:<br/>allocateSlotsForProcess(proc, pinnedStart)<br/>Register in machineHourOccupants"]

    P2["PASS 2: Dynamic Scheduling<br/>(all remaining UNSCHEDULED)"]
    P2A["Calculate earliestStart:<br/>• If allowSopOverride: horizonStart<br/>• Else: order's SOP date<br/>• Clamp by maxPreponeWeeks<br/>• Wait for prior step to finish"]
    P2B["findEarliestStartForMachine(machineId):<br/>Slide hour-by-hour until a clean<br/>window is found for totalTimeMin"]
    P2C{"optimizeMode?"}
    P2D["pre: Just align to working hours,<br/>no constraint checking"]
    P2E["workstation: Check machine<br/>occupancy only"]
    P2F["full + maxUtilizeResources:<br/>Try ALL machines in group,<br/>pick earliest available"]
    P2G["allocateSlotsForProcess(proc, bestStart)"]

    Warn["Post-processing:<br/>Flag overloaded slots,<br/>collision detection,<br/>generate warning strings"]

    Start --> P1
    P1 --> P1A
    P1A --> P2
    P2 --> P2A
    P2A --> P2B
    P2B --> P2C
    P2C -->|"pre"| P2D
    P2C -->|"workstation"| P2E
    P2C -->|"full"| P2F
    P2D --> P2G
    P2E --> P2G
    P2F --> P2G
    P2G --> Warn
```

### The 5-Layer Constraint Stack

When `findEarliestStartForMachine()` searches for a valid window, it checks **each hour** against these constraints in order. If **any** constraint fails, it slides to the next hour.

```mermaid
flowchart TD
    Hour["Test hour slot:<br/>machineId + date + hour"]

    C0{"Layer 0: Holiday?<br/>dailyCapacities[date].isHoliday"}
    C0 -->|"Yes"| Skip["❌ CONFLICT → next hour"]
    C0 -->|"No"| C1

    C1{"Layer 1: Machine Occupied?<br/>machineHourOccupants has this key?"}
    C1 -->|"Yes"| Skip
    C1 -->|"No"| C2

    C2{"Layer 2: Group Serialization?<br/>(groupSerialization OR full mode)<br/>AND !allowProcessOverlap<br/>→ groupHourOccupants has key?"}
    C2 -->|"Yes"| Skip
    C2 -->|"No"| C3

    C3{"Layer 3: Setup Sequencing?<br/>allowProcessOverlap=true<br/>AND this is a setup (R) slot<br/>AND another R exists in same<br/>group at same hour"}
    C3 -->|"Yes"| Skip
    C3 -->|"No"| C4

    C4{"Layer 4: Operator Capacity?<br/>(full mode only)<br/>Setup: existing + new > setterCapMin?<br/>Machining: existing + new > processCapMin?"}
    C4 -->|"Yes"| Skip
    C4 -->|"No"| Pass["✅ PASS → hour is valid"]

    style C0 fill:#ef4444,color:white
    style C1 fill:#f97316,color:white
    style C2 fill:#eab308,color:black
    style C3 fill:#22c55e,color:white
    style C4 fill:#3b82f6,color:white
```

**Code location:** [scheduler.ts:379-458](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts#L379-L458)

### The 3 Optimization Modes — What Each Actually Does

| Mode              | Machine Check | Group Check                        | Operator Capacity Check | Machine Reassignment        | Code Path                                                                                                         |
| ----------------- | ------------- | ---------------------------------- | ----------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **`pre`**         | ❌            | ❌                                 | ❌                      | ❌                          | [L498-500](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts#L498-L500) — just `alignToWorkingHours()` |
| **`workstation`** | ✅ Layer 1    | ✅ Layer 2 (if groupSerialization) | ❌                      | ❌                          | [L494-497](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts#L494-L497)                                |
| **`full`**        | ✅ Layer 1    | ✅ Layer 2 (always)                | ✅ Layer 4              | ✅ (if maxUtilizeResources) | [L475-497](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts#L475-L497)                                |

### `full` + `maxUtilizeResources` — Machine Reassignment Logic

```typescript
// scheduler.ts:475-497
if (optimizeMode === "full" && maxUtilizeResources && mGroupId) {
  // Try ALL machines in the same group
  const groupMachines = machines.filter((m) => m.machineGroupId === mGroupId);

  let bestMachineId = proc.machineId; // default: CSV-assigned machine
  let earliestMachineStart = findEarliestStartForMachine(proc.machineId);

  for (const candMachine of groupMachines) {
    const candStart = findEarliestStartForMachine(candMachine.id);
    if (candStart < earliestMachineStart) {
      // earlier = better
      earliestMachineStart = candStart;
      bestMachineId = candMachine.id; // reassign!
    }
  }

  proc.machineId = bestMachineId; // override original assignment
}
```

**What this means:** If machine `603011` (from CSV) is busy until hour 14, but `603010` (same group M2) is free at hour 8, the process gets moved to `603010`. The `originalMachineId` field preserves the CSV value.

---

## 3. Slot Allocation — How Time Gets Filled

**File:** [scheduler.ts:189-304](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts#L189-L304) — `allocateSlotsForProcess()`

```mermaid
flowchart TD
    Start["Process: totalTimeMin=203, setupTimeMin=30"]

    H1["Hour 1 (06:00): R slot<br/>minutesUsed=30, manpowerPct=1.0<br/>+ M slot: minutesUsed=30, manpowerPct=0.39<br/>remainingSetup=0, remaining=143"]

    H2["Hour 2 (07:00): M slot<br/>minutesUsed=60, manpowerPct=0.39<br/>remaining=83"]

    H3["Hour 3 (08:00): M slot<br/>minutesUsed=60, manpowerPct=0.39<br/>remaining=23"]

    H4["Hour 4 (09:00): M slot<br/>minutesUsed=23, manpowerPct=0.39<br/>remaining=0 ✅"]

    Start --> H1
    H1 --> H2
    H2 --> H3
    H3 --> H4

    style H1 fill:#8b5cf6,color:white
    style H2 fill:#22c55e,color:white
    style H3 fill:#22c55e,color:white
    style H4 fill:#22c55e,color:white
```

**Key rules:**

- Setup (R) is always consumed **first** — before any machining
- R slots always have `manpowerPct=1.0` (100% operator attention)
- M slots use the process's calculated `manpowerPct` (e.g., 0.39)
- Within a single hour, **both R and M** can coexist (e.g., 30min R + 30min M)
- Each slot blocks the machine for that hour via `registerMachineHour()`

---

## 4. Capacity System — Two Global Resource Pools

```mermaid
flowchart LR
    subgraph "Global Setup Pool"
        SetterCap["setterCapacity: 100%<br/>= 60 setup-min per hour<br/>(1 FTE setter technician)"]
        SetterTracker["globalHourSetupMinutes<br/>Map: '2026-06-01_8' → 45 min"]
    end

    subgraph "Global Operator Pool"
        OpCap["operatorCapacity: 200%<br/>= 120 operator-min per hour<br/>(2 FTE machine operators)"]
        OpTracker["globalHourMachiningOperatorMinutes<br/>Map: '2026-06-01_8' → 95 min"]
    end

    subgraph "Per-Day Overrides"
        Daily["dailyCapacities['2026-06-05']<br/>= {setter: 50, process: 100, isHoliday: false}"]
    end

    subgraph "Constraint Check (full mode)"
        Check["For each candidate hour:<br/>existing + proposed ≤ capacity?"]
    end

    SetterCap --> Check
    SetterTracker --> Check
    OpCap --> Check
    OpTracker --> Check
    Daily --> Check
```

### Capacity math per hour:

```
setterCapMin = (dayCap.setter / 100) × 60
             = (100 / 100) × 60 = 60 min/hour

processCapMin = (dayCap.process / 100) × 60
              = (200 / 100) × 60 = 120 operator-min/hour
```

**Code:** [scheduler.ts:420-452](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts#L420-L452)

If `existingSetup + newSetup > 60 min` → conflict, try next hour.  
If `existingOpMin + (machMins × manpowerPct) > 120 min` → conflict, try next hour.

---

## 5. The Store — How It Orchestrates Everything

**File:** [store.ts:557-633](file:///d:/schedulersaas/flow-sync-saas/src/lib/store.ts#L557-L633) — `runScheduler()`

```mermaid
sequenceDiagram
    participant UI as "UI (Button Click)"
    participant Store as "Zustand Store"
    participant Scheduler as "scheduler.ts"
    participant React as "React Re-render"

    UI->>Store: runScheduler()
    Store->>Store: 1. Read orders, processes,<br/>machines, all config flags
    Store->>Store: 2. Reset non-manual processes<br/>to UNSCHEDULED, restore<br/>originalMachineId
    Store->>Scheduler: generateSchedule(orders,<br/>resetProcesses, machines,<br/>mode, flags, capacities)
    Scheduler-->>Store: {slots[], warnings[]}
    Store->>Store: 3. Map slot ranges back<br/>to process scheduledStart/End
    Store->>Store: 4. set({processes, slots, warnings})
    Store->>React: State change triggers re-render
    React->>React: Gantt, Capacity, Monthly,<br/>Pivot, Analytics all update
```

### What triggers `runScheduler()`:

Every state change that affects scheduling automatically re-runs it:

| Trigger                     | Store Method                  | Calls runScheduler?         |
| --------------------------- | ----------------------------- | --------------------------- |
| Change optimization mode    | `setOptimizationMode()`       | ✅ Yes                      |
| Toggle group serialization  | `setGroupSerialization()`     | ✅ Yes                      |
| Toggle process overlap      | `setAllowProcessOverlap()`    | ✅ Yes                      |
| Toggle SOP override         | `setAllowSopOverride()`       | ✅ Yes                      |
| Toggle max utilize          | `setMaxUtilizeResources()`    | ✅ Yes                      |
| Change setter capacity      | `setGlobalSetterCapacity()`   | ✅ Yes                      |
| Change operator capacity    | `setGlobalOperatorCapacity()` | ✅ Yes                      |
| Set daily capacity override | `setDailyCapacity()`          | ✅ Yes                      |
| Set max prepone weeks       | `setMaxPreponeWeeks()`        | ✅ Yes                      |
| Remove an order             | `removeOrder()`               | ✅ Yes                      |
| Import CSV                  | `loadFromCSVText()`           | ✅ Yes                      |
| Drag-drop a slot            | `updateSlotSchedule()`        | ✅ Yes (pins process first) |
| Reset process to auto       | `resetProcessToAuto()`        | ✅ Yes                      |
| Pin a process               | `pinProcessSchedule()`        | ✅ Yes                      |

---

## 6. Gantt Chart — How It Renders

**File:** [gantt.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/gantt.tsx) — 2006 lines

### Data Pipeline:

```mermaid
flowchart TD
    Slots["ScheduleSlot[] from store"]

    Timeline["timelineRange (useMemo):<br/>• Find min/max scheduledStart/End<br/>• Build days[] array<br/>• totalHours = days × 14"]

    MachineRows["filteredMachines (useMemo):<br/>• Filter by selected group<br/>• Each machine = one row"]

    Render["For each machine row:<br/>For each day in timeline:<br/>For each hour 06:00-20:00:<br/>→ Find slots where<br/>machineId + date + hour match<br/>→ Render colored block"]

    DragDrop["Drag-Drop:<br/>• dragStart: set processId<br/>• dragOver: highlight target cell<br/>• drop: updateSlotSchedule(<br/>processId, targetMachine,<br/>targetDate, targetHour)"]

    Slots --> Timeline
    Slots --> MachineRows
    Timeline --> Render
    MachineRows --> Render
    Render --> DragDrop
```

### How slot blocks are rendered:

```
Each slot becomes a colored <div>:
- R (setup) = purple/violet background
- M (machining) = green/blue background
- overloaded = red border
- collision = red pulsing background
- Width = HOUR_WIDTH (45px per hour)
- Height proportional to minutesUsed/60
```

### Zoom levels: `YEAR → WEEK → DAY → HOUR`

| Level | What shows                                      | Column width |
| ----- | ----------------------------------------------- | ------------ |
| YEAR  | Months as columns, order blocks spanning months | Compressed   |
| WEEK  | 7 days, each day = 14 hour columns              | 45px/hour    |
| DAY   | Single day, 14 hour columns                     | 45px/hour    |
| HOUR  | Single hour detail popup                        | Full width   |

---

## 7. Capacity Chart — How It Builds Data

**File:** [capacity.tsx:322-389](file:///d:/schedulersaas/flow-sync-saas/src/routes/capacity.tsx#L322-L389) — `hourlyChartData` (useMemo)

```mermaid
flowchart TD
    Loop["For each working hour (06:00 → 20:00):"]

    Scan["Scan ALL slots where<br/>date = selectedDate AND hourStart = hour"]

    Split{"slotType?"}

    R["R (setup):<br/>setterMinutesByMachine[machineId] += minutesUsed"]
    M["M (machining):<br/>opMins = minutesUsed × manpowerPct<br/>operatorMinutesByMachine[machineId] += opMins"]

    DataPoint["Build chart data point:<br/>operatorScheduledPct_{machineId} = (opMins/60)×100<br/>setterScheduledPct_{machineId} = (setupMins/60)×100<br/>setterLimitPct = dayCap.setter<br/>operatorLimitPct = dayCap.process"]

    Chart["Recharts ComposedChart:<br/>• Stacked Bar per machine (dynamic colors)<br/>• Line for capacity ceiling<br/>• Custom tooltip with order breakdown"]

    Loop --> Scan
    Scan --> Split
    Split -->|"R"| R
    Split -->|"M"| M
    R --> DataPoint
    M --> DataPoint
    DataPoint --> Chart
```

### Chart structure:

- **X-axis:** Hours (06:00 to 20:00)
- **Y-axis:** Operator/Setter load as % (0-200%+)
- **Bars:** Stacked per machine — each machine gets a separate `<Bar>` with unique color
- **Line:** Capacity ceiling line (100% for setter, 200% for operator)
- **Toggle:** Switch between "operator" and "setter" view via `chartRole` state
- **Filter:** Filter by machine group or individual machine via `chartMachineFilter`

---

## 8. Capacity Planner Day View — Pivot Table

**File:** [capacity.tsx:392-454](file:///d:/schedulersaas/flow-sync-saas/src/routes/capacity.tsx#L392-L454) — `dayPivotMatrix`

```
Structure: Record<machineId, Record<hour, {r, m, p}>>

r = total R (setup) minutes in that cell
m = total M (machining) minutes in that cell
p = operator-minutes = m × manpowerPct

Rows: machines (grouped by machineGroup)
Columns: hours (06-20)
Cells: R min / M min / Operator-min
```

Also provides:

- **Group subtotals** per hour: `getGroupSubtotalHourly(groupId, hour)`
- **Grand totals** per hour: `getGrandTotalHourly(hour)`

---

## 9. Monthly Planner — How It Works

**File:** [monthly.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/monthly.tsx) — 1716 lines

```mermaid
flowchart LR
    Calendar["Month Calendar Grid<br/>Days as cells"]

    DayCells["Each day cell:<br/>• Count slots on that date<br/>• Show order blocks<br/>• Color by load level<br/>• Holiday marker if isHoliday"]

    Detail["Click day → expand:<br/>• Per-machine timeline<br/>• Order list with status<br/>• Pin/unpin controls<br/>• Reschedule dialog"]

    Calendar --> DayCells
    DayCells --> Detail
```

Key features:

- Calendar navigation (month/year)
- Order blocks spanning multiple days
- Holiday toggle per day → writes to `dailyCapacities[date].isHoliday`
- Capacity override editing per day
- Search/filter by order, machine, status

---

## 10. Pivot Table — Three Views

**File:** [pivot.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/pivot.tsx) — 1258 lines

| Tab             | What It Shows                                                                                    | Data Source                              |
| --------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| **Raw**         | Every process with all fields (orderId, material, setup, process time, SOP, scheduled start/end) | `processes[]` + `orders[]`               |
| **Grouped**     | Aggregated by machine group → machine → order, with totals                                       | `processes[]` grouped                    |
| **Load Matrix** | Machines × Dates grid, each cell = total minutes scheduled                                       | `slots[]` aggregated by machineId + date |

---

## 11. Analytics / OEE Dashboard

**File:** [analytics.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/analytics.tsx) — 477 lines

```mermaid
flowchart TD
    Slots["ScheduleSlot[]"]

    MachineUtil["Machine Utilization:<br/>For each machine:<br/>totalScheduledMin = sum(slot.minutesUsed)<br/>totalAvailableMin = uniqueDays × 14 × 60<br/>utilization% = scheduled/available × 100"]

    SetupRatio["Setup Ratio:<br/>R_minutes / (R_minutes + M_minutes) × 100"]

    OpLoad["Operator Load per Hour:<br/>Group by date+hour:<br/>sum(M_slot.minutesUsed × manpowerPct)<br/>vs processCapacity ceiling"]

    Charts["Recharts:<br/>• BarChart: per-machine utilization<br/>• ComposedChart: setup vs machining ratio<br/>• LineChart: daily operator load trend"]

    Slots --> MachineUtil
    Slots --> SetupRatio
    Slots --> OpLoad
    MachineUtil --> Charts
    SetupRatio --> Charts
    OpLoad --> Charts
```

---

## 12. Warning & Overload Detection

**File:** [scheduler.ts:505-651](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts#L505-L651)

After all slots are allocated, 3 types of warnings are generated:

```mermaid
flowchart TD
    W1["5.1 Operator Overload Warning<br/>When: sum(M.minutesUsed × manpowerPct) > processCapMin<br/>for any hour globally<br/>Action: Flag slots as overloaded=true"]

    W2["5.2 Setup Technician Overload<br/>When: sum(R.minutesUsed) > setterCapMin<br/>for any hour globally<br/>Action: Flag R slots as overloaded=true"]

    W3["5.3 Machine/Group Collision<br/>When: 2+ processes on same machine same hour<br/>OR 2+ processes in same group same hour<br/>(when serialization enabled)<br/>Action: Flag slots as collision=true"]

    W1 --> Output["warnings[] string array<br/>+ slot.overloaded / slot.collision booleans"]
    W2 --> Output
    W3 --> Output
```

---

## 13. Manual Override & Drag-Drop System

**File:** [store.ts:635-722](file:///d:/schedulersaas/flow-sync-saas/src/lib/store.ts#L635-L722)

```mermaid
sequenceDiagram
    participant User
    participant Gantt as "Gantt UI"
    participant Store
    participant Scheduler

    User->>Gantt: Drag process block to new cell
    Gantt->>Store: updateSlotSchedule(processId,<br/>newMachineId, newDate, newHour)
    Store->>Store: Mark process as isManual=true,<br/>set scheduledStart/End
    Store->>Scheduler: generateSchedule()<br/>(manual processes go to PASS 1)
    Scheduler-->>Store: New slots[] respecting<br/>the pinned process
    Store->>Gantt: Re-render with updated slots

    Note over Store,Scheduler: PASS 1 locks the pinned slot first.<br/>PASS 2 schedules everything else<br/>AROUND the pinned slot.
```

### The pin/unpin cycle:

1. **Drag-drop** → `updateSlotSchedule()` → sets `isManual=true`
2. **Pin button** → `pinProcessSchedule()` → sets `isManual=true` on current position
3. **Reset to auto** → `resetProcessToAuto()` → sets `isManual=false`, restores `originalMachineId`
4. All three trigger `runScheduler()` which re-runs the full 2-pass algorithm

---

## Summary: What Each File Does

| File                                                                                              | Role                          | Lines | Key Function                                                   |
| ------------------------------------------------------------------------------------------------- | ----------------------------- | ----- | -------------------------------------------------------------- |
| [types.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/types.ts)                              | Data model definitions        | 70    | Type interfaces + shift constants                              |
| [store.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/store.ts)                              | Central state + orchestration | 845   | `runScheduler()`, `parseCSVData()`, cloud sync                 |
| [scheduler.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/scheduler.ts)                      | Constraint solver engine      | 665   | `generateSchedule()`, `allocateSlotsForProcess()`              |
| [dataCleaner.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/dataCleaner.ts)                  | CSV validation & cleaning     | 719   | `validateCSVData()`, `cleanCSVData()`, `detectColumnMapping()` |
| [gantt.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/gantt.tsx)                         | Interactive Gantt timeline    | 2,006 | Drag-drop scheduling, multi-zoom, machine rows                 |
| [capacity.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/capacity.tsx)                   | Day-level capacity planner    | 1,692 | Calendar, capacity config, stacked bar chart, pivot            |
| [monthly.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/monthly.tsx)                     | Month calendar planner        | 1,716 | Calendar grid, order blocks, holiday management                |
| [pivot.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/pivot.tsx)                         | Tabular data views            | 1,258 | Raw/Grouped/Load Matrix tabs                                   |
| [analytics.tsx](file:///d:/schedulersaas/flow-sync-saas/src/routes/analytics.tsx)                 | OEE/utilization dashboard     | 477   | Machine util, setup ratio, operator load charts                |
| [DataCleaningHub.tsx](file:///d:/schedulersaas/flow-sync-saas/src/components/DataCleaningHub.tsx) | CSV cleaning wizard UI        | 1,357 | 4-step workflow: Upload → Validate → Clean → Import            |
| [default-csv.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/default-csv.ts)                  | Built-in sample dataset       | 23KB  | Hardcoded CSV for demo                                         |
| [translations.ts](file:///d:/schedulersaas/flow-sync-saas/src/lib/translations.ts)                | i18n dictionary               | 13KB  | EN + DE translations                                           |
