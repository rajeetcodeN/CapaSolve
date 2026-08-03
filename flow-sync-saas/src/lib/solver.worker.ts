import { generateSchedule } from "./scheduler";

export interface SolverWorkerInput {
  orders: any[];
  processes: any[];
  optimizationMode: "full" | "workstation" | "pre-optimization";
  groupSerialization: boolean;
  allowProcessOverlap: boolean;
  allowSopOverride: boolean;
  maxUtilizeResources: boolean;
  language: "en" | "de";
  maxPreponeWeeks: number;
  globalSetterCapacity: number;
  globalOperatorCapacity: number;
  dailyCapacities: Record<string, { setter: number; process: number; isHoliday?: boolean }>;
}

self.onmessage = (event: MessageEvent<SolverWorkerInput>) => {
  try {
    const data = event.data;
    
    // Post initial progress message
    self.postMessage({ type: "PROGRESS", progress: 10, message: "Initializing solver worker thread..." });

    const startTime = performance.now();
    const result = generateSchedule(
      data.orders,
      data.processes,
      data.optimizationMode,
      data.groupSerialization,
      data.allowProcessOverlap,
      data.allowSopOverride,
      data.maxUtilizeResources,
      data.language,
      data.maxPreponeWeeks,
      data.globalSetterCapacity,
      data.globalOperatorCapacity,
      data.dailyCapacities
    );
    const solveTimeMs = Math.round(performance.now() - startTime);

    self.postMessage({
      type: "SUCCESS",
      progress: 100,
      solveTimeMs,
      slots: result.slots,
      warnings: result.warnings,
    });
  } catch (err: any) {
    self.postMessage({
      type: "ERROR",
      error: err?.message || "Solver worker encountered an unexpected exception.",
    });
  }
};
