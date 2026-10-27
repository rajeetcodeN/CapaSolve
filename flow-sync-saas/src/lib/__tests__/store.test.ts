import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../store";

describe("CapaSolve Zustand Application State Store", () => {
  beforeEach(() => {
    // Reset basic store state before each test
    useAppStore.setState({
      orders: [],
      processes: [],
      slots: [],
      warnings: [],
      groupSerialization: false,
      globalSetterCapacity: 100,
      globalOperatorCapacity: 200,
      setupMatrixRules: [],
    });
  });

  it("initializes with clean default values", () => {
    const state = useAppStore.getState();
    expect(Array.isArray(state.orders)).toBe(true);
    expect(state.groupSerialization).toBe(false);
    expect(state.globalSetterCapacity).toBe(100);
    expect(state.globalOperatorCapacity).toBe(200);
  });

  it("updates global capacities correctly", () => {
    const { setGlobalSetterCapacity, setGlobalOperatorCapacity } = useAppStore.getState();

    setGlobalSetterCapacity(150);
    setGlobalOperatorCapacity(250);

    const state = useAppStore.getState();
    expect(state.globalSetterCapacity).toBe(150);
    expect(state.globalOperatorCapacity).toBe(250);
  });

  it("manages setup matrix rules (add and delete)", () => {
    const { addSetupMatrixRule, deleteSetupMatrixRule } = useAppStore.getState();

    addSetupMatrixRule({
      fromMaterial: "MAT-X",
      toMaterial: "MAT-Y",
      setupTimeMin: 40,
      description: "Custom Changeover",
    });

    let state = useAppStore.getState();
    expect(state.setupMatrixRules.length).toBe(1);
    expect(state.setupMatrixRules[0].fromMaterial).toBe("MAT-X");
    expect(state.setupMatrixRules[0].setupTimeMin).toBe(40);

    const ruleId = state.setupMatrixRules[0].id;
    deleteSetupMatrixRule(ruleId);

    state = useAppStore.getState();
    expect(state.setupMatrixRules.length).toBe(0);
  });

  it("manages team members state", () => {
    const { addTeamMember, removeTeamMember } = useAppStore.getState();

    addTeamMember({
      name: "Hans Schmidt",
      email: "hans@factory.de",
      role: "DEVELOPER",
    });

    let state = useAppStore.getState();
    expect(state.teamMembers.some((m) => m.email === "hans@factory.de")).toBe(true);

    const memberId = state.teamMembers.find((m) => m.email === "hans@factory.de")!.id;
    removeTeamMember(memberId);

    state = useAppStore.getState();
    expect(state.teamMembers.some((m) => m.email === "hans@factory.de")).toBe(false);
  });

  it("manages organization and user roles for RBAC", () => {
    const { setOrganization, setRole } = useAppStore.getState();

    setOrganization({
      id: "org-123",
      name: "Precision Fab Werk",
      plan: "PRO",
    });
    setRole("ADMIN");

    const state = useAppStore.getState();
    expect(state.organization?.id).toBe("org-123");
    expect(state.organization?.name).toBe("Precision Fab Werk");
    expect(state.role).toBe("ADMIN");
  });

  it("calculates execution stats and manages shop floor execution status transitions", () => {
    const {
      updateStepExecutionStatus,
      simulateShopFloorProgress,
      releaseAllScheduled,
      resetAllExecutionStatuses,
    } = useAppStore.getState();

    // Set sample processes in the store
    useAppStore.setState({
      orders: [
        {
          id: "o1",
          orderId: "WO-100",
          material: "ALU-100",
          sopStartDate: "2026-06-01",
          sopStartTime: "08:00:00",
          orderQty: 100,
        },
      ],
      processes: [
        {
          id: "p1",
          orderId: "WO-100",
          processId: 10,
          machineId: "M1",
          processText: "CUTTING",
          baseQty: 1,
          setupTimeMin: 10,
          processTimeMin: 20,
          manpowerUtilizationMin: 1,
          sumV2: 20,
          sumV3: 20,
          totalTimeMin: 30,
          manpowerPct: 0.1,
          status: "SCHEDULED",
          scheduledStart: "2026-06-01T08:00:00.000Z",
          scheduledEnd: "2026-06-01T08:30:00.000Z",
          executionStatus: "PLANNED",
          completedQty: 0,
        },
        {
          id: "p2",
          orderId: "WO-100",
          processId: 20,
          machineId: "M2",
          processText: "MILLING",
          baseQty: 1,
          setupTimeMin: 10,
          processTimeMin: 20,
          manpowerUtilizationMin: 1,
          sumV2: 20,
          sumV3: 20,
          totalTimeMin: 30,
          manpowerPct: 0.1,
          status: "UNSCHEDULED",
          scheduledStart: null,
          scheduledEnd: null,
          executionStatus: "QUEUED",
          completedQty: 0,
        },
      ],
    });

    // Test transition to IN_PROGRESS (Running)
    updateStepExecutionStatus("p1", "IN_PROGRESS");
    let state = useAppStore.getState();
    expect(state.processes.find((p) => p.id === "p1")?.executionStatus).toBe("IN_PROGRESS");

    // Test transition to PAUSED (Hold)
    updateStepExecutionStatus("p1", "PAUSED");
    state = useAppStore.getState();
    expect(state.processes.find((p) => p.id === "p1")?.executionStatus).toBe("PAUSED");

    // Test transition to COMPLETED (Done)
    updateStepExecutionStatus("p1", "COMPLETED", 100);
    state = useAppStore.getState();
    expect(state.processes.find((p) => p.id === "p1")?.executionStatus).toBe("COMPLETED");
    expect(state.processes.find((p) => p.id === "p1")?.completedQty).toBe(100);

    // Test simulateShopFloorProgress
    simulateShopFloorProgress();
    state = useAppStore.getState();
    expect(state.processes.find((p) => p.id === "p1")?.executionStatus).toBe("COMPLETED");

    // Test resetAllExecutionStatuses
    resetAllExecutionStatuses();
    state = useAppStore.getState();
    expect(state.processes.find((p) => p.id === "p1")?.executionStatus).toBe("PLANNED");
    expect(state.processes.find((p) => p.id === "p2")?.executionStatus).toBe("QUEUED");

    // Test releaseAllScheduled
    releaseAllScheduled();
    state = useAppStore.getState();
    expect(state.processes.find((p) => p.id === "p1")?.executionStatus).toBe("PLANNED");
  });

  it("handles hold reasons, scrap logging, and scrap audit history", () => {
    const { updateStepExecutionStatus, logScrap } = useAppStore.getState();

    useAppStore.setState({
      processes: [
        {
          id: "proc-audit-1",
          orderId: "WO-AUDIT",
          processId: 10,
          machineId: "CNC-01",
          processText: "ROUGHING",
          baseQty: 1,
          setupTimeMin: 15,
          processTimeMin: 30,
          manpowerUtilizationMin: 1,
          sumV2: 30,
          sumV3: 30,
          totalTimeMin: 45,
          manpowerPct: 1,
          status: "SCHEDULED",
          scheduledStart: "2026-06-01T08:00:00.000Z",
          scheduledEnd: "2026-06-01T08:45:00.000Z",
          executionStatus: "IN_PROGRESS",
          completedQty: 0,
        },
      ],
    });

    // Pause with structured hold reason
    updateStepExecutionStatus(
      "proc-audit-1",
      "PAUSED",
      undefined,
      undefined,
      "Broken endmill on slot 4",
      "TOOLING_ISSUE",
    );
    let proc = useAppStore.getState().processes.find((p) => p.id === "proc-audit-1");
    expect(proc?.executionStatus).toBe("PAUSED");
    expect(proc?.holdReason).toBe("TOOLING_ISSUE");
    expect(proc?.operatorNotes).toBe("Broken endmill on slot 4");

    // Log scrap pieces
    logScrap("proc-audit-1", 3, "TOOL_BREAKAGE", "Tip broke during aggressive feed");
    proc = useAppStore.getState().processes.find((p) => p.id === "proc-audit-1");
    expect(proc?.scrapQty).toBe(3);
    expect(proc?.scrapReason).toBe("TOOL_BREAKAGE");
    expect(proc?.scrapHistory).toHaveLength(1);
    expect(proc?.scrapHistory?.[0].scrapQty).toBe(3);
    expect(proc?.scrapHistory?.[0].reason).toBe("TOOL_BREAKAGE");

    // Add additional scrap
    logScrap("proc-audit-1", 2, "DIMENSION_OOS", "Out of tolerance by 0.05mm");
    proc = useAppStore.getState().processes.find((p) => p.id === "proc-audit-1");
    expect(proc?.scrapQty).toBe(5);
    expect(proc?.scrapHistory).toHaveLength(2);
  });

  it("evaluates material inventory readiness and tracks stock adjustments", () => {
    const { updateMaterialStock, checkMaterialReadiness } = useAppStore.getState();

    // Check material readiness with known SKU (100-024-830.01-00 has 1500 available, 320 reserved => 1180 net)
    const readyStatus = checkMaterialReadiness("100-024-830.01-00", 50);
    expect(readyStatus.readiness).toBe("READY");
    expect(readyStatus.available).toBeGreaterThanOrEqual(50);

    // Check material shortage for out-of-stock SKU (100-024-830.03-00 has 0 available)
    const shortageStatus = checkMaterialReadiness("100-024-830.03-00", 10);
    expect(shortageStatus.readiness).toBe("SHORTAGE");

    // Update stock level
    updateMaterialStock("100-024-830.01-00", 2500);
    const updatedMat = useAppStore
      .getState()
      .materialsInventory.find((m) => m.sku === "100-024-830.01-00");
    expect(updatedMat?.availableQty).toBe(2500);
  });

  it("exports and imports setup matrix changeover rules via CSV", () => {
    const { exportSetupMatrixRulesCSV, importSetupMatrixRules } = useAppStore.getState();

    const csvOutput = exportSetupMatrixRulesCSV();
    expect(csvOutput).toContain("fromMaterial,toMaterial,machineGroupId,setupTimeMin,description");

    const newRules = [
      { id: "sm-test-1", fromMaterial: "MAT_STEEL", toMaterial: "MAT_ALU", setupTimeMin: 45 },
      { id: "sm-test-2", fromMaterial: "MAT_TITANIUM", toMaterial: "MAT_COPPER", setupTimeMin: 90 },
    ];
    importSetupMatrixRules(newRules);

    const rules = useAppStore.getState().setupMatrixRules;
    const importedRule = rules.find(
      (r) => r.fromMaterial === "MAT_TITANIUM" && r.toMaterial === "MAT_COPPER",
    );
    expect(importedRule?.setupTimeMin).toBe(90);
  });

  it("bulk updates order priorities across multiple orders and processes", () => {
    const { bulkUpdateOrderPriority } = useAppStore.getState();

    useAppStore.setState({
      orders: [
        {
          id: "o1",
          orderId: "WO-101",
          material: "M-A",
          sopStartDate: "2026-06-01",
          sopStartTime: "08:00",
          orderQty: 10,
          priority: "Low",
        },
        {
          id: "o2",
          orderId: "WO-102",
          material: "M-B",
          sopStartDate: "2026-06-01",
          sopStartTime: "08:00",
          orderQty: 20,
          priority: "Low",
        },
        {
          id: "o3",
          orderId: "WO-103",
          material: "M-C",
          sopStartDate: "2026-06-01",
          sopStartTime: "08:00",
          orderQty: 30,
          priority: "Med",
        },
      ],
      processes: [
        {
          id: "WO-101-10",
          orderId: "WO-101",
          processId: 10,
          machineId: "M1",
          processText: "P1",
          baseQty: 1,
          setupTimeMin: 10,
          processTimeMin: 10,
          manpowerUtilizationMin: 1,
          sumV2: 10,
          sumV3: 10,
          totalTimeMin: 20,
          manpowerPct: 0.1,
          status: "UNSCHEDULED",
          scheduledStart: null,
          scheduledEnd: null,
          priority: "Low",
        },
        {
          id: "WO-102-10",
          orderId: "WO-102",
          processId: 10,
          machineId: "M2",
          processText: "P2",
          baseQty: 1,
          setupTimeMin: 10,
          processTimeMin: 10,
          manpowerUtilizationMin: 1,
          sumV2: 10,
          sumV3: 10,
          totalTimeMin: 20,
          manpowerPct: 0.1,
          status: "UNSCHEDULED",
          scheduledStart: null,
          scheduledEnd: null,
          priority: "Low",
        },
      ],
    });

    bulkUpdateOrderPriority(["o1", "o2"], "Urgent");

    const state = useAppStore.getState();
    const updatedO1 = state.orders.find((o) => o.id === "o1");
    const updatedO2 = state.orders.find((o) => o.id === "o2");
    const updatedO3 = state.orders.find((o) => o.id === "o3");

    expect(updatedO1?.priority).toBe("Urgent");
    expect(updatedO2?.priority).toBe("Urgent");
    expect(updatedO3?.priority).toBe("Med");

    const updatedP1 = state.processes.find((p) => p.id === "WO-101-10");
    expect(updatedP1?.priority).toBe("Urgent");
  });

  it("exports and restores full system backup JSON snapshot", () => {
    const { exportSystemBackup, restoreSystemBackup } = useAppStore.getState();

    const exported = exportSystemBackup();
    expect(exported).toBeTruthy();

    const parsed = JSON.parse(exported);
    expect(parsed.version).toBe("0.1-beta");
    expect(parsed.exportedAt).toBeTruthy();
    expect(Array.isArray(parsed.orders)).toBe(true);
    expect(Array.isArray(parsed.processes)).toBe(true);

    const testBackup = JSON.stringify({
      version: "0.1-beta",
      exportedAt: new Date().toISOString(),
      orders: [
        {
          id: "backup-o1",
          orderId: "RESTORE-001",
          material: "TEST-MAT",
          sopStartDate: "2026-07-01",
          orderQty: 999,
        },
      ],
      processes: [
        {
          id: "backup-p1",
          orderId: "RESTORE-001",
          processId: 10,
          machineId: "M1",
          processText: "TEST",
          baseQty: 1,
          setupTimeMin: 10,
          processTimeMin: 10,
          manpowerUtilizationMin: 1,
          sumV2: 10,
          sumV3: 10,
          totalTimeMin: 20,
          manpowerPct: 0.1,
          status: "UNSCHEDULED",
          scheduledStart: null,
          scheduledEnd: null,
        },
      ],
    });

    const res = restoreSystemBackup(testBackup);
    expect(res.success).toBe(true);

    const state = useAppStore.getState();
    expect(state.orders).toHaveLength(1);
    expect(state.orders[0].orderId).toBe("RESTORE-001");
  });
});
