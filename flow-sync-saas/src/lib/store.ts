import { create } from "zustand";
import { persist } from "zustand/middleware";
import Papa from "papaparse";
import {
  Machine,
  MachineGroup,
  Order,
  OrderProcess,
  ScheduleSlot,
  OptimizationMode,
  SetupMatrixRule,
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
  saveMachineToSupabaseDB
} from "./db-service";

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
    keysToRemove.forEach(k => window.localStorage.removeItem(k));
  } catch (e) {
    console.error("LocalStorage cleanup failed:", e);
  }
}

// 1. Full-stack Server Function to fetch process.csv from workspace
export const getCsvSeed = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.resolve(process.cwd(), "process.csv");
      return await fs.promises.readFile(filePath, "utf-8");
    } catch (e) {
      console.error("Failed to read process.csv on server:", e);
      return "";
    }
  });

// Seed static machine data matching Excel screenshots and CSV
export const SEED_GROUPS: MachineGroup[] = [
  { id: "M1", name: "M1" },
  { id: "M2", name: "M2" },
];

export const SEED_MACHINES: Machine[] = [
  { id: "603012", name: "603012", machineGroupId: "M1" },
  { id: "605001", name: "605001", machineGroupId: "M1" },
  { id: "603010", name: "603010", machineGroupId: "M2" },
  { id: "603011", name: "603011", machineGroupId: "M2" },
];

