import { supabase } from "./supabase";
import { Machine, MachineGroup, Order, OrderProcess, ScheduleSlot } from "./types";

export interface SupabaseScheduleData {
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

/**
 * 1. SCHEDULES & SCHEDULE DATA
 */
export async function syncScheduleToSupabaseDB(
  orgId: string,
  scheduleName: string = "Primary Production Plan",
  data: SupabaseScheduleData,
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // 1. Find or create default schedule record for org
    let { data: schedule, error: schedError } = await supabase
      .from("schedules")
      .select("id")
      .eq("org_id", orgId)
      .limit(1)
      .maybeSingle();

    if (schedError) {
      console.warn("Supabase schedules lookup warning:", schedError.message);
    }

    let scheduleId = schedule?.id;

    if (!scheduleId) {
      const { data: newSched, error: createError } = await supabase
        .from("schedules")
        .insert({
          org_id: orgId,
          name: scheduleName,
          created_by: user?.id || null,
        })
        .select("id")
        .single();

      if (createError || !newSched) {
        console.warn("Could not insert schedule row into Supabase:", createError?.message);
        return { success: false, error: createError?.message };
      }
      scheduleId = newSched.id;
    } else {
      // Update schedule timestamp
      await supabase
        .from("schedules")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", scheduleId);
    }

    // 2. Upsert JSON payload into schedule_data table
    const { error: dataError } = await supabase.from("schedule_data").upsert({
      schedule_id: scheduleId,
      data: data as any,
      updated_at: new Date().toISOString(),
    });

    if (dataError) {
      console.warn("Supabase schedule_data upsert error:", dataError.message);
      return { success: false, error: dataError.message };
    }

    // 3. Upsert scheduler configuration flags into scheduler_configs table
    await supabase.from("scheduler_configs").upsert({
      schedule_id: scheduleId,
      optimization_mode: data.optimizationMode || "full",
      group_serialization: data.groupSerialization ?? false,
      allow_process_overlap: data.allowProcessOverlap ?? true,
      allow_sop_override: data.allowSopOverride ?? true,
      max_utilize_resources: data.maxUtilizeResources ?? true,
      max_prepone_weeks: data.maxPreponeWeeks || 0,
    });

    return { success: true, scheduleId };
  } catch (err: any) {
    console.error("syncScheduleToSupabaseDB exception:", err);
    return { success: false, error: err.message };
  }
}

export async function fetchScheduleFromSupabaseDB(orgId: string) {
  try {
    // 1. Get schedule record for org
    const { data: schedule, error: schedError } = await supabase
      .from("schedules")
      .select("id, name")
      .eq("org_id", orgId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (schedError || !schedule) {
      return { success: false, data: null };
    }

    // 2. Load schedule_data JSON
    const { data: schedData, error: dataError } = await supabase
      .from("schedule_data")
      .select("data")
      .eq("schedule_id", schedule.id)
      .maybeSingle();

    if (dataError || !schedData) {
      return { success: false, data: null };
    }

    return { success: true, data: schedData.data as SupabaseScheduleData };
  } catch (err: any) {
    console.error("fetchScheduleFromSupabaseDB exception:", err);
    return { success: false, data: null };
  }
}

/**
 * 2. MACHINES & MACHINE GROUPS DB CONNECTORS
 */
export async function fetchMachinesFromSupabaseDB(orgId: string) {
  try {
    const { data: groups } = await supabase.from("machine_groups").select("*").eq("org_id", orgId);

    const { data: machines } = await supabase.from("machines").select("*").eq("org_id", orgId);

    return {
      success: true,
      groups: groups || [],
      machines: machines || [],
    };
  } catch (err: any) {
    console.error("fetchMachinesFromSupabaseDB error:", err);
    return { success: false, groups: [], machines: [] };
  }
}

export async function saveMachineToSupabaseDB(
  orgId: string,
  machine: { code: string; name: string; machineGroupId: string; isActive?: boolean },
) {
  try {
    // Ensure machine group exists
    const { data: group } = await supabase
      .from("machine_groups")
      .select("id")
      .eq("org_id", orgId)
      .eq("code", machine.machineGroupId)
      .maybeSingle();

    let groupId = group?.id;
    if (!groupId) {
      const { data: newGroup } = await supabase
        .from("machine_groups")
        .insert({
          org_id: orgId,
          code: machine.machineGroupId,
          name: `Group ${machine.machineGroupId}`,
        })
        .select("id")
        .single();
      groupId = newGroup?.id;
    }

    if (!groupId) return { success: false, error: "Failed to map machine group." };

    const { error } = await supabase.from("machines").upsert({
      org_id: orgId,
      machine_group_id: groupId,
      code: machine.code,
      name: machine.name,
      is_active: machine.isActive ?? true,
    });

    return { success: !error, error: error?.message };
  } catch (err: any) {
    console.error("saveMachineToSupabaseDB error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * 3. CAPACITY PROFILES & DAILY OVERRIDES DB CONNECTORS
 */
export async function fetchCapacityFromSupabaseDB(orgId: string) {
  try {
    const { data: profile } = await supabase
      .from("capacity_profiles")
      .select("*")
      .eq("org_id", orgId)
      .eq("is_default", true)
      .maybeSingle();

    if (!profile) return { success: false, profile: null, overrides: [] };

    const { data: overrides } = await supabase
      .from("daily_capacity_overrides")
      .select("*")
      .eq("profile_id", profile.id);

    return {
      success: true,
      profile,
      overrides: overrides || [],
    };
  } catch (err: any) {
    console.error("fetchCapacityFromSupabaseDB error:", err);
    return { success: false, profile: null, overrides: [] };
  }
}

export async function saveDailyOverrideToSupabaseDB(
  orgId: string,
  dateStr: string,
  setter: number,
  process: number,
  isHoliday: boolean = false,
  note?: string,
) {
  try {
    // 1. Get default capacity profile for org
    let { data: profile } = await supabase
      .from("capacity_profiles")
      .select("id")
      .eq("org_id", orgId)
      .limit(1)
      .maybeSingle();

    let profileId = profile?.id;
    if (!profileId) {
      const { data: newProfile } = await supabase
        .from("capacity_profiles")
        .insert({
          org_id: orgId,
          name: "Default Profile",
          setter_capacity_pct: 100,
          operator_capacity_pct: 200,
          is_default: true,
        })
        .select("id")
        .single();
      profileId = newProfile?.id;
    }

    if (!profileId) return { success: false, error: "Failed to map capacity profile." };

    const { error } = await supabase.from("daily_capacity_overrides").upsert({
      profile_id: profileId,
      date: dateStr,
      setter_capacity_pct: setter,
      operator_capacity_pct: process,
      is_holiday: isHoliday,
      note: note || null,
    });

    return { success: !error, error: error?.message };
  } catch (err: any) {
    console.error("saveDailyOverrideToSupabaseDB error:", err);
    return { success: false, error: err.message };
  }
}

/**
 * 4. AUDIT LOGS & EXECUTION LOGS DB CONNECTORS
 */
export async function logAuditActionToSupabaseDB(orgId: string, action: string, details?: string) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      org_id: orgId,
      user_id: user?.id || null,
      action,
      details: details || null,
    });
  } catch (err) {
    console.warn("logAuditActionToSupabaseDB error:", err);
  }
}

