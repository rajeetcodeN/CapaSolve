import { generateSchedule } from "./scheduler";
import { Machine, OptimizationMode, Order, OrderProcess, SetupMatrixRule } from "./types";

export interface SolverWorkerInput {
  orders: Order[];
  processes: OrderProcess[];
  machines?: Machine[];
  optimizationMode?: OptimizationMode;
  groupSerialization?: boolean;
  allowProcessOverlap?: boolean;
  allowSopOverride?: boolean;
  maxUtilizeResources?: boolean;
  language?: "en" | "de";
  maxPreponeWeeks?: number;
  globalSetterCapacity?: number;
  globalOperatorCapacity?: number;
  dailyCapacities?: Record<string, { setter: number; process: number; isHoliday?: boolean }>;
  rules?: SetupMatrixRule[];
}

self.onmessage = (event: MessageEvent<SolverWorkerInput>) => {
  try {
    const data = event.data;

    // Post initial progress message
    self.postMessage({
      type: "PROGRESS",
      progress: 10,
      message: "Initializing solver worker thread...",
    });

    const startTime = performance.now();
    const result = generateSchedule(
      data.orders,
      data.processes,
      data.machines || [],
      data.optimizationMode || "full",
      data.groupSerialization,
      data.allowProcessOverlap,
      data.allowSopOverride,
      data.maxUtilizeResources,
      data.dailyCapacities || {},
      data.globalSetterCapacity ?? 100,
      data.globalOperatorCapacity ?? 200,
      data.maxPreponeWeeks ?? 0,
      data.rules || [],
    );
    const solveTimeMs = Math.round(performance.now() - startTime);

    self.postMessage({
      type: "SUCCESS",
      progress: 100,
      solveTimeMs,
      slots: result.slots,
      warnings: result.warnings,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Solver worker encountered an unexpected exception.";
    self.postMessage({
      type: "ERROR",
      error: message,
    });
  }
};