export function parseCSVData(csvText: any) {
  let text = "";
  if (typeof csvText === "string") {
    text = csvText;
  } else if (csvText && typeof csvText === "object") {
    text = csvText.data || csvText.default || csvText.text || JSON.stringify(csvText);
  } else {
    text = String(csvText || "");
  }

  // If double-encoded as a JSON string, unwrap it
  if (text.startsWith('"') && text.endsWith('"') && !text.includes("\n")) {
    try {
      text = JSON.parse(text);
    } catch (_) {}
  }

  const parsed = Papa.parse<any>(text.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  const orders: Order[] = [];
  const processes: OrderProcess[] = [];
  const batchMap = new Map<string, {
    orderCode: string;
    material: string;
    step: number;
    orderQty: number;
    sopStartDate: string;
    sopStartTime: string;
    machineId: string;
    processText: string;
    baseQty: number;
    setupTimeMin: number;
    processTimeMin: number;
    manpowerUtilizationMin: number;
  }>();

  parsed.data.forEach((row) => {
    const orderCode = row["Order"]?.trim();
    const material = row["Material"]?.trim();
    const stepStr = row["Order Process ID"]?.trim();
    if (!orderCode || !material || !stepStr) return;

    const step = parseInt(stepStr, 10) || 10;
    const batchKey = `${orderCode}_${step}`;

    const qtyStr = String(row["Order QTY"] || "0").replace(/,/g, "");
    const qty = parseFloat(qtyStr) || 0;

    const sopDate = row["SOP Start Date"]?.trim() || "";
    const sopTime = row["SOP Start time"]?.trim() || "";

    const existing = batchMap.get(batchKey);
    if (existing) {
      existing.orderQty += qty;
      
      // Update to earliest SOP date
      try {
        const d1 = parseSOPDate(existing.sopStartDate, existing.sopStartTime);
        const d2 = parseSOPDate(sopDate, sopTime);
        if (d2.getTime() < d1.getTime()) {
          existing.sopStartDate = sopDate;
          existing.sopStartTime = sopTime;
        }
      } catch (_) {}
    } else {
      const baseQty = parseFloat(row["Base-Qty each process"]) || 1;
      const setupTimeMin = parseFloat(row["Set up Time (Not related to any qty)"]) || 0;
      const processTimeMin = parseFloat(row["Process time (related to qty)"]) || 0;
      const rawManpowerUtil = row["Manpwer Utilization"] || row["Manpower Utilization"] || "0";
      const manpowerUtilizationMin = parseFloat(String(rawManpowerUtil).replace(/,/g, "")) || 0;

      batchMap.set(batchKey, {
        orderCode,
        material,
        step,
        orderQty: qty,
        sopStartDate: sopDate,
        sopStartTime: sopTime,
        machineId: row["Machine"]?.trim() || "",
        processText: row["Process Text"]?.trim() || "",
        baseQty,
        setupTimeMin,
        processTimeMin,
        manpowerUtilizationMin,
      });
    }
  });

  // Now populate orders and processes
  batchMap.forEach((batch) => {
    // Generate a unique ID for this batch using underscores for order code/step so it parses nicely
    const safeOrderCode = batch.orderCode.replace(/-/g, "_");
    const orderId = `ord-${safeOrderCode}_${batch.step}`;

    // Add to orders
    orders.push({
      id: orderId,
      orderId: batch.orderCode, // e.g. "1019015"
      material: batch.material,
      sopStartDate: batch.sopStartDate,
      sopStartTime: batch.sopStartTime,
      orderQty: batch.orderQty,
    });

    // Confirmed formulas
    const sumV2 = (batch.orderQty / batch.baseQty) * batch.processTimeMin;
    const sumV3 = batch.manpowerUtilizationMin * batch.baseQty * batch.orderQty;
    const manpowerPct = batch.processTimeMin > 0 ? (batch.manpowerUtilizationMin / batch.processTimeMin) : 0;
    const totalTimeMin = batch.setupTimeMin + sumV2;

    processes.push({
      id: `${orderId}-${batch.step}`,
      orderId,
      processId: batch.step,
      machineId: batch.machineId,
      originalMachineId: batch.machineId,
      processText: batch.processText,
      baseQty: batch.baseQty,
      setupTimeMin: batch.setupTimeMin,
      processTimeMin: batch.processTimeMin,
      manpowerUtilizationMin: batch.manpowerUtilizationMin,
      sumV2,
      sumV3,
      totalTimeMin,
      manpowerPct,
      status: "UNSCHEDULED",
      scheduledStart: null,
      scheduledEnd: null,
    });
  });

  return { orders, processes };
}

import { DEFAULT_CSV_CONTENT } from "./default-csv";

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
  true
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

  // Notifications & Activity
  notifications: NotificationItem[];
  addNotification: (notif: { title: string; message: string; type?: "info" | "warning" | "error" | "success" }) => void;
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
    capacities: { setter?: number; process?: number; isHoliday?: boolean }
  ) => void;

  setupMatrixRules: SetupMatrixRule[];
  addSetupMatrixRule: (rule: Omit<SetupMatrixRule, "id">) => void;
  deleteSetupMatrixRule: (id: string) => void;
  
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
    newStartHour: number
  ) => void;
  resetProcessToAuto: (processId: string) => void;
  pinProcessSchedule: (processId: string) => void;
  addWorkOrder: (orderData: {
    orderId: string;
    material: string;
    sopStartDate: string;
    sopStartTime?: string;
    orderQty: number;
    processId: number;
    machineId: string;
    processText: string;
    baseQty?: number;
    setupTimeMin?: number;
    processTimeMin?: number;
    manpowerUtilizationMin?: number;
  }) => void;
  updateStepExecutionStatus: (
    processId: string,
    executionStatus: "PLANNED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "DELAYED",
    completedQty?: number,
    scrapQty?: number,
    notes?: string
  ) => void;
  isCloudSaving: boolean;
  isCloudLoading: boolean;
  saveToCloud: () => Promise<void>;
  loadFromCloud: () => Promise<void>;

  // SaaS States
  user: any | null;
  organization: { id: string; name: string; plan: 'FREE' | 'PRO' | 'ENTERPRISE' } | null;
  role: 'ADMIN' | 'DEVELOPER' | 'GUEST';
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  planChanges: number;
  teamMembers: Array<{ id: string; name: string; email: string; role: 'ADMIN' | 'DEVELOPER' | 'GUEST' }>;
  
  setUser: (user: any | null) => void;
  setOrganization: (org: { id: string; name: string; plan: 'FREE' | 'PRO' | 'ENTERPRISE' } | null) => void;
  setRole: (role: 'ADMIN' | 'DEVELOPER' | 'GUEST') => void;
  setPlan: (plan: 'FREE' | 'PRO' | 'ENTERPRISE') => { success: boolean; message: string };
  setTeamMembers: (members: Array<{ id: string; name: string; email: string; role: 'ADMIN' | 'DEVELOPER' | 'GUEST' }>) => void;
  addTeamMember: (member: { name: string; email: string; role: 'ADMIN' | 'DEVELOPER' | 'GUEST' }) => void;
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
      
      theme: "system",
      setTheme: (theme) => set({ theme }),
      sidebarCollapsed: true,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      commandPaletteOpen: false,
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      tourCompleted: false,
      setTourCompleted: (tourCompleted) => set({ tourCompleted }),

      notifications: [
        {
          id: "welcome-1",
          title: "Welcome to CapaSolve",
          message: "Import a dataset or click 'Load Sample Data' to begin timeline scheduling.",
          type: "info",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: false,
        }
      ],
      addNotification: (notif) => set((s) => ({
        notifications: [
          {
            id: Date.now().toString(),
            title: notif.title,
            message: notif.message,
            type: notif.type || "info",
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            read: false,
          },
          ...s.notifications.slice(0, 20),
        ]
      })),
      markNotificationAsRead: (id) => set((s) => ({
        notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n)
      })),
      clearNotifications: () => set({ notifications: [] }),

      recentActivity: [
        {
          id: "act-1",
          action: "System Initialized",
          timestamp: "Just now",
          details: "CapaSolve manufacturing engine ready."
        }
      ],
      addActivity: (action, details) => set((s) => ({
        recentActivity: [
          {
            id: Date.now().toString(),
            action,
            timestamp: "Just now",
            details
          },
          ...s.recentActivity.slice(0, 15)
        ]
      })),

      user: null,
      organization: null,
      role: "DEVELOPER",
      plan: "FREE",
      planChanges: 0,
      teamMembers: [
        { id: "1", name: "Dev User", email: "dev@factory.com", role: "DEVELOPER" }
      ],
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
        manpower: "Manpower Utilization"
      },
      setColumnMapping: (columnMapping) => set({ columnMapping }),
      setUser: (user) => set({ user }),
      setOrganization: (org) => set((s) => ({ 
        organization: org, 
        plan: org ? org.plan : "FREE"
      })),
      setRole: (role) => set({ role }),
      setPlan: (plan) => {
        const { planChanges } = get();
        if (planChanges >= 3) {
          return { success: false, message: "Demo Limit: You can only change the plan up to 3 times." };
        }
        set((s) => ({ plan, planChanges: s.planChanges + 1 }));
        get().runScheduler();
        return { success: true, message: `Successfully changed plan to ${plan}.` };
      },
      setTeamMembers: (teamMembers) => set({ teamMembers }),
      addTeamMember: (member) => {
        set((s) => ({
          teamMembers: [
            ...s.teamMembers,
            { id: Date.now().toString(), ...member }
          ]
        }));
      },
      removeTeamMember: (id) => {
        set((s) => ({
          teamMembers: s.teamMembers.filter((m) => m.id !== id)
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
          const current = s.dailyCapacities?.[dateStr] || { setter: s.globalSetterCapacity, process: s.globalOperatorCapacity };
          const updated = {
            setter: capacities.setter !== undefined ? capacities.setter : current.setter,
            process: capacities.process !== undefined ? capacities.process : current.process,
            isHoliday: capacities.isHoliday !== undefined ? capacities.isHoliday : current.isHoliday,
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
        { id: "sm-1", fromMaterial: "*", toMaterial: "*", setupTimeMin: 15, description: "Standard Changeover (Default)" },
        { id: "sm-2", fromMaterial: "100-024-830.01-00", toMaterial: "100-024-830.02-00", setupTimeMin: 45, description: "Heavy Die Tooling Changeover" }
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
        set((s: AppState) => ({ setupMatrixRules: (s.setupMatrixRules || []).filter((r: SetupMatrixRule) => r.id !== id) }));
        get().runScheduler();
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

      addWorkOrder: (orderData) => {
        const orderIdStr = String(orderData.orderId).trim();
        const baseQty = orderData.baseQty || 1;
        const setupTimeMin = orderData.setupTimeMin ?? 30;
        const processTimeMin = orderData.processTimeMin ?? 5;
        const manpowerUtilizationMin = orderData.manpowerUtilizationMin ?? 1;
        const sumV2 = (orderData.orderQty / baseQty) * processTimeMin;
        const sumV3 = manpowerUtilizationMin * baseQty * orderData.orderQty;
        const totalTimeMin = setupTimeMin + sumV2;
        const manpowerPct = processTimeMin > 0 ? (manpowerUtilizationMin / processTimeMin) : 0.5;

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
          };
          newOrders.push(existingOrder);
        }

        const newProcess: OrderProcess = {
          id: `proc-${Date.now()}-${orderIdStr}-${orderData.processId}`,
          orderId: orderIdStr,
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

      updateStepExecutionStatus: (processId, executionStatus, completedQty, scrapQty, notes) => {
        set((s) => ({
          processes: s.processes.map((p) => {
            if (p.id === processId || `${p.orderId}-${p.processId}` === processId) {
              return {
                ...p,
                executionStatus,
                completedQty: completedQty !== undefined ? completedQty : p.completedQty,
                scrapQty: scrapQty !== undefined ? scrapQty : p.scrapQty,
                operatorNotes: notes !== undefined ? notes : p.operatorNotes,
              };
            }
            return p;
          }),
        }));
        toast.success(`Updated step status to ${executionStatus}`);
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
        let { orders, processes, machines, optimizationMode, groupSerialization, allowProcessOverlap, allowSopOverride, maxUtilizeResources, dailyCapacities, globalSetterCapacity, globalOperatorCapacity, maxPreponeWeeks } = get();
        if (orders.length === 0) return;
        
        // Self-heal stale persisted state migrations (e.g. "post" -> "full")
        if (optimizationMode !== "pre" && optimizationMode !== "workstation" && optimizationMode !== "full") {
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
          const { data: { session } } = await supabase.auth.getSession();
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

        // Client-side fallback solver if server call was skipped or offline
        if (slots.length === 0) {
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
            get().setupMatrixRules || []
          );
          slots = result.slots;
          warnings = result.warnings;
        }

        // Map slot start/end ranges back to each process
        const processTimeMap = new Map<string, { start: Date; end: Date; machineId: string }>();
        
        slots.forEach((slot) => {
          const slotStart = new Date(`${slot.date}T${String(slot.hourStart).padStart(2, "0")}:00:00`);
          const slotEnd = new Date(slotStart.getTime() + 3600000);
          
          const existing = processTimeMap.get(slot.processId);
          if (!existing) {
            processTimeMap.set(slot.processId, { start: slotStart, end: slotEnd, machineId: slot.machineId });
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
            const startD = new Date(`${newStartDateStr}T${String(newStartHour).padStart(2, "0")}:00:00`);
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
          get().setupMatrixRules || []
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

      pinProcessSchedule: (processId) => {
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
          const dbRes = await syncScheduleToSupabaseDB(organization.id, "Primary Production Plan", payload);

          // 2. Storage backup fallback
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token || "";
          await saveStateToSupabase({ data: { orgId: organization.id, stateJson: JSON.stringify(payload), token } });

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
            const { data: { session } } = await supabase.auth.getSession();
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
    }),
    { name: "mfg-scheduler-v13-store" }
  )
);
