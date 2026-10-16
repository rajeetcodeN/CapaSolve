/**
 * ==============================================================================
 * CapaSolve SaaS — Central State Store (Zustand)
 * ==============================================================================
 * Single source of truth managing:
 * - Orders, Operations, Machine Master Data & Sequence Setup Matrices
 * - High-speed Web Worker background schedule solving
 * - Shop floor MES execution state (Queue, In-Progress, Hold, Scrap)
 * - Material inventory readiness checks
 * - Real-time optimistic updates & Supabase Cloud persistence
 * ==============================================================================
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import Papa from "papaparse";
import {
  Machine,
  MachineGroup,
  Order,
  OrderProcess,
  OrderPriority,
  ScheduleSlot,
  OptimizationMode,
  SetupMatrixRule,
  HoldReason,
  ScrapReason,
  ScrapEntry,
  MaterialReadiness,
  MaterialInventoryItem,
} from "./types";
import { generateSchedule, parseSOPDate } from "./scheduler";
import { ColumnMapping } from "./dataCleaner";
import { createServerFn } from "@tanstack/react-start";
import { saveStateToSupabase, loadStateFromSupabase } from "./supabase.server";
import { toast } from "sonner";
import { supabase } from "./supabase";
import { runOptimizeScheduleServer } from "./api/schedules.server";
import {
  syncScheduleToSupabaseDB,
  fetchScheduleFromSupabaseDB,
  fetchMachinesFromSupabaseDB,
  saveMachineToSupabaseDB,
} from "./db-service";

import { DEFAULT_CSV_CONTENT } from "./default-csv";

import { DEFAULT_MATERIALS_INVENTORY, SEED_GROUPS, SEED_MACHINES } from "./seedData";
import { ExecutionStats, calculateExecutionStats } from "./executionStats";
import { parseCSVData, ParsedCsvResult } from "./csvParser";

import { SolverWorkerInput } from "./solver.worker";

export { DEFAULT_MATERIALS_INVENTORY, SEED_GROUPS, SEED_MACHINES };
export { calculateExecutionStats };
export type { ExecutionStats, ParsedCsvResult };
export { parseCSVData };

/**
 * Offloads compute-intensive finite capacity schedule solving to a background Web Worker,
 * keeping the main React UI thread fluid and responsive at 60 FPS even with 10,000+ operations.
 */
export function runSolverInWorker(
  input: SolverWorkerInput,
): Promise<{ slots: ScheduleSlot[]; warnings: string[] }> {
  return new Promise((resolve, reject) => {
    try {
      if (typeof window === "undefined" || !window.Worker) {
        throw new Error("Workers not supported in this environment");
      }
      const worker = new Worker(new URL("./solver.worker.ts", import.meta.url), { type: "module" });
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error("Solver Worker timed out"));
      }, 30000);

      worker.onmessage = (e) => {
        if (e.data.type === "SUCCESS") {
          clearTimeout(timeout);
          worker.terminate();
          resolve({ slots: e.data.slots, warnings: e.data.warnings || [] });
        } else if (e.data.type === "ERROR") {
          clearTimeout(timeout);
          worker.terminate();
          reject(new Error(e.data.error));
        }
      };

      worker.onerror = (err) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(err);
      };

      worker.postMessage(input);
    } catch (err) {
      reject(err);
    }
  });
}

// Clean up older localStorage store versions to prevent QuotaExceededError
if (typeof window !== "undefined" && window.localStorage) {
  try {
    const currentStoreKey = "mfg-scheduler-v13-store";
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("mfg-scheduler-") && key !== currentStoreKey) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch (e) {
    console.error("LocalStorage cleanup failed:", e);
  }
}

// 1. Full-stack Server Function to fetch process.csv (Serverless safe)
export const getCsvSeed = createServerFn({ method: "GET" }).handler(async () => {
  try {
    // In serverless environments, return bundled production default CSV
    return DEFAULT_CSV_CONTENT;
  } catch (e) {
    console.error("Failed to provide default CSV seed:", e);
    return DEFAULT_CSV_CONTENT;
  }
});

// Seed static machine data matching Excel screenshots and CSV

const initialData = parseCSVData(DEFAULT_CSV_CONTENT);
const initialResult = generateSchedule(
  initialData.orders,
  initialData.processes.map((p) => ({
    ...p,
    status: "UNSCHEDULED" as const,
    scheduledStart: null,
    scheduledEnd: null,
  })),
  SEED_MACHINES,
  "full",
  false,
  true,
  true,
  true,
);

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  timestamp: string;
  read: boolean;
}

export interface ActivityItem {
  id: string;
  action: string;
  timestamp: string;
  details?: string;
}

interface AppState {
  machineGroups: MachineGroup[];
  machines: Machine[];
  orders: Order[];
  processes: OrderProcess[];
  slots: ScheduleSlot[];
  warnings: string[];
  isLoaded: boolean;
  optimizationMode: OptimizationMode;
  groupSerialization: boolean;
  allowProcessOverlap: boolean;
  allowSopOverride: boolean;
  maxUtilizeResources: boolean;
  language: "en" | "de";
  maxPreponeWeeks: number;

  // Theme & UX state
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  tourCompleted: boolean;
  setTourCompleted: (completed: boolean) => void;
  tourOpen: boolean;
  setTourOpen: (open: boolean) => void;

  // Notifications & Activity
  notifications: NotificationItem[];
  addNotification: (notif: {
    title: string;
    message: string;
    type?: "info" | "warning" | "error" | "success";
  }) => void;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;
  recentActivity: ActivityItem[];
  addActivity: (action: string, details?: string) => void;

  globalSetterCapacity: number;
  globalOperatorCapacity: number;
  setGlobalSetterCapacity: (val: number) => void;
  setGlobalOperatorCapacity: (val: number) => void;
  dailyCapacities: Record<string, { setter: number; process: number; isHoliday?: boolean }>;
  setDailyCapacity: (
    dateStr: string,
    capacities: { setter?: number; process?: number; isHoliday?: boolean },
  ) => void;

  setupMatrixRules: SetupMatrixRule[];
  addSetupMatrixRule: (rule: Omit<SetupMatrixRule, "id">) => void;
  deleteSetupMatrixRule: (id: string) => void;
  importSetupMatrixRules: (rules: SetupMatrixRule[]) => void;
  exportSetupMatrixRulesCSV: () => string;

  // Material Stock & Inventory Gating
  materialsInventory: MaterialInventoryItem[];
  setMaterialsInventory: (items: MaterialInventoryItem[]) => void;
  updateMaterialStock: (sku: string, currentStock: number) => void;
  checkMaterialReadiness: (
    materialSku: string,
    requiredQty: number,
  ) => {
    readiness: MaterialReadiness;
    available: number;
    reserved: number;
    required: number;
    shortage: number;
  };

  setOrders: (orders: Order[], processes: OrderProcess[]) => void;
  removeOrder: (id: string) => void;
  clearAll: () => void;
  loadFromCSVText: (csvText: string) => void;
  loadDefaultCSV: () => Promise<void>;
  runScheduler: () => void;
  setOptimizationMode: (mode: OptimizationMode) => void;
  setGroupSerialization: (enabled: boolean) => void;
  setAllowProcessOverlap: (enabled: boolean) => void;
  setAllowSopOverride: (enabled: boolean) => void;
  setMaxUtilizeResources: (enabled: boolean) => void;
  setLanguage: (lang: "en" | "de") => void;
  setMaxPreponeWeeks: (weeks: number) => void;

  // Reschedule interactive update for drag-and-drop
  updateSlotSchedule: (
    processId: string,
    newMachineId: string,
    newStartDateStr: string,
    newStartHour: number,
  ) => void;
  resetProcessToAuto: (processId: string) => void;
  pinProcessSchedule: (processId: string) => void;
  updateOrderPriority: (orderId: string, priority: OrderPriority) => void;
  bulkUpdateOrderPriority: (orderIds: string[], priority: OrderPriority) => void;
  exportSystemBackup: () => string;
  restoreSystemBackup: (jsonContent: string) => { success: boolean; error?: string };
  addWorkOrder: (orderData: {
    orderId: string;
    material: string;
    sopStartDate: string;
    sopStartTime?: string;
    orderQty: number;
    priority?: OrderPriority;
    processId: number;
    machineId: string;
    processText: string;
    baseQty?: number;
    setupTimeMin?: number;
    processTimeMin?: number;
    manpowerUtilizationMin?: number;
  }) => void;
  addWorkOrderWithRouting: (
    orderData: {
      orderId: string;
      material: string;
      sopStartDate: string;
      sopStartTime?: string;
      orderQty: number;
      priority?: OrderPriority;
      customerDueDate?: string;
    },
    steps: {
      processId: number;
      machineId: string;
      processText: string;
      setupTimeMin: number;
      processTimeMin: number;
      manpowerUtilizationMin?: number;
    }[],
  ) => void;
  updateStepExecutionStatus: (
    processId: string,
    executionStatus: "QUEUED" | "PLANNED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "DELAYED",
    completedQty?: number,
    scrapQty?: number,
    notes?: string,
    holdReason?: HoldReason,
    scrapReason?: ScrapReason,
  ) => void;
  logScrap: (processId: string, scrapQty: number, reason: ScrapReason, notes?: string) => void;
  batchUpdateExecutionStatus: (
    processIds: string[],
    executionStatus: "QUEUED" | "PLANNED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "DELAYED",
  ) => void;
  releaseAllScheduled: () => void;
  simulateShopFloorProgress: () => void;
  resetAllExecutionStatuses: () => void;
  isCloudSaving: boolean;
  isCloudLoading: boolean;
  saveToCloud: () => Promise<void>;
  loadFromCloud: () => Promise<void>;

  // SaaS States
  user: any | null;
  organization: { id: string; name: string; plan: "FREE" | "PRO" | "ENTERPRISE" } | null;
  role: "ADMIN" | "DEVELOPER" | "GUEST";
  plan: "FREE" | "PRO" | "ENTERPRISE";
  planChanges: number;
  teamMembers: Array<{
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "DEVELOPER" | "GUEST";
  }>;

  setUser: (user: any | null) => void;
  setOrganization: (
    org: { id: string; name: string; plan: "FREE" | "PRO" | "ENTERPRISE" } | null,
  ) => void;
  setRole: (role: "ADMIN" | "DEVELOPER" | "GUEST") => void;
  setPlan: (plan: "FREE" | "PRO" | "ENTERPRISE") => { success: boolean; message: string };
  setTeamMembers: (
    members: Array<{
      id: string;
      name: string;
      email: string;
      role: "ADMIN" | "DEVELOPER" | "GUEST";
    }>,
  ) => void;
  addTeamMember: (member: {
    name: string;
    email: string;
    role: "ADMIN" | "DEVELOPER" | "GUEST";
  }) => void;
  removeTeamMember: (id: string) => void;

  columnMapping: ColumnMapping;
  setColumnMapping: (mapping: ColumnMapping) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      machineGroups: SEED_GROUPS,
      machines: SEED_MACHINES,
      orders: [],
      processes: [],
      slots: [],
      warnings: [],
      isLoaded: true,
      optimizationMode: "full",
      groupSerialization: false,
      allowProcessOverlap: true,
      allowSopOverride: true,
      maxUtilizeResources: true,
      language: "en",
      maxPreponeWeeks: 0,

