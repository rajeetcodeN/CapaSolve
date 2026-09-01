import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabase } from "../supabase";
import { authenticateRequest } from "./auth";
import { validateOptimizationPayload } from "../plan-limits";
import { generateSchedule } from "../scheduler";
import { Machine, Order, OrderProcess, OptimizationMode } from "../types";

// Schema for running server-side schedule optimization
const optimizeInputSchema = z.object({
  token: z.string(),
  scheduleId: z.string().optional(),
  orders: z.array(z.any()),
  processes: z.array(z.any()),
  machines: z.array(z.any()),
  optimizeMode: z.enum(["pre", "workstation", "full"]).default("full"),
  groupSerialization: z.boolean().default(false),
  allowProcessOverlap: z.boolean().default(false),
  allowSopOverride: z.boolean().default(false),
  maxUtilizeResources: z.boolean().default(false),
  dailyCapacities: z.record(z.any()).optional().default({}),
  globalSetterCapacity: z.number().default(100),
  globalOperatorCapacity: z.number().default(200),
  maxPreponeWeeks: z.number().default(0),
});

export const runOptimizeScheduleServer = createServerFn({ method: "POST" })
  .inputValidator(optimizeInputSchema)
  .handler(async ({ data }) => {
    const startTime = Date.now();
    try {
      // 1. Authenticate user request
      const fakeReq = new Request("http://localhost", {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      const auth = await authenticateRequest(fakeReq, ["ADMIN", "DEVELOPER"]);
      if (auth.error || !auth.ctx) {
        return { success: false, error: auth.error || "Authentication failed" };
      }

      const { orgId, userId, plan } = auth.ctx;

      // 2. Validate Plan Limits
      const validation = validateOptimizationPayload(
        data.orders.length,
        data.machines.length,
        plan,
      );
      if (!validation.allowed) {
        return { success: false, error: validation.reason };
      }

      // 3. Execute Server-Side Constraint Solver
      const result = generateSchedule(
        data.orders as Order[],
        data.processes as OrderProcess[],
        data.machines as Machine[],
        data.optimizeMode as OptimizationMode,
        data.groupSerialization,
        data.allowProcessOverlap,
        data.allowSopOverride,
        data.maxUtilizeResources,
        data.dailyCapacities,
        data.globalSetterCapacity,
        data.globalOperatorCapacity,
        data.maxPreponeWeeks,
      );

      const durationMs = Date.now() - startTime;

      // 4. Save result to schedule_data JSONB if scheduleId provided
      if (data.scheduleId) {
        const fullPayload = {
          orders: data.orders,
          processes: data.processes,
          machines: data.machines,
          slots: result.slots,
          warnings: result.warnings,
          dailyCapacities: data.dailyCapacities,
          globalSetterCapacity: data.globalSetterCapacity,
          globalOperatorCapacity: data.globalOperatorCapacity,
          optimizationMode: data.optimizeMode,
          updatedAt: new Date().toISOString(),
        };

        await supabase.from("schedule_data").upsert({
          schedule_id: data.scheduleId,
          data: fullPayload,
          updated_at: new Date().toISOString(),
        });

        // Log execution to schedule_execution_logs table
        await supabase.from("schedule_execution_logs").insert({
          schedule_id: data.scheduleId,
          org_id: orgId,
          triggered_by: userId === "system-api-key" ? null : userId,
          order_count: data.orders.length,
          process_count: data.processes.length,
          duration_ms: durationMs,
          status: result.warnings.length > 0 ? "WARNING" : "SUCCESS",
          warning_count: result.warnings.length,
        });
      }

      return {
        success: true,
        slots: result.slots,
        warnings: result.warnings,
        slotsCount: result.slots.length,
        warningsCount: result.warnings.length,
        durationMs,
      };
    } catch (err: any) {
      console.error("Optimization Engine Server Error:", err);
      return { success: false, error: err.message || "Failed to execute optimization solver" };
    }
  });

// Schema for fetching schedules list
export const fetchSchedulesServer = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string() }))
  .handler(async ({ data }) => {
    try {
      const fakeReq = new Request("http://localhost", {
        headers: { Authorization: `Bearer ${data.token}` },
      });
      const auth = await authenticateRequest(fakeReq, ["ADMIN", "DEVELOPER", "GUEST"]);
      if (auth.error || !auth.ctx) {
        return { success: false, error: auth.error };
      }

      const { data: schedules, error } = await supabase
        .from("schedules")
        .select("id, name, created_at, updated_at, created_by")
        .eq("org_id", auth.ctx.orgId)
        .order("updated_at", { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, schedules };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });
