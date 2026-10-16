/**
 * ==============================================================================
 * CapaSolve SaaS — Core Manufacturing & Finite Capacity Scheduling Domain Models
 * ==============================================================================
 * This module defines the complete TypeScript domain ontology for CapaSolve:
 * - Workcenters, Machine Groups, and Spindles
 * - Production Orders, Routings, and Operations (Steps)
 * - Sequence-Dependent Setup Matrix (SMED / Changeover minimization)
 * - Shop Floor Execution Tracking (MES: Scrap, Pauses, Holds, OEE)
 * - Digital Twin What-If Scenario Simulations
 * ==============================================================================
 */

/** Process kind classification: Setup (R), Machining (M), or Post-processing (P) */
export type ProcessKind = "R" | "M" | "P";

/** Optimization strategy for schedule solving */
export type OptimizationMode = "pre" | "workstation" | "full";

/** Machine group representing a pool of functionally identical or interchangeable workcenters */
export interface MachineGroup {
  /** Unique group identifier, e.g., "M1", "M2", "MILLING_5AXIS" */
  id: string;
  /** Human-readable group name, e.g., "5-Axis CNC Milling Cells" */
  name: string;
}

/** Individual machine or physical workcenter on the factory shop floor */
export interface Machine {
  /** Unique machine code / workcenter ID (matches ERP resource ID, e.g., "603011") */
  id: string;
  /** Friendly display label for UI, Gantt, and dispatch lists */
  name: string;
  /** Parent machine group ID this workcenter belongs to */
  machineGroupId: string;
}

/**
 * Sequence-dependent setup (changeover) rule between consecutive parts on a machine.
 * Implements SMED (Single-Minute Exchange of Die) optimization by defining transition times.
 */
export interface SetupMatrixRule {
  /** Unique rule identifier */
  id: string;
  /** Origin material code/pattern, or "*" for universal match */
  fromMaterial: string;
  /** Destination material code/pattern, or "*" for universal match */
  toMaterial: string;
  /** Specific machine group where this rule applies (optional; applies globally if omitted) */
  machineGroupId?: string;
  /** Dynamic setup duration in minutes when transitioning from fromMaterial to toMaterial */
  setupTimeMin: number;
  /** Explanatory note, e.g., "Deep washdown required between allergen materials" */
  description?: string;
}

/** Manufacturing order dispatch priority level */
export type OrderPriority = "Urgent" | "High" | "Med" | "Low";

/**
 * Top-level Manufacturing Work Order representing a customer demand or production batch.
 */
export interface Order {
  /** Internal unique UUID for system state tracking */
  id: string;
  /** External ERP Order Number / Job ID (e.g., "1023811") */
  orderId: string;
  /** Finished good or assembly part number (e.g., "100-024-830.01-00") */
  material: string;
  /** Start of Production (SOP) earliest release date (ISO string YYYY-MM-DD) */
  sopStartDate: string;
  /** Start of Production (SOP) earliest release time (HH:mm:ss) */
  sopStartTime: string;
  /** Target manufacturing batch quantity in base units */
  orderQty: number;
  /** Urgency / scheduling priority */
  priority?: OrderPriority;
  /** Calculated target completion date based on solver output */
  dueDate?: string;
  /** Customer contractual promised delivery date */
  customerDueDate?: string;
}

export type HoldReason =
  | "TOOLING_ISSUE"
  | "MACHINE_FAULT"
  | "MATERIAL_DEFECT"
  | "OPERATOR_PAUSE"
  | "QUALITY_CHECK"
  | "OTHER";

export type ScrapReason =
  | "SETUP_SCRAP"
  | "DIMENSION_OOS"
  | "SURFACE_FLAW"
  | "MATERIAL_POROSITY"
  | "TOOL_BREAKAGE"
  | "OTHER";

export interface ScrapEntry {
  id: string;
  timestamp: string;
  orderId: string;
  processId: number;
  machineId: string;
  scrapQty: number;
  reason: ScrapReason;
  notes?: string;
  loggedBy?: string;
}

export type MaterialReadiness = "READY" | "LOW_STOCK" | "SHORTAGE";

export interface MaterialInventoryItem {
  id?: string;
  sku: string;
  description: string;
  availableQty: number;
  reservedQty: number;
  leadTimeDays: number;
  unit?: string;
  expectedArrivalDate?: string;
}

/**
 * Individual manufacturing routing operation (step) belonging to a production order.
 * Follows German/SAP manufacturing standard (Vorgang / Arbeitsgang).
 */