      theme: "light",
      setTheme: (theme) => set({ theme }),
      sidebarCollapsed: true,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      commandPaletteOpen: false,
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      tourCompleted: false,
      setTourCompleted: (tourCompleted) => set({ tourCompleted }),
      tourOpen: false,
      setTourOpen: (tourOpen) => set({ tourOpen }),

      notifications: [
        {
          id: "welcome-1",
          title: "Welcome to CapaSolve",
          message: "Import a dataset or click 'Load Sample Data' to begin timeline scheduling.",
          type: "info",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          read: false,
        },
      ],
      addNotification: (notif) =>
        set((s) => ({
          notifications: [
            {
              id: Date.now().toString(),
              title: notif.title,
              message: notif.message,
              type: notif.type || "info",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              read: false,
            },
            ...s.notifications.slice(0, 20),
          ],
        })),
      markNotificationAsRead: (id) =>
        set((s) => ({
          notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      clearNotifications: () => set({ notifications: [] }),

      recentActivity: [
        {
          id: "act-1",
          action: "System Initialized",
          timestamp: "Just now",
          details: "CapaSolve manufacturing engine ready.",
        },
      ],
      addActivity: (action, details) =>
        set((s) => ({
          recentActivity: [
            {
              id: Date.now().toString(),
              action,
              timestamp: "Just now",
              details,
            },
            ...s.recentActivity.slice(0, 15),
          ],
        })),

      user: null,
      organization: null,
      role: "DEVELOPER",
      plan: "FREE",
      planChanges: 0,
      teamMembers: [{ id: "1", name: "Dev User", email: "dev@factory.com", role: "DEVELOPER" }],
      columnMapping: {
        order: "Order",
        material: "Material",
        processId: "Order Process ID",
        qty: "Order QTY",
        sopStartDate: "SOP Start Date",
        machine: "Machine",
        setupTime: "Set up Time (Not related to any qty)",
        processTime: "Process time (related to qty)",
        baseQty: "Base-Qty each process",
        manpower: "Manpower Utilization",
      },
      setColumnMapping: (columnMapping) => set({ columnMapping }),
      setUser: (user) => set({ user }),
      setOrganization: (org) =>
        set((s) => ({
          organization: org,
          plan: org ? org.plan : "FREE",
        })),
      setRole: (role) => set({ role }),
      setPlan: (plan) => {
        const { planChanges } = get();
        if (planChanges >= 3) {
          return {
            success: false,
            message: "Demo Limit: You can only change the plan up to 3 times.",
          };
        }
        set((s) => ({ plan, planChanges: s.planChanges + 1 }));
        get().runScheduler();
        return { success: true, message: `Successfully changed plan to ${plan}.` };
      },
      setTeamMembers: (teamMembers) => set({ teamMembers }),
      addTeamMember: (member) => {
        set((s) => ({
          teamMembers: [...s.teamMembers, { id: Date.now().toString(), ...member }],
        }));
      },
      removeTeamMember: (id) => {
        set((s) => ({
          teamMembers: s.teamMembers.filter((m) => m.id !== id),
        }));
      },
      globalSetterCapacity: 100,
      globalOperatorCapacity: 200,
      setGlobalSetterCapacity: (val) => {
        set({ globalSetterCapacity: val });
        get().runScheduler();
      },
      setGlobalOperatorCapacity: (val) => {
        set({ globalOperatorCapacity: val });
        get().runScheduler();
      },
      dailyCapacities: {},

      setDailyCapacity: (dateStr, capacities) => {
        set((s) => {
          const current = s.dailyCapacities?.[dateStr] || {
            setter: s.globalSetterCapacity,
            process: s.globalOperatorCapacity,
          };
          const updated = {
            setter: capacities.setter !== undefined ? capacities.setter : current.setter,
            process: capacities.process !== undefined ? capacities.process : current.process,
            isHoliday:
              capacities.isHoliday !== undefined ? capacities.isHoliday : current.isHoliday,
          };
          if (updated.isHoliday) {
            updated.setter = 0;
            updated.process = 0;
          }
          return {
            dailyCapacities: {
              ...(s.dailyCapacities || {}),
              [dateStr]: updated,
            },
          };
        });
        get().runScheduler();
      },

      setupMatrixRules: [
        {
          id: "sm-1",
          fromMaterial: "*",
          toMaterial: "*",
          setupTimeMin: 15,
          description: "Standard Changeover (Default)",
        },
        {
          id: "sm-2",
          fromMaterial: "100-024-830.01-00",
          toMaterial: "100-024-830.02-00",
          setupTimeMin: 45,
          description: "Heavy Die Tooling Changeover",
        },
      ],
      addSetupMatrixRule: (rule: Omit<SetupMatrixRule, "id">) => {
        const newRule: SetupMatrixRule = {
          id: `sm-${Date.now()}`,
          ...rule,
        };
        set((s: AppState) => ({ setupMatrixRules: [...(s.setupMatrixRules || []), newRule] }));
        get().runScheduler();
      },
      deleteSetupMatrixRule: (id: string) => {
        set((s: AppState) => ({
          setupMatrixRules: (s.setupMatrixRules || []).filter((r: SetupMatrixRule) => r.id !== id),
        }));
        get().runScheduler();
      },
      importSetupMatrixRules: (rules: SetupMatrixRule[]) => {
        set({ setupMatrixRules: rules });
        get().runScheduler();
        toast.success(`Successfully imported ${rules.length} setup matrix rules.`);
      },
      exportSetupMatrixRulesCSV: () => {
        const rules = get().setupMatrixRules || [];
        const headers = "fromMaterial,toMaterial,machineGroupId,setupTimeMin,description\n";
        const rows = rules
          .map(
            (r) =>
              `"${r.fromMaterial}","${r.toMaterial}","${r.machineGroupId || ""}","${r.setupTimeMin}","${(r.description || "").replace(/"/g, '""')}"`,
          )
          .join("\n");
        return headers + rows;
      },

      materialsInventory: DEFAULT_MATERIALS_INVENTORY,
      setMaterialsInventory: (items: MaterialInventoryItem[]) => {
        set({ materialsInventory: items });
      },
      updateMaterialStock: (sku: string, currentStock: number) => {
        set((s) => ({
          materialsInventory: s.materialsInventory.map((item) =>
            item.sku === sku ? { ...item, availableQty: currentStock } : item,
          ),
        }));
      },
      checkMaterialReadiness: (materialSku: string, requiredQty: number) => {
        const inventory = get().materialsInventory || [];
        const cleanSku = (materialSku || "").trim().toLowerCase();
        const item = inventory.find(
          (m) =>
            m.sku.toLowerCase() === cleanSku ||
            cleanSku.includes(m.sku.toLowerCase()) ||
            m.sku.toLowerCase().includes(cleanSku),
        );

        if (!item) {
          return {
            readiness: "READY" as MaterialReadiness,
            available: requiredQty * 2,
            reserved: 0,
            required: requiredQty,
            shortage: 0,
          };
        }

        const available = Math.max(0, item.availableQty - (item.reservedQty || 0));
        if (available >= requiredQty) {
          return {
            readiness: "READY" as MaterialReadiness,
            available,
            reserved: item.reservedQty || 0,
            required: requiredQty,
            shortage: 0,
          };
        } else if (available > 0) {
          return {
            readiness: "LOW_STOCK" as MaterialReadiness,
            available,
            reserved: item.reservedQty || 0,
            required: requiredQty,
            shortage: requiredQty - available,
          };
        } else {
          return {
            readiness: "SHORTAGE" as MaterialReadiness,
            available: 0,
            reserved: item.reservedQty || 0,
            required: requiredQty,
            shortage: requiredQty,
          };
        }
      },

      setOptimizationMode: (mode) => {
        set({ optimizationMode: mode });
        get().runScheduler();
      },

      setGroupSerialization: (enabled) => {
        set({ groupSerialization: enabled });
        get().runScheduler();
      },

      setAllowProcessOverlap: (enabled) => {
        set({ allowProcessOverlap: enabled });
        get().runScheduler();
      },

      setAllowSopOverride: (enabled) => {
        set({ allowSopOverride: enabled });
        get().runScheduler();
      },

      setMaxUtilizeResources: (enabled) => {
        set({ maxUtilizeResources: enabled });
        get().runScheduler();
      },

      setLanguage: (lang) => {
        set({ language: lang });
      },

      setMaxPreponeWeeks: (weeks) => {
        set({ maxPreponeWeeks: weeks });
        get().runScheduler();
      },

      setOrders: (orders, processes) => {
        set({ orders, processes, slots: [], warnings: [] });
      },

      removeOrder: (id) => {
        set((s) => ({
          orders: s.orders.filter((o) => o.id !== id),
          processes: s.processes.filter((p) => p.orderId !== id),
          slots: s.slots.filter((sl) => !sl.processId.startsWith(id)),
        }));
        get().runScheduler();
      },

      clearAll: () => {
        set({ orders: [], processes: [], slots: [], warnings: [] });
      },

      updateOrderPriority: (orderId: string, priority: OrderPriority) => {
        const targetId = orderId.trim();
        const updatedOrders = get().orders.map((o) => {
          if (o.id === targetId || o.orderId === targetId) {
            return { ...o, priority };
          }
          return o;
        });

        const updatedProcesses = get().processes.map((p) => {
          if (p.orderId === targetId || p.id.startsWith(targetId)) {
            return { ...p, priority };
          }
          return p;
        });

        set({ orders: updatedOrders, processes: updatedProcesses });
        get().addActivity("Priority Changed", `Order ${targetId} priority set to ${priority}`);
        toast.success(`Priority updated to ${priority} for Order ${targetId}`);
        get().runScheduler();
      },

      bulkUpdateOrderPriority: (orderIds: string[], priority: OrderPriority) => {
        if (!orderIds || orderIds.length === 0) return;
        const targetIds = new Set(orderIds.map((id) => id.trim()));
        get().orders.forEach((o) => {
          if (targetIds.has(o.id) || targetIds.has(o.orderId)) {
            targetIds.add(o.id);
            targetIds.add(o.orderId);
          }
        });
        const updatedOrders = get().orders.map((o) => {
          if (targetIds.has(o.id) || targetIds.has(o.orderId)) {
            return { ...o, priority };
          }
          return o;
        });

        const updatedProcesses = get().processes.map((p) => {
          if (targetIds.has(p.orderId) || [...targetIds].some((id) => p.id.startsWith(id))) {
            return { ...p, priority };
          }
          return p;
        });

        set({ orders: updatedOrders, processes: updatedProcesses });
        get().addActivity(
          "Bulk Priority Changed",
          `Updated priority to ${priority} for ${orderIds.length} orders`,
        );
        toast.success(`Updated priority to ${priority} for ${orderIds.length} orders`);
        get().runScheduler();
      },

      addWorkOrder: (orderData) => {
        const orderIdStr = String(orderData.orderId).trim();
        const baseQty = orderData.baseQty || 1;
        const setupTimeMin = orderData.setupTimeMin ?? 30;
        const processTimeMin = orderData.processTimeMin ?? 5;
        const manpowerUtilizationMin = orderData.manpowerUtilizationMin ?? 1;
        const sumV2 = (orderData.orderQty / baseQty) * processTimeMin;
        const sumV3 = manpowerUtilizationMin * baseQty * orderData.orderQty;
        const totalTimeMin = setupTimeMin + sumV2;
        const manpowerPct = processTimeMin > 0 ? manpowerUtilizationMin / processTimeMin : 0.5;
        const priority: OrderPriority = orderData.priority || "Med";

        let existingOrder = get().orders.find((o) => o.orderId === orderIdStr);
        let newOrders = [...get().orders];
        if (!existingOrder) {
          existingOrder = {
            id: `ord-${Date.now()}-${orderIdStr}`,
            orderId: orderIdStr,
            material: orderData.material,
            sopStartDate: orderData.sopStartDate || new Date().toISOString(),
            sopStartTime: orderData.sopStartTime || "08:00:00",
            orderQty: orderData.orderQty,
            priority,
          };
          newOrders.push(existingOrder);
        } else if (orderData.priority) {
          existingOrder.priority = orderData.priority;
        }

        const newProcess: OrderProcess = {
          id: `proc-${Date.now()}-${orderIdStr}-${orderData.processId}`,
          orderId: orderIdStr,
          priority: existingOrder.priority || priority,
          processId: Number(orderData.processId),
          machineId: orderData.machineId,
          originalMachineId: orderData.machineId,
          processText: orderData.processText || `OPERATION STEP ${orderData.processId}`,
          baseQty,
          setupTimeMin,
          processTimeMin,
          manpowerUtilizationMin,
          sumV2,
          sumV3,
          totalTimeMin,
          manpowerPct,
          status: "UNSCHEDULED",
          scheduledStart: null,
          scheduledEnd: null,
          executionStatus: "PLANNED",
          completedQty: 0,
          scrapQty: 0,
        };

        set({
          orders: newOrders,
          processes: [...get().processes, newProcess],
        });
        toast.success(`Created Work Order ${orderIdStr} Step ${orderData.processId}`);
        get().runScheduler();
      },

      addWorkOrderWithRouting: (orderData, steps) => {
        const orderIdStr = String(orderData.orderId).trim();
        const priority: OrderPriority = orderData.priority || "Med";

        let existingOrder = get().orders.find((o) => o.orderId === orderIdStr);
        let newOrders = [...get().orders];
        if (!existingOrder) {
          const created: Order = {
            id: `ord-${Date.now()}-${orderIdStr}`,
            orderId: orderIdStr,
            material: orderData.material,
            sopStartDate: orderData.sopStartDate || new Date().toISOString(),
            sopStartTime: orderData.sopStartTime || "08:00:00",
            orderQty: orderData.orderQty,
            priority,
            customerDueDate: orderData.customerDueDate,
          };
          existingOrder = created;
          newOrders.push(created);
        } else {
          existingOrder.orderQty = orderData.orderQty;
          existingOrder.material = orderData.material;
          if (orderData.priority) existingOrder.priority = orderData.priority;
          if (orderData.customerDueDate) existingOrder.customerDueDate = orderData.customerDueDate;
        }

        const newProcesses: OrderProcess[] = steps.map((step) => {
          const baseQty = 1;
          const setupTimeMin = Number(step.setupTimeMin) || 0;
          const processTimeMin = Number(step.processTimeMin) || 1;
          const manpowerUtilizationMin = Number(step.manpowerUtilizationMin) || 1;
          const sumV2 = (orderData.orderQty / baseQty) * processTimeMin;
          const sumV3 = manpowerUtilizationMin * baseQty * orderData.orderQty;
          const totalTimeMin = setupTimeMin + sumV2;
          const manpowerPct = processTimeMin > 0 ? manpowerUtilizationMin / processTimeMin : 0.5;

          return {
            id: `proc-${Date.now()}-${orderIdStr}-${step.processId}`,
            orderId: orderIdStr,
            priority: existingOrder?.priority || priority,
            processId: Number(step.processId),
            machineId: step.machineId,
            originalMachineId: step.machineId,
            processText: step.processText || `OPERATION STEP ${step.processId}`,
            baseQty,
            setupTimeMin,
            processTimeMin,
            manpowerUtilizationMin,
            sumV2,
            sumV3,
            totalTimeMin,
            manpowerPct,
            status: "UNSCHEDULED",
            scheduledStart: null,
            scheduledEnd: null,
            executionStatus: "PLANNED",
            completedQty: 0,
            scrapQty: 0,
          };
        });

        // Filter out existing processes with the same orderId and processId if replacing
        const existingIds = new Set(newProcesses.map((p) => `${p.orderId}-${p.processId}`));
        const filteredProcesses = get().processes.filter(
          (p) => !existingIds.has(`${p.orderId}-${p.processId}`),
        );

        set({
          orders: newOrders,
          processes: [...filteredProcesses, ...newProcesses],
        });

        toast.success(
          `Created Work Order ${orderIdStr} with ${steps.length} sequential operations.`,
        );
        get().runScheduler();
      },

      updateStepExecutionStatus: (
        processId,
        executionStatus,
        completedQty,
        scrapQty,
        notes,
        holdReason,
        scrapReason,
      ) => {
        set((s) => ({
          processes: s.processes.map((p) => {
            if (p.id === processId || `${p.orderId}-${p.processId}` === processId) {
              return {
                ...p,
                executionStatus,
                completedQty: completedQty !== undefined ? completedQty : p.completedQty,
                scrapQty: scrapQty !== undefined ? scrapQty : p.scrapQty,
                operatorNotes: notes !== undefined ? notes : p.operatorNotes,
                holdReason: holdReason !== undefined ? holdReason : p.holdReason,
                scrapReason: scrapReason !== undefined ? scrapReason : p.scrapReason,
              };
            }
            return p;
          }),
        }));
        toast.success(`Updated step status to ${executionStatus}`);
      },

      logScrap: (processId, scrapQty, reason, notes) => {
        const newEntry: ScrapEntry = {
          id: `scrap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          orderId: "",
          processId: 0,
          machineId: "",
          scrapQty,
          reason,
          notes,
          loggedBy: get().role || "Operator",
        };
        set((s) => ({
          processes: s.processes.map((p) => {
            if (p.id === processId || `${p.orderId}-${p.processId}` === processId) {
              const history = p.scrapHistory ? [...p.scrapHistory] : [];
              newEntry.orderId = p.orderId;
              newEntry.processId = p.processId;
              newEntry.machineId = p.machineId;
              history.push(newEntry);
              return {
                ...p,
                scrapQty: (p.scrapQty || 0) + scrapQty,
                scrapReason: reason,
                scrapHistory: history,
              };
            }
            return p;
          }),
        }));
        toast.error(`Logged ${scrapQty} scrap units (${reason})`);
      },

      batchUpdateExecutionStatus: (processIds, executionStatus) => {
        const idSet = new Set(processIds);
        set((s) => ({
          processes: s.processes.map((p) => {
            if (idSet.has(p.id) || idSet.has(`${p.orderId}-${p.processId}`)) {
              return { ...p, executionStatus };
            }
            return p;
          }),
        }));
        toast.success(`Updated ${processIds.length} operations to ${executionStatus}`);
      },

      releaseAllScheduled: () => {
        set((s) => ({
          processes: s.processes.map((p) => {
            if (p.status === "SCHEDULED") {
              return { ...p, executionStatus: "PLANNED" };
            }
            return { ...p, executionStatus: "QUEUED" };
          }),
        }));
        toast.success("Released all scheduled operations to the shop floor queue!");
      },

      simulateShopFloorProgress: () => {
        const { processes, orders } = get();
        if (processes.length === 0) {
          toast.error("No operations loaded to simulate.");
          return;
        }

        const updated = processes.map((p, idx) => {
          const parentOrder = orders.find((o) => o.id === p.orderId || o.orderId === p.orderId);
          const orderQty = parentOrder?.orderQty || 100;

          if (idx === 0 || idx === 1) {
            // First 2 completed
            return {
              ...p,
              executionStatus: "COMPLETED" as const,
              completedQty: orderQty,
              scrapQty: 0,
            };
          } else if (idx === 2 || idx === 3 || idx === 4) {
            // Next 3 actively running
            return {
              ...p,
              executionStatus: "IN_PROGRESS" as const,
              completedQty: Math.round(orderQty * 0.45),
              scrapQty: 2,
            };
          } else if (idx === 5) {
            // 1 on hold (e.g. tool change / inspection)
            return {
              ...p,
              executionStatus: "PAUSED" as const,
              completedQty: Math.round(orderQty * 0.1),
              operatorNotes: "Tool calibration in progress",
            };
          } else if (p.status === "SCHEDULED") {
            // Remaining scheduled are released
            return {
              ...p,
              executionStatus: "PLANNED" as const,
              completedQty: 0,
            };
          } else {
            return {
              ...p,
              executionStatus: "QUEUED" as const,
              completedQty: 0,
            };
          }
        });

        set({ processes: updated });
        toast.success(
          "Simulated active shop floor progress: 2 Done, 3 Running, 1 Hold, Released ready",
        );
      },

      resetAllExecutionStatuses: () => {
        set((s) => ({
          processes: s.processes.map((p) => ({
            ...p,
            executionStatus: p.status === "SCHEDULED" ? "PLANNED" : "QUEUED",
            completedQty: 0,
            scrapQty: 0,
            operatorNotes: undefined,
          })),
        }));
        toast.info("Reset all operations to initial status.");
      },

      loadFromCSVText: (csvText) => {
        const { orders, processes } = parseCSVData(csvText);
        set({ orders, processes, isLoaded: true });
        get().runScheduler();
      },

      loadDefaultCSV: async () => {
        try {
          const csvText = await getCsvSeed();
          if (csvText) {
            get().loadFromCSVText(csvText);
            return;
          }
        } catch (_) {}
        // Fallback to static bundled CSV content
        get().loadFromCSVText(DEFAULT_CSV_CONTENT);
      },

      runScheduler: async () => {
        let {
          orders,
          processes,
          machines,
          optimizationMode,
          groupSerialization,
          allowProcessOverlap,
          allowSopOverride,
          maxUtilizeResources,
          dailyCapacities,
          globalSetterCapacity,
          globalOperatorCapacity,
          maxPreponeWeeks,
        } = get();
        if (orders.length === 0) return;

        // Self-heal stale persisted state migrations (e.g. "post" -> "full")
        if (
          optimizationMode !== "pre" &&
          optimizationMode !== "workstation" &&
          optimizationMode !== "full"
        ) {
          optimizationMode = "full";
          set({ optimizationMode: "full" });
        }

        // Reset processes status before scheduling, preserving manual overrides
        const resetProcesses = processes.map((p) => {
          if (p.isManual) {
            return p;
          }
          return {
            ...p,
            machineId: p.originalMachineId || p.machineId,
            status: "UNSCHEDULED" as const,
            scheduledStart: null,
            scheduledEnd: null,
          };
        });

        // Check if an active Supabase session is present
        let slots: ScheduleSlot[] = [];
        let warnings: string[] = [];

        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (session?.access_token) {
            const serverRes = await runOptimizeScheduleServer({
              data: {
                token: session.access_token,
                orders,
                processes: resetProcesses,
                machines,
                optimizeMode: optimizationMode as any,
                groupSerialization,
                allowProcessOverlap,
                allowSopOverride,
                maxUtilizeResources,
                dailyCapacities: dailyCapacities || {},
                globalSetterCapacity,
                globalOperatorCapacity,
                maxPreponeWeeks: maxPreponeWeeks || 0,
              },
            });

            if (serverRes.success && serverRes.slots) {
              slots = serverRes.slots;
              warnings = serverRes.warnings || [];
            }
          }
        } catch (err) {
          console.warn("Server-side optimization unavailable, falling back to client solver:", err);
        }

        // Client-side solver (Web Worker for large datasets, synchronous fallback for small/unsupported)
        if (slots.length === 0) {
          const solverPayload = {
            orders,
            processes: resetProcesses,
            machines,
            optimizationMode,
            groupSerialization,
            allowProcessOverlap,
            allowSopOverride,
            maxUtilizeResources,
            dailyCapacities: dailyCapacities || {},
            globalSetterCapacity,
            globalOperatorCapacity,
            maxPreponeWeeks: maxPreponeWeeks || 0,
            rules: get().setupMatrixRules || [],
          };

          let workerRanSuccessfully = false;
          if (typeof window !== "undefined" && window.Worker && orders.length > 40) {
            try {
              const workerResult = await runSolverInWorker(solverPayload);
              slots = workerResult.slots;
              warnings = workerResult.warnings;
              workerRanSuccessfully = true;
            } catch (workerErr) {
              console.warn("Solver worker failed, using synchronous fallback:", workerErr);
            }
          }

          if (!workerRanSuccessfully) {
            const result = generateSchedule(
              orders,
              resetProcesses,
              machines,
              optimizationMode,
              groupSerialization,
              allowProcessOverlap,
              allowSopOverride,
              maxUtilizeResources,
              dailyCapacities || {},
              globalSetterCapacity,
              globalOperatorCapacity,
              maxPreponeWeeks || 0,
              get().setupMatrixRules || [],
            );
            slots = result.slots;
            warnings = result.warnings;
          }
        }

        // Map slot start/end ranges back to each process
        const processTimeMap = new Map<string, { start: Date; end: Date; machineId: string }>();

        slots.forEach((slot) => {
          const slotStart = new Date(
            `${slot.date}T${String(slot.hourStart).padStart(2, "0")}:00:00`,
          );
          const slotEnd = new Date(slotStart.getTime() + 3600000);

          const existing = processTimeMap.get(slot.processId);
          if (!existing) {
            processTimeMap.set(slot.processId, {
              start: slotStart,
              end: slotEnd,
              machineId: slot.machineId,
            });
          } else {
            if (slotStart < existing.start) existing.start = slotStart;
            if (slotEnd > existing.end) existing.end = slotEnd;
          }
        });

        const finalProcesses = resetProcesses.map((p) => {
          const timeInfo = processTimeMap.get(p.id);
          if (timeInfo) {
            return {
              ...p,
              machineId: timeInfo.machineId,
              status: "SCHEDULED" as const,
              scheduledStart: timeInfo.start.toISOString(),
              scheduledEnd: timeInfo.end.toISOString(),
            };
          }
          return p;
        });

        set({
          processes: finalProcesses,
          slots,
          warnings,
        });
      },

      updateSlotSchedule: (processId, newMachineId, newStartDateStr, newStartHour) => {
        const { processes, slots, machines } = get();

        // Update the machine and manual scheduled date of the target process
        const updatedProcesses = processes.map((p) => {
          if (p.id === processId) {
            const startD = new Date(
              `${newStartDateStr}T${String(newStartHour).padStart(2, "0")}:00:00`,
            );
            const endD = new Date(startD.getTime() + Math.ceil(p.totalTimeMin / 60) * 3600000);
            return {
              ...p,
              machineId: newMachineId,
              status: "SCHEDULED" as const,
              scheduledStart: startD.toISOString(),
              scheduledEnd: endD.toISOString(),
              isManual: true,
            };
          }
          return p;
        });

        // Re-generate slots based on updated dates and check manpower stacking limits
        const orderMap = new Map<string, Order>();
        get().orders.forEach((o) => orderMap.set(o.id, o));

        let activeMode = get().optimizationMode;
        if (activeMode !== "pre" && activeMode !== "workstation" && activeMode !== "full") {
          activeMode = "full";
          set({ optimizationMode: "full" });
        }

        const result = generateSchedule(
          get().orders,
          updatedProcesses,
          machines,
          activeMode,
          get().groupSerialization,
          get().allowProcessOverlap,
          get().allowSopOverride,
          get().maxUtilizeResources,
          get().dailyCapacities || {},
          get().globalSetterCapacity,
          get().globalOperatorCapacity,
          get().maxPreponeWeeks || 0,
          get().setupMatrixRules || [],
        );

        let finalSlots = result.slots;
        let finalProcesses = updatedProcesses;

        set({
          processes: finalProcesses,
          slots: finalSlots,
          warnings: result.warnings,
        });
      },

      resetProcessToAuto: (processId) => {
        set((s) => ({
          processes: s.processes.map((p) => {
            if (p.id === processId) {
              return {
                ...p,
                machineId: p.originalMachineId || p.machineId,
                status: "UNSCHEDULED" as const,
                scheduledStart: null,
                scheduledEnd: null,
                isManual: false,
              };
            }
            return p;
          }),
        }));
        get().runScheduler();
      },

      pinProcessSchedule: (processId: string) => {
        set((s) => ({
          processes: s.processes.map((p) => {
            if (p.id === processId) {
              return {
                ...p,
                isManual: true,
              };
            }
            return p;
          }),
        }));
        get().runScheduler();
      },

      isCloudSaving: false,
      isCloudLoading: false,

      saveToCloud: async () => {
        const {
          orders,
          processes,
          optimizationMode,
          groupSerialization,
          allowProcessOverlap,
          allowSopOverride,
          maxUtilizeResources,
          language,
          maxPreponeWeeks,
          globalSetterCapacity,
          globalOperatorCapacity,
          dailyCapacities,
          organization,
        } = get();

        if (!organization) {
          toast.error("No active organization found to save schedule to.");
          return;
        }

        set({ isCloudSaving: true });

        try {
          const payload = {
            orders,
            processes,
            optimizationMode,
            groupSerialization,
            allowProcessOverlap,
            allowSopOverride,
            maxUtilizeResources,
            language,
            maxPreponeWeeks,
            globalSetterCapacity,
            globalOperatorCapacity,
            dailyCapacities,
          };

          // 1. Sync to Supabase Database Tables (schedules + schedule_data + scheduler_configs)
          const dbRes = await syncScheduleToSupabaseDB(
            organization.id,
            "Primary Production Plan",
            payload,
          );

          // 2. Storage backup fallback
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const token = session?.access_token || "";
          await saveStateToSupabase({
            data: { orgId: organization.id, stateJson: JSON.stringify(payload), token },
          });

          if (dbRes.success) {
            toast.success("Successfully saved schedule to Supabase Database!");
          } else {
            console.error("Supabase DB Save Warning:", dbRes.error);
            toast.success("Saved schedule to cloud storage!");
          }
        } catch (err) {
          console.error("Cloud save exception:", err);
          toast.error("An error occurred while saving to Supabase.");
        } finally {
          set({ isCloudSaving: false });
        }
      },

      loadFromCloud: async () => {
        const { organization } = get();
        if (!organization) {
          toast.error("No active organization found to load schedule from.");
          return;
        }

        set({ isCloudLoading: true });
        try {
          // 1. First attempt to load from Supabase Database Tables
          const dbRes = await fetchScheduleFromSupabaseDB(organization.id);
          let state = dbRes.data;

          // 2. Fallback to Storage JSON if DB data not found
          if (!state) {
            const {
              data: { session },
            } = await supabase.auth.getSession();
            const token = session?.access_token || "";
            const res = await loadStateFromSupabase({ data: { orgId: organization.id, token } });
            if (res.success && res.data) {
              state = JSON.parse(res.data);
            }
          }

          if (state) {
            set({
              orders: state.orders || [],
              processes: state.processes || [],
              optimizationMode: (state.optimizationMode as OptimizationMode) || "full",
              groupSerialization: state.groupSerialization ?? false,
              allowProcessOverlap: state.allowProcessOverlap ?? true,
              allowSopOverride: state.allowSopOverride ?? true,
              maxUtilizeResources: state.maxUtilizeResources ?? true,
              language: state.language || "en",
              maxPreponeWeeks: state.maxPreponeWeeks || 0,
              globalSetterCapacity: state.globalSetterCapacity ?? 100,
              globalOperatorCapacity: state.globalOperatorCapacity ?? 200,
              dailyCapacities: state.dailyCapacities || {},
            });

            get().runScheduler();
            toast.success("Successfully loaded schedule from Supabase Database!");
          } else {
            toast.info("No saved schedule found in Supabase.");
          }
        } catch (err) {
          console.error("Cloud load exception:", err);
          toast.error("An error occurred while loading from Supabase.");
        } finally {
          set({ isCloudLoading: false });
        }
      },

      exportSystemBackup: () => {
        const s = get();
        const payload = {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          metadata: {
            totalOrders: s.orders.length,
            totalProcesses: s.processes.length,
            totalRules: (s.setupMatrixRules || []).length,
            totalInventory: (s.materialsInventory || []).length,
          },
          orders: s.orders,
          processes: s.processes,
          setupMatrixRules: s.setupMatrixRules || [],
          materialsInventory: s.materialsInventory || [],
          dailyCapacities: s.dailyCapacities || {},
          machines: s.machines || [],
          machineGroups: s.machineGroups || [],
          globalSetterCapacity: s.globalSetterCapacity,
          globalOperatorCapacity: s.globalOperatorCapacity,
          optimizationMode: s.optimizationMode,
          groupSerialization: s.groupSerialization,
          allowProcessOverlap: s.allowProcessOverlap,
          allowSopOverride: s.allowSopOverride,
          maxUtilizeResources: s.maxUtilizeResources,
        };
        return JSON.stringify(payload, null, 2);
      },

      restoreSystemBackup: (jsonContent: string) => {
        try {
          const data = JSON.parse(jsonContent);
          if (!data || typeof data !== "object") {
            throw new Error("Invalid file content: Not a valid JSON object.");
          }
          if (!Array.isArray(data.orders) && !Array.isArray(data.processes)) {
            throw new Error("Invalid backup format: Must contain orders or processes array.");
          }

          const updates: Partial<AppState> = {};
          if (Array.isArray(data.orders)) updates.orders = data.orders;
          if (Array.isArray(data.processes)) updates.processes = data.processes;
          if (Array.isArray(data.setupMatrixRules))
            updates.setupMatrixRules = data.setupMatrixRules;
          if (Array.isArray(data.materialsInventory))
            updates.materialsInventory = data.materialsInventory;
          if (data.dailyCapacities && typeof data.dailyCapacities === "object") {
            updates.dailyCapacities = data.dailyCapacities;
          }
          if (Array.isArray(data.machines) && data.machines.length > 0) {
            updates.machines = data.machines;
          }
          if (Array.isArray(data.machineGroups) && data.machineGroups.length > 0) {
            updates.machineGroups = data.machineGroups;
          }
          if (typeof data.globalSetterCapacity === "number") {
            updates.globalSetterCapacity = data.globalSetterCapacity;
          }
          if (typeof data.globalOperatorCapacity === "number") {
            updates.globalOperatorCapacity = data.globalOperatorCapacity;
          }
          if (data.optimizationMode) {
            updates.optimizationMode = data.optimizationMode;
          }

          set(updates);
          get().addActivity(
            "System Restored",
            `Restored backup with ${updates.orders?.length || 0} orders and full configuration`,
          );
          get().runScheduler();
          return { success: true };
        } catch (err: any) {
          console.error("Backup restore error:", err);
          return { success: false, error: err.message || "Failed to restore backup." };
        }
      },
    }),
    { name: "mfg-scheduler-v13-store" },
  ),
);
