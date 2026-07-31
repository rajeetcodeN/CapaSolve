import { authenticateRequest } from "@/lib/api/auth";
import { validateOptimizationPayload } from "@/lib/plan-limits";
import { generateSchedule } from "@/lib/scheduler";
import { supabase } from "@/lib/supabase";
import { Machine, Order, OrderProcess, OptimizationMode } from "@/lib/types";

export async function POST(request: Request) {
  const startTime = Date.now();
  try {
    const auth = await authenticateRequest(request, ["ADMIN", "DEVELOPER"]);
    if (auth.error || !auth.ctx) {
      return new Response(JSON.stringify({ error: auth.error || "Unauthorized" }), {
        status: auth.status || 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { orgId, userId, plan } = auth.ctx;
    const body = await request.json();

    const {
      scheduleId,
      orders = [],
      processes = [],
      machines = [],
      optimizeMode = "full",
      groupSerialization = false,
      allowProcessOverlap = false,
      allowSopOverride = false,
      maxUtilizeResources = false,
      dailyCapacities = {},
      globalSetterCapacity = 100,
      globalOperatorCapacity = 200,
      maxPreponeWeeks = 0,
    } = body;

    const validation = validateOptimizationPayload(orders.length, machines.length, plan);
    if (!validation.allowed) {
      return new Response(JSON.stringify({ error: validation.reason }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = generateSchedule(
      orders as Order[],
      processes as OrderProcess[],
      machines as Machine[],
      optimizeMode as OptimizationMode,
      groupSerialization,
      allowProcessOverlap,
      allowSopOverride,
      maxUtilizeResources,
      dailyCapacities,
      globalSetterCapacity,
      globalOperatorCapacity,
      maxPreponeWeeks
    );

    const durationMs = Date.now() - startTime;

    if (scheduleId) {
      const fullPayload = {
        orders,
        processes,
        machines,
        slots: result.slots,
        warnings: result.warnings,
        dailyCapacities,
        globalSetterCapacity,
        globalOperatorCapacity,
        optimizationMode: optimizeMode,
        updatedAt: new Date().toISOString(),
      };

      await supabase
        .from("schedule_data")
        .upsert({ schedule_id: scheduleId, data: fullPayload, updated_at: new Date().toISOString() });

      await supabase.from("schedule_execution_logs").insert({
        schedule_id: scheduleId,
        org_id: orgId,
        triggered_by: userId === "system-api-key" ? null : userId,
        order_count: orders.length,
        process_count: processes.length,
        duration_ms: durationMs,
        status: result.warnings.length > 0 ? "WARNING" : "SUCCESS",
        warning_count: result.warnings.length,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        scheduleId,
        slots: result.slots,
        warnings: result.warnings,
        slotsCount: result.slots.length,
        warningsCount: result.warnings.length,
        durationMs,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Optimization execution failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
