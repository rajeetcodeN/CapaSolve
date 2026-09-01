import { generateSchedule } from "@/lib/scheduler";
import { SupabaseScheduleData } from "@/lib/db-service";

export interface SolveApiRequest {
  orders: any[];
  processes: any[];
  machines?: any[];
  optimizationMode?: "full" | "workstation" | "pre-optimization";
  groupSerialization?: boolean;
  allowProcessOverlap?: boolean;
  allowSopOverride?: boolean;
  maxUtilizeResources?: boolean;
  maxPreponeWeeks?: number;
  globalSetterCapacity?: number;
  globalOperatorCapacity?: number;
  dailyCapacities?: Record<string, { setter: number; process: number; isHoliday?: boolean }>;
}

export function validateSolveRequest(body: any): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];
  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request payload must be a JSON object."] };
  }
  if (!Array.isArray(body.orders)) {
    errors.push("Field 'orders' must be an array of work orders.");
  }
  if (!Array.isArray(body.processes)) {
    errors.push("Field 'processes' must be an array of order process steps.");
  }
  return { valid: errors.length === 0, errors };
}

export function handleScheduleSolveApi(reqPayload: SolveApiRequest) {
  const validation = validateSolveRequest(reqPayload);
  if (!validation.valid) {
    return {
      success: false,
      error: {
        code: "INVALID_PAYLOAD",
        message: "Validation failed for schedule solve payload.",
        details: validation.errors,
      },
    };
  }

  const startTime = performance.now();
  const scheduleResult = generateSchedule(
    reqPayload.orders || [],
    reqPayload.processes || [],
    reqPayload.machines || [],
    (reqPayload.optimizationMode as any) || "full",
    reqPayload.groupSerialization ?? false,
    reqPayload.allowProcessOverlap ?? true,
    reqPayload.allowSopOverride ?? true,
    reqPayload.maxUtilizeResources ?? true,
    reqPayload.dailyCapacities || {},
    reqPayload.globalSetterCapacity || 100,
    reqPayload.globalOperatorCapacity || 200,
    reqPayload.maxPreponeWeeks || 0,
  );
  const solveTimeMs = Math.round(performance.now() - startTime);

  return {
    success: true,
    data: {
      totalSlots: scheduleResult.slots.length,
      solveTimeMs,
      warnings: scheduleResult.warnings,
      slots: scheduleResult.slots,
      ordersCount: reqPayload.orders.length,
      processesCount: reqPayload.processes.length,
    },
  };
}
