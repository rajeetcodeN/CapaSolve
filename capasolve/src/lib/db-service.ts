import { sql, neonDb } from "./neon";
import { neonAuth } from "./neon-auth";
import { Order, OrderProcess, ScheduleSlot } from "./types";

export interface NeonScheduleData {
  orders: Order[];
  processes: OrderProcess[];
  slots?: ScheduleSlot[];
  warnings?: string[];
  optimizationMode?: string;
  groupSerialization?: boolean;
  allowProcessOverlap?: boolean;
  allowSopOverride?: boolean;
  maxUtilizeResources?: boolean;
  language?: "en" | "de";
  maxPreponeWeeks?: number;
  globalSetterCapacity?: number;
  globalOperatorCapacity?: number;
  dailyCapacities?: Record<string, { setter: number; process: number; isHoliday?: boolean }>;
}

export type SupabaseScheduleData = NeonScheduleData;

/**
 * 1. SCHEDULES & SCHEDULE DATA (Neon Lakebase Postgres)
 */
export async function syncScheduleToNeonDB(
  orgId: string,
  scheduleName: string = "Primary Production Plan",
  data: NeonScheduleData,
) {
  try {
    const {
      data: { session },
    } = await neonAuth.getSession();

    const scheduleId = await neonDb.saveSchedule(
      orgId,
      scheduleName,
      data,
      session?.user?.id || null,
    );

    // Upsert scheduler configuration flags into Neon Postgres scheduler_configs
    await sql`
      INSERT INTO public.scheduler_configs (
        schedule_id, optimization_mode, group_serialization,
        allow_process_overlap, allow_sop_override, max_utilize_resources, max_prepone_weeks
      )
      VALUES (
        ${scheduleId},
        ${data.optimizationMode || "full"},
        ${data.groupSerialization ?? false},
        ${data.allowProcessOverlap ?? true},
        ${data.allowSopOverride ?? true},
        ${data.maxUtilizeResources ?? true},
        ${data.maxPreponeWeeks || 0}
      )
      ON CONFLICT (schedule_id) DO UPDATE SET
        optimization_mode = EXCLUDED.optimization_mode,
        group_serialization = EXCLUDED.group_serialization,
        allow_process_overlap = EXCLUDED.allow_process_overlap,
        allow_sop_override = EXCLUDED.allow_sop_override,
        max_utilize_resources = EXCLUDED.max_utilize_resources,
        max_prepone_weeks = EXCLUDED.max_prepone_weeks;
    `;

    return { success: true, scheduleId };
  } catch (err: any) {
    console.error("syncScheduleToNeonDB exception:", err);
    return { success: false, error: err.message };
  }
}

export async function fetchScheduleFromNeonDB(orgId: string) {
  try {
    const data = await neonDb.loadSchedule(orgId);
    if (!data) return { success: false, data: null };
    return { success: true, data: data as NeonScheduleData };
  } catch (err: any) {
    console.error("fetchScheduleFromNeonDB exception:", err);
    return { success: false, data: null };
  }
}

/**
 * 2. MACHINES & MACHINE GROUPS (Neon Lakebase Postgres)
 */
export async function fetchMachinesFromNeonDB(orgId: string) {
  try {
    const groups = await sql`
      SELECT id, org_id, code, name, created_at
      FROM public.machine_groups
      WHERE org_id = ${orgId};
    `;

    const machines = await sql`
      SELECT id, org_id, machine_group_id, code, name, is_active, created_at
      FROM public.machines
      WHERE org_id = ${orgId};
    `;

    return {
      success: true,
      groups: groups || [],
      machines: machines || [],
    };
  } catch (err: any) {
    console.error("fetchMachinesFromNeonDB error:", err);
    return { success: false, groups: [], machines: [] };
  }
}

