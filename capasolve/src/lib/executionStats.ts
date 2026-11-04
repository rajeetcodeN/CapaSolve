import { OrderProcess } from "./types";

export interface ExecutionStats {
  total: number;
  queued: number;
  hold: number;
  released: number;
  running: number;
  done: number;
  delayed: number;
  completionRatePct: number;
}

/**
 * Calculates shop floor execution metrics and completion rate across order processes.
 */
export function calculateExecutionStats(processes: OrderProcess[]): ExecutionStats {
  const total = processes.length;
  if (total === 0) {
    return {
      total: 0,
      queued: 0,
      hold: 0,
      released: 0,
      running: 0,
      done: 0,
      delayed: 0,
      completionRatePct: 0,
    };
  }

  const running = processes.filter((p) => p.executionStatus === "IN_PROGRESS").length;
  const done = processes.filter((p) => p.executionStatus === "COMPLETED").length;
  const hold = processes.filter((p) => p.executionStatus === "PAUSED").length;
  const delayed = processes.filter((p) => p.executionStatus === "DELAYED").length;
  const released = processes.filter(
    (p) => p.executionStatus === "PLANNED" || (!p.executionStatus && p.status === "SCHEDULED"),
  ).length;
  const queued = processes.filter(
    (p) => p.executionStatus === "QUEUED" || p.status === "UNSCHEDULED",
  ).length;

  const completionRatePct = Math.round((done / total) * 100);

  return {
    total,
    queued,
    hold,
    released,
    running,
    done,
    delayed,
    completionRatePct,
  };
}