export async function logExecutionToSupabaseDB(
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
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("schedule_execution_logs").insert({
      schedule_id: scheduleId,
      org_id: orgId,
      triggered_by: user?.id || null,
      order_count: orderCount,
      process_count: processCount,
      duration_ms: durationMs,
      status,
      warning_count: warningCount,
    });
  } catch (err) {
    console.warn("logExecutionToSupabaseDB error:", err);
  }
}

/**
 * 5. SETUP MATRIX & SCENARIOS CONNECTORS
 */
export async function syncSetupMatrixToSupabaseDB(orgId: string, rules: any[]) {
  try {
    if (!orgId || rules.length === 0) return { success: true };
    const rows = rules.map((r) => ({
      org_id: orgId,
      from_material: r.fromMaterial,
      to_material: r.toMaterial,
      machine_group_id: r.machineGroupId || null,
      changeover_mins: r.changeoverMins || 0,
    }));

    const { error } = await supabase.from("setup_changeover_matrices").upsert(rows, {
      onConflict: "org_id,from_material,to_material,machine_group_id",
    });

    return { success: !error, error: error?.message };
  } catch (err: any) {
    console.error("syncSetupMatrixToSupabaseDB error:", err);
    return { success: false, error: err.message };
  }
}

export async function loadSetupMatrixFromSupabaseDB(orgId: string) {
  try {
    const { data, error } = await supabase
      .from("setup_changeover_matrices")
      .select("*")
      .eq("org_id", orgId);

    if (error) return [];
    return data.map((r: any) => ({
      id: r.id,
      fromMaterial: r.from_material,
      toMaterial: r.to_material,
      machineGroupId: r.machine_group_id,
      changeoverMins: Number(r.changeover_mins),
    }));
  } catch (err) {
    console.error("loadSetupMatrixFromSupabaseDB error:", err);
    return [];
  }
}

export async function saveProcessExecutionLogToSupabaseDB(
  orgId: string,
  processId: string,
  completedQty: number,
  scrapQty: number,
  actualSetupMins?: number,
  actualProcessMins?: number,
  notes?: string,
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("process_execution_logs").insert({
      org_id: orgId,
      process_id: processId,
      completed_qty: completedQty,
      scrap_qty: scrapQty,
      actual_setup_mins: actualSetupMins || null,
      actual_process_mins: actualProcessMins || null,
      logged_by: user?.id || null,
      notes: notes || null,
    });

    return { success: !error, error: error?.message };
  } catch (err: any) {
    console.error("saveProcessExecutionLogToSupabaseDB error:", err);
    return { success: false, error: err.message };
  }
}