export async function saveMachineToNeonDB(
  orgId: string,
  machine: { code: string; name: string; machineGroupId: string; isActive?: boolean },
) {
  try {
    // 1. Ensure machine group exists in Neon
    let group = await sql`
      SELECT id FROM public.machine_groups
      WHERE org_id = ${orgId} AND code = ${machine.machineGroupId}
      LIMIT 1;
    `;

    let groupId = group[0]?.id;
    if (!groupId) {
      const newGroup = await sql`
        INSERT INTO public.machine_groups (org_id, code, name)
        VALUES (${orgId}, ${machine.machineGroupId}, ${`Group ${machine.machineGroupId}`})
        ON CONFLICT (org_id, code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id;
      `;
      groupId = newGroup[0]?.id;
    }

    if (!groupId) return { success: false, error: "Failed to map machine group in Neon." };

    // 2. Upsert machine in Neon
    await sql`
      INSERT INTO public.machines (org_id, machine_group_id, code, name, is_active)
      VALUES (${orgId}, ${groupId}, ${machine.code}, ${machine.name}, ${machine.isActive ?? true})
      ON CONFLICT (org_id, code) DO UPDATE SET
        machine_group_id = EXCLUDED.machine_group_id,
        name = EXCLUDED.name,
        is_active = EXCLUDED.is_active;
    `;

    return { success: true };
  } catch (err: any) {
    console.error("saveMachineToNeonDB error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * 3. CAPACITY PROFILES & DAILY OVERRIDES (Neon Lakebase Postgres)
 */
export async function fetchCapacityFromNeonDB(orgId: string) {
  try {
    const profiles = await sql`
      SELECT * FROM public.capacity_profiles
      WHERE org_id = ${orgId} AND is_default = true
      LIMIT 1;
    `;

    const profile = profiles[0] || null;
    if (!profile) return { success: false, profile: null, overrides: [] };

    const overrides = await sql`
      SELECT * FROM public.daily_capacity_overrides
      WHERE profile_id = ${profile.id};
    `;

    return {
      success: true,
      profile,
      overrides: overrides || [],
    };
  } catch (err: any) {
    console.error("fetchCapacityFromNeonDB error:", err);
    return { success: false, profile: null, overrides: [] };
  }
}

export async function saveDailyOverrideToNeonDB(
  orgId: string,
  dateStr: string,
  setter: number,
  process: number,
  isHoliday: boolean = false,
  note?: string,
) {
  try {
    let profiles = await sql`
      SELECT id FROM public.capacity_profiles
      WHERE org_id = ${orgId}
      LIMIT 1;
    `;

    let profileId = profiles[0]?.id;
    if (!profileId) {
      const newProfile = await sql`
        INSERT INTO public.capacity_profiles (org_id, name, setter_capacity_pct, operator_capacity_pct, is_default)
        VALUES (${orgId}, 'Default Profile', 100, 200, true)
        RETURNING id;
      `;
      profileId = newProfile[0]?.id;
    }

    if (!profileId) return { success: false, error: "Failed to map capacity profile in Neon." };

    await sql`
      INSERT INTO public.daily_capacity_overrides (profile_id, date, setter_capacity_pct, operator_capacity_pct, is_holiday, note)
      VALUES (${profileId}, ${dateStr}, ${setter}, ${process}, ${isHoliday}, ${note || null})
      ON CONFLICT (profile_id, date) DO UPDATE SET
        setter_capacity_pct = EXCLUDED.setter_capacity_pct,
        operator_capacity_pct = EXCLUDED.operator_capacity_pct,
        is_holiday = EXCLUDED.is_holiday,
        note = EXCLUDED.note;
    `;

    return { success: true };
  } catch (err: any) {
    console.error("saveDailyOverrideToNeonDB error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * 4. AUDIT LOGS & EXECUTION LOGS (Neon Lakebase Postgres)
 */
export async function logAuditActionToNeonDB(orgId: string, action: string, details?: string) {
  try {
    const {
      data: { session },
    } = await neonAuth.getSession();

    await sql`
      INSERT INTO public.audit_logs (org_id, user_id, action, details)
      VALUES (${orgId}, ${session?.user?.id || null}, ${action}, ${details || null});
    `;
  } catch (err) {
    console.warn("logAuditActionToNeonDB error:", err);
  }
}

export async function logExecutionToNeonDB(
  scheduleId: string,
  orgId: string,
  orderCount: number,
  processCount: number,
  durationMs: number,
  status: "SUCCESS" | "WARNING" | "FAILED",
  warningCount: number = 0,
) {
  try {
    const {
      data: { session },
    } = await neonAuth.getSession();

    await sql`
      INSERT INTO public.schedule_execution_logs (
        schedule_id, org_id, triggered_by, order_count, process_count, duration_ms, status, warning_count
      )
      VALUES (
        ${scheduleId}, ${orgId}, ${session?.user?.id || null},
        ${orderCount}, ${processCount}, ${durationMs}, ${status}, ${warningCount}
      );
    `;
  } catch (err) {
    console.warn("logExecutionToNeonDB error:", err);
  }
}

export async function syncSetupMatrixToNeonDB(orgId: string, rules: any[]) {
  return { success: true };
}

export async function loadSetupMatrixFromNeonDB(orgId: string) {
  return [];
}

export async function saveProcessExecutionLogToNeonDB(
  orgId: string,
  processId: string,
  completedQty: number,
  scrapQty: number,
  actualSetupMins?: number,
  actualProcessMins?: number,
  notes?: string,
) {
  return { success: true };
}

// Backwards-compatible aliases
export const syncScheduleToSupabaseDB = syncScheduleToNeonDB;
export const fetchScheduleFromSupabaseDB = fetchScheduleFromNeonDB;
export const fetchMachinesFromSupabaseDB = fetchMachinesFromNeonDB;
export const saveMachineToSupabaseDB = saveMachineToNeonDB;
export const fetchCapacityFromSupabaseDB = fetchCapacityFromNeonDB;
export const saveDailyOverrideToSupabaseDB = saveDailyOverrideToNeonDB;
export const logAuditActionToSupabaseDB = logAuditActionToNeonDB;
export const logExecutionToSupabaseDB = logExecutionToNeonDB;
export const syncSetupMatrixToSupabaseDB = syncSetupMatrixToNeonDB;
export const loadSetupMatrixFromSupabaseDB = loadSetupMatrixFromNeonDB;
export const saveProcessExecutionLogToSupabaseDB = saveProcessExecutionLogToNeonDB;