export interface OrderProcess {
  /** Internal unique UUID for this routing operation */
  id: string;
  /** Parent ERP Order ID */
  orderId: string;
  /** Operation scheduling priority (inherits from order if not overridden) */
  priority?: OrderPriority;
  /** Operation sequence number (e.g., 10 for milling, 20 for drilling, 30 for QA) */
  processId: number;
  /** Target machine / workcenter code assigned by the scheduler */
  machineId: string;
  /** Original machine assignment from imported ERP CSV */
  originalMachineId?: string;
  /** Operation description text (e.g., "FRÄSEN: Planfräsen H-90", "BOHREN", "HONEN") */
  processText: string;
  /** Batch base unit quantity */
  baseQty: number;
  /** Fixed changeover / setup time in minutes (R / Rüstzeit) */
  setupTimeMin: number;
  /** Variable processing runtime per base batch in minutes (M / Maschinenzeit) */
  processTimeMin: number;
  /** Operator labor minutes required per base batch */
  manpowerUtilizationMin: number;
  /** Calculated total processing time for the order quantity: `(orderQty / baseQty) * processTimeMin` */
  sumV2: number;
  /** Calculated total labor time across the order quantity: `manpowerUtilizationMin * baseQty * orderQty` */
  sumV3: number;
  /** Total operation duration in minutes: `setupTimeMin + sumV2` */
  totalTimeMin: number;
  /** Operator utilization fraction (0.0 to 1.0) during machining: `manpowerUtilizationMin / processTimeMin` */
  manpowerPct: number;
  /** Scheduling state */
  status: "UNSCHEDULED" | "SCHEDULED";
  /** Scheduled start timestamp (ISO 8601 string) */
  scheduledStart: string | null;
  /** Scheduled completion timestamp (ISO 8601 string) */
  scheduledEnd: string | null;
  /** True if the user manually pinned / dragged this operation on the Gantt chart */
  isManual?: boolean;
  /** MES shop floor execution state */
  executionStatus?: "QUEUED" | "PLANNED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "DELAYED";
  /** Units completed on shop floor */
  completedQty?: number;
  /** Units scrapped during this operation */
  scrapQty?: number;
  /** Actual recorded runtime on machine in minutes */
  actualRuntimeMin?: number;
  /** Shop floor operator comments / shift handover notes */
  operatorNotes?: string;
  /** Reason for job hold / pause */
  holdReason?: HoldReason;
  /** Detailed note explaining the hold condition */
  holdNotes?: string;
  /** Root cause category for scrap */
  scrapReason?: ScrapReason;
  /** Audit log of individual scrap events recorded against this operation */
  scrapHistory?: ScrapEntry[];
}

/**
 * Atomic 1-hour schedule block on the shop floor timeline grid.
 * Used for finite capacity timeline visualization and resource load aggregation.
 */
export interface ScheduleSlot {
  /** Unique slot identifier */
  id: string;
  /** Associated OrderProcess ID */
  processId: string;
  /** Assigned machine / workcenter ID */
  machineId: string;
  /** Date of the time slot (YYYY-MM-DD) */
  date: string;
  /** Start hour in 24h format (e.g., 6 for 06:00) */
  hourStart: number;
  /** End hour in 24h format (e.g., 7 for 07:00) */
  hourEnd: number;
  /** Shift index (1 = Morning Shift 06:00-13:00, 2 = Afternoon Shift 13:00-20:00) */
  shift: number;
  /** Slot classification: 'R' (Setup / Changeover) or 'M' (Active Machining) */
  slotType: "R" | "M";
  /** Minutes of the 60-minute window occupied by this operation (0 to 60) */
  minutesUsed: number;
  /** Operator labor demand during this slot (1.0 for setup, derived ratio for machining) */
  manpowerPct: number;
  /** True if total operator demand across this machine group exceeds 100% capacity in this hour */
  overloaded: boolean;
  /** True if multiple operations were erroneously assigned to the same machine in this hour */
  collision: boolean;
}

/**
 * Output payload generated by the finite capacity schedule solver.
 */
export interface ScheduleResult {
  /** All calculated hourly schedule slots across the planning horizon */
  slots: ScheduleSlot[];
  /** Non-fatal scheduling warnings (e.g., bottleneck alerts, overdue orders, capacity spikes) */
  warnings: string[];
  /** Changeover setup time saved via sequence optimization matrix in minutes */
  totalSetupMinutesSaved?: number;
  /** Total cumulative setup minutes required across all scheduled jobs */
  totalChangeoverMinutes?: number;
}

export const SHIFT_1_START = 6;
export const SHIFT_1_END = 13;
export const SHIFT_2_START = 13;
export const SHIFT_2_END = 20;
export const WORKING_HOURS_PER_DAY = 14; // 6am - 8pm

export type ScenarioType =
  | "machine_group_delay"
  | "machine_stopped"
  | "resource_unavailable"
  | "shift_change"
  | "rush_order";

export interface ScenarioConfig {
  type: ScenarioType;
  machineGroupId?: string; // e.g. "M1" or "M2"
  groupDelayHours?: number; // e.g. 8, 16, 24, 48
  machineId?: string; // e.g. "603012", "605001"
  machineStopped?: boolean;
  downtimeHours?: number; // e.g. 8, 12, 24, 48
  resourceType?: "setter" | "operator" | "both";
  capacityReductionPct?: number; // e.g. 50 (50% reduction)
  shiftOption?: "no_shift_2" | "weekend_overtime";
  rushOrderId?: string; // e.g. "ord-1019015_10"
  startDate?: string; // YYYY-MM-DD
}

export interface ShiftedOrderImpact {
  orderId: string;
  material: string;
  originalStart: string;
  newStart: string;
  originalEnd: string;
  newEnd: string;
  shiftHours: number;
  reason: string;
  affectedMachineId?: string;
  impactType?: "delayed" | "expedited";
}

export interface ScenarioBranch {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  config: ScenarioConfig;
  makespanDays: number;
  totalSetupHours: number;
  utilizationPct: number;
  otdPct: number;
  active: boolean;
  shiftedOrders: ShiftedOrderImpact[];
  aiAdaptationAdvice?: string[];
}
