export type ProcessKind = "R" | "M" | "P";
export type OptimizationMode = "pre" | "workstation" | "full";

export interface MachineGroup {
  id: string; // e.g. "M1", "M2"
  name: string;
}

export interface Machine {
  id: string; // e.g. "603011"
  name: string; // e.g. "603011"
  machineGroupId: string;
}

export interface SetupMatrixRule {
  id: string;
  fromMaterial: string; // Material pattern or "*" for any
  toMaterial: string;   // Material pattern or "*" for any
  machineGroupId?: string; // Optional machine group filter
  setupTimeMin: number;   // Dynamic setup time in minutes
  description?: string;
}

export interface Order {
  id: string; // generated e.g. "imp-12345"
  orderId: string; // e.g. "1023811" (from CSV)
  material: string; // e.g. "100-024-830.01-00"
  sopStartDate: string; // ISO string Date (e.g. "2026-06-01T00:00:00.000Z")
  sopStartTime: string; // e.g. "09:49:45"
  orderQty: number; // e.g. 104
}

export interface OrderProcess {
  id: string; // generated e.g. "imp-12345-40"
  orderId: string;
  processId: number; // step number e.g. 20, 40, 60
  machineId: string; // target machine ID
  originalMachineId?: string; // original machine from CSV
  processText: string; // e.g. "FRÄSEN"
  baseQty: number; // e.g. 3
  setupTimeMin: number; // R
  processTimeMin: number; // M
  manpowerUtilizationMin: number; // e.g. 1.95 (operator-minutes needed per base-batch unit)
  sumV2: number; // calculated: (orderQty / baseQty) * processTimeMin
  sumV3: number; // calculated: manpowerUtilizationMin * baseQty * orderQty
  totalTimeMin: number; // calculated: setupTimeMin + sumV2
  manpowerPct: number; // e.g. 0.30 for 30%, calculated as manpowerUtilizationMin / processTimeMin
  status: "UNSCHEDULED" | "SCHEDULED";
  scheduledStart: string | null; // ISO DateTime
  scheduledEnd: string | null; // ISO DateTime
  isManual?: boolean; // Locked manual schedule override
  executionStatus?: "PLANNED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "DELAYED";
  completedQty?: number;
  scrapQty?: number;
  actualRuntimeMin?: number;
  operatorNotes?: string;
}

export interface ScheduleSlot {
  id: string;
  processId: string;
  machineId: string;
  date: string; // YYYY-MM-DD
  hourStart: number; // 6 to 19 (working hour timeline 06:00 to 20:00)
  hourEnd: number; // hourStart + 1
  shift: number; // 1 = 06:00-13:00, 2 = 13:00-20:00
  slotType: "R" | "M"; // R (setup), M (machining)
  minutesUsed: number; // 0 to 60
  manpowerPct: number; // operator load ratio: 1.0 for R, derived manpowerPct for M
  overloaded: boolean; // if manpower stack on machine group in this hour > 100%
  collision: boolean; // NEW: true if multiple processes occupy this machine in this hour
}

export interface ScheduleResult {
  slots: ScheduleSlot[];
  warnings: string[];
}

export const SHIFT_1_START = 6;
export const SHIFT_1_END = 13;
export const SHIFT_2_START = 13;
export const SHIFT_2_END = 20;
export const WORKING_HOURS_PER_DAY = 14; // 6am - 8pm
