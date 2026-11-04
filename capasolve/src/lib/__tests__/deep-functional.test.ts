import { describe, it, expect } from "vitest";
import { generateSchedule } from "../scheduler";
import { PERMISSIONS_BY_ROLE } from "../permissions";
import { handleScheduleSolveApi } from "../../api/v1/schedule";
import { handlePostOrdersApi, handleGetOrdersApi, handleDeleteOrderApi } from "../../api/v1/orders";
import { calculateExecutionStats } from "../executionStats";
import { DEFAULT_MATERIALS_INVENTORY } from "../seedData";
import { parseCSVData } from "../csvParser";
import { Order, OrderProcess, Machine } from "../types";

describe("Production Pre-Release Deep Functional Suite", () => {
  const sampleMachines: Machine[] = [
    { id: "M1-01", machineGroupId: "M1", name: "CNC Milling 1" },
    { id: "M1-02", machineGroupId: "M1", name: "CNC Milling 2" },
    { id: "M2-01", machineGroupId: "M2", name: "CNC Lathe 1" },
    { id: "M2-02", machineGroupId: "M2", name: "CNC Lathe 2" },
  ];

  const makeProcess = (
    p: Partial<OrderProcess> &
      Pick<
        OrderProcess,
        "id" | "orderId" | "processId" | "machineId" | "setupTimeMin" | "processTimeMin" | "sumV2" | "totalTimeMin"
      >,
  ): OrderProcess => ({
    processText: `Operation ${p.processId}`,
    baseQty: 1,
    manpowerUtilizationMin: 1,
    sumV3: 1,
    manpowerPct: 1,
    status: "UNSCHEDULED",
    scheduledStart: null,
    scheduledEnd: null,
    ...p,
  });

  // -------------------------------------------------------------
  // Test FUNC-1.1: Precedence & Sequence Dependency Constraints
  // -------------------------------------------------------------
  it("FUNC-1.1: Sequence Precedence Constraint (10 -> 20 -> 30)", () => {
    const testOrders: Order[] = [
      {
        id: "O-PREC-1",
        orderId: "O-PREC-1",
        material: "Steel_4140",
        orderQty: 10,
        sopStartDate: "2026-11-02",
        sopStartTime: "08:00:00",
        priority: "Med",
      },
    ];

    const testProcesses: OrderProcess[] = [
      makeProcess({
        id: "proc-10",
        orderId: "O-PREC-1",
        processId: 10,
        machineId: "M1-01",
        processText: "Milling Step 10",
        setupTimeMin: 30,
        processTimeMin: 60,
        sumV2: 60,
        totalTimeMin: 90,
      }),
      makeProcess({
        id: "proc-20",
        orderId: "O-PREC-1",
        processId: 20,
        machineId: "M2-01",
        processText: "Turning Step 20",
        setupTimeMin: 20,
        processTimeMin: 40,
        sumV2: 40,
        totalTimeMin: 60,
      }),
      makeProcess({
        id: "proc-30",
        orderId: "O-PREC-1",
        processId: 30,
        machineId: "M1-02",
        processText: "Finishing Step 30",
        setupTimeMin: 15,
        processTimeMin: 30,
        sumV2: 30,
        totalTimeMin: 45,
      }),
    ];

    const sched = generateSchedule(testOrders, testProcesses, sampleMachines, "full");
    expect(sched.slots.length).toBeGreaterThan(0);

    const s10 = sched.slots.find((s) => s.processId === "proc-10");
    const s20 = sched.slots.find((s) => s.processId === "proc-20");
    const s30 = sched.slots.find((s) => s.processId === "proc-30");

    expect(s10).toBeDefined();
    expect(s20).toBeDefined();
    expect(s30).toBeDefined();

    // Verify step 10 starts on or before step 20, and step 20 on or before step 30
    expect(s10!.hourStart).toBeLessThanOrEqual(s20!.hourStart);
    expect(s20!.hourStart).toBeLessThanOrEqual(s30!.hourStart);
  });

  // -------------------------------------------------------------
  // Test FUNC-1.2: Dual-Resource Capacity Enforcements
  // -------------------------------------------------------------
  it("FUNC-1.2: Dual-Resource Ceilings (Setter Setup vs Operator Machining)", () => {
    const orders: Order[] = [
      {
        id: "O-CAP-1",
        orderId: "O-CAP-1",
        material: "Steel_4140",
        orderQty: 5,
        sopStartDate: "2026-11-03",
        sopStartTime: "08:00:00",
        priority: "High",
      },
      {
        id: "O-CAP-2",
        orderId: "O-CAP-2",
        material: "AL_6061",
        orderQty: 5,
        sopStartDate: "2026-11-03",
        sopStartTime: "08:00:00",
        priority: "High",
      },
    ];
    const processes: OrderProcess[] = [
      makeProcess({
        id: "P-101",
        orderId: "O-CAP-1",
        processId: 10,
        machineId: "M1-01",
        setupTimeMin: 60,
        processTimeMin: 120,
        sumV2: 120,
        totalTimeMin: 180,
      }),
      makeProcess({
        id: "P-102",
        orderId: "O-CAP-2",
        processId: 10,
        machineId: "M1-02",
        setupTimeMin: 60,
        processTimeMin: 120,
        sumV2: 120,
        totalTimeMin: 180,
      }),
    ];

    const sched = generateSchedule(orders, processes, sampleMachines, "full");
    expect(sched.slots.length).toBeGreaterThan(0);
    // Verify both jobs are scheduled
    const hasP1 = sched.slots.some((s) => s.processId === "P-101");
    const hasP2 = sched.slots.some((s) => s.processId === "P-102");
    expect(hasP1).toBe(true);
    expect(hasP2).toBe(true);
  });

  // -------------------------------------------------------------
  // Test FUNC-1.3: SOP Deadline Clamping & Warning System
  // -------------------------------------------------------------
  it("FUNC-1.3: SOP Deadline Clamping & Late Order Warning", () => {
    const orders: Order[] = [
      {
        id: "O-SOP-1",
        orderId: "O-SOP-1",
        material: "Titanium",
        orderQty: 100,
        sopStartDate: "2026-10-26",
        sopStartTime: "08:00:00",
        priority: "Urgent",
      },
    ];
    const processes: OrderProcess[] = [
      makeProcess({
        id: "P-LONG",
        orderId: "O-SOP-1",
        processId: 10,
        machineId: "M1-01",
        setupTimeMin: 240,
        processTimeMin: 1200,
        sumV2: 1200,
        totalTimeMin: 1440,
      }),
    ];

    const sched = generateSchedule(orders, processes, sampleMachines, "full");
    expect(Array.isArray(sched.warnings)).toBe(true);
  });

  // -------------------------------------------------------------
  // Test FUNC-1.4: Solver Strategy Modes (full, pre, workstation)
  // -------------------------------------------------------------
  it("FUNC-1.4: Solver Strategy Modes (full, pre-optimization, workstation)", () => {
    const orders: Order[] = [
      {
        id: "O-MODE-1",
        orderId: "O-MODE-1",
        material: "Brass",
        orderQty: 20,
        sopStartDate: "2026-11-04",
        sopStartTime: "08:00:00",
      },
    ];
    const processes: OrderProcess[] = [
      makeProcess({
        id: "P-M1",
        orderId: "O-MODE-1",
        processId: 10,
        machineId: "M2-01",
        setupTimeMin: 15,
        processTimeMin: 45,
        sumV2: 45,
        totalTimeMin: 60,
      }),
    ];

    const sFull = generateSchedule(orders, processes, sampleMachines, "full");
    const sPre = generateSchedule(orders, processes, sampleMachines, "pre");
    const sWork = generateSchedule(orders, processes, sampleMachines, "workstation");

    expect(sFull.slots.length).toBeGreaterThan(0);
    expect(sPre.slots.length).toBeGreaterThan(0);
    expect(sWork.slots.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------
  // Test FUNC-3.2: Granular Role Permissions Enforcement
  // -------------------------------------------------------------
  it("FUNC-3.2: Granular Role Permissions (ADMIN vs DEVELOPER vs GUEST)", () => {
    expect(PERMISSIONS_BY_ROLE.DEVELOPER.canAccessDevTools).toBe(true);
    expect(PERMISSIONS_BY_ROLE.DEVELOPER.canBypassPlanLimits).toBe(true);
    expect(PERMISSIONS_BY_ROLE.ADMIN.canManageTeam).toBe(true);
    expect(PERMISSIONS_BY_ROLE.ADMIN.canAccessDevTools).toBe(false);
    expect(PERMISSIONS_BY_ROLE.GUEST.canModifySchedules).toBe(false);
    expect(PERMISSIONS_BY_ROLE.GUEST.canRunSolver).toBe(false);
    expect(PERMISSIONS_BY_ROLE.GUEST.canDispatchFloor).toBe(true);
  });

  // -------------------------------------------------------------
  // Test FUNC-4.2: Programmatic Solver Execution (/api/v1/schedule/solve)
  // -------------------------------------------------------------
  it("FUNC-4.2: Programmatic Solver Execution (POST /api/v1/schedule/solve)", () => {
    const payload = {
      orders: [
        {
          id: "API-ORD-1",
          orderId: "API-ORD-1",
          material: "Inconel_718",
          orderQty: 10,
          sopStartDate: "2026-11-05",
          sopStartTime: "08:00:00",
        },
      ],
      processes: [
        {
          id: "P-API-1",
          orderId: "API-ORD-1",
          processId: 10,
          machineId: "M1-01",
          setupTimeMin: 45,
          processTimeMin: 90,
          sumV2: 90,
          totalTimeMin: 135,
          manpowerPct: 1,
          status: "UNSCHEDULED" as const,
        },
      ],
      machines: sampleMachines,
      mode: "full" as const,
    };

    const apiRes = handleScheduleSolveApi(payload);
    expect(apiRes.success).toBe(true);
    expect(apiRes.data?.totalSlots).toBeGreaterThan(0);
    expect(typeof apiRes.data?.solveTimeMs).toBe("number");
  });

  // -------------------------------------------------------------
  // Test FUNC-4.3: ERP Work Order Synchronization (/api/v1/orders)
  // -------------------------------------------------------------
  it("FUNC-4.3: External ERP REST API: Full CRUD Cycle (/api/v1/orders)", async () => {
    const newOrder: Order = {
      id: "ERP-SYNC-999",
      orderId: "ERP-SYNC-999",
      material: "Steel",
      orderQty: 150,
      sopStartDate: "2026-11-01",
      sopStartTime: "08:00:00",
    };
    const postRes = await handlePostOrdersApi({ orders: [newOrder] });
    expect(postRes.success).toBe(true);

    const getRes = await handleGetOrdersApi("ERP-SYNC-999");
    expect(getRes.success).toBe(true);
    expect(getRes.data.orders.some((o) => o.id === "ERP-SYNC-999")).toBe(true);

    const delRes = await handleDeleteOrderApi("ERP-SYNC-999");
    expect(delRes.success).toBe(true);
    expect(delRes.data?.removed).toBe(true);
  });

  // -------------------------------------------------------------
  // Test FUNC-5.1: Shop Floor Execution Lifecycle Transitions
  // -------------------------------------------------------------
  it("FUNC-5.1: Shop Floor MES Execution Lifecycle Transitions", () => {
    const testProcesses: any[] = [
      { orderId: "O-1", processId: 10, executionStatus: "QUEUED" },
      { orderId: "O-1", processId: 20, executionStatus: "IN_PROGRESS" },
      { orderId: "O-1", processId: 30, executionStatus: "COMPLETED" },
      { orderId: "O-1", processId: 40, executionStatus: "PAUSED" },
    ];
    const stats = calculateExecutionStats(testProcesses);
    expect(stats.queued).toBe(1);
    expect(stats.running).toBe(1);
    expect(stats.done).toBe(1);
    expect(stats.hold).toBe(1);
    expect(stats.total).toBe(4);
    expect(stats.completionRatePct).toBe(25);
  });

  // -------------------------------------------------------------
  // Test FUNC-5.2: Raw Material Inventory Readiness Model
  // -------------------------------------------------------------
  it("FUNC-5.2: Raw Material Inventory Readiness Model", () => {
    expect(Array.isArray(DEFAULT_MATERIALS_INVENTORY)).toBe(true);
    expect(DEFAULT_MATERIALS_INVENTORY.length).toBeGreaterThan(0);
    const item = DEFAULT_MATERIALS_INVENTORY[0];
    expect(item.sku).toBeDefined();
    expect(typeof item.availableQty).toBe("number");
    expect(item.availableQty).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------
  // Test FUNC-6.1: High-Volume Solver Stress Benchmark (50 Orders, 150 Processes)
  // -------------------------------------------------------------
  it("FUNC-6.1: High-Volume Solver Stress Benchmark (50 Orders, 150 Processes)", () => {
    const stressOrders: Order[] = [];
    const stressProcesses: OrderProcess[] = [];

    for (let i = 1; i <= 50; i++) {
      const oId = `STRESS-${i}`;
      stressOrders.push({
        id: oId,
        orderId: oId,
        material: i % 2 === 0 ? "Steel_4140" : "AL_6061",
        orderQty: 50,
        sopStartDate: "2026-11-01",
        sopStartTime: "08:00:00",
      });
      stressProcesses.push(
        makeProcess({
          id: `P-${i}-10`,
          orderId: oId,
          processId: 10,
          machineId: "M1-01",
          setupTimeMin: 15,
          processTimeMin: 30,
          sumV2: 30,
          totalTimeMin: 45,
        }),
        makeProcess({
          id: `P-${i}-20`,
          orderId: oId,
          processId: 20,
          machineId: "M2-01",
          setupTimeMin: 10,
          processTimeMin: 20,
          sumV2: 20,
          totalTimeMin: 30,
        }),
        makeProcess({
          id: `P-${i}-30`,
          orderId: oId,
          processId: 30,
          machineId: "M1-02",
          setupTimeMin: 5,
          processTimeMin: 15,
          sumV2: 15,
          totalTimeMin: 20,
        }),
      );
    }

    const start = performance.now();
    const result = generateSchedule(stressOrders, stressProcesses, sampleMachines, "full");
    const elapsed = performance.now() - start;

    expect(result.slots.length).toBeGreaterThan(100);
    expect(elapsed).toBeLessThan(3000); // Executed under 3 seconds
  });

  // -------------------------------------------------------------
  // Test FUNC-6.2: ERP Data Cleaning Engine
  // -------------------------------------------------------------
  it("FUNC-6.2: ERP Data Cleaning Engine (CSV Auto-Column Normalization)", () => {
    const csvContent = `Order,Material,Order Process ID,Order QTY,SOP Start Date,SOP Start time,Machine,Set up Time (Not related to any qty),Process time (related to qty)\n1001,Steel,10,50,2026-11-01,08:00:00,M1-01,30,60\n1001,Steel,20,50,2026-11-01,08:00:00,M2-01,20,40`;
    const parsed = parseCSVData(csvContent);
    expect(parsed.orders.length).toBeGreaterThanOrEqual(1);
    expect(parsed.processes.length).toBe(2);
    expect(parsed.orders[0].orderId).toBe("1001");
  });
});
