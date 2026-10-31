import type { FlowRead } from "@/api/types";

import { signalTarget, spanOf } from "./flow-drill";
import type { FlowFrame, FlowSignal } from "./flow-status";
import { boundsOf } from "./flow-thresholds";

export function awaitingOf(read: FlowRead): number {
  return read.completeness.awaiting_ingestion.reduce((sum, worker) => sum + worker.count, 0);
}

export function completenessOf(read: FlowRead): number {
  const { executions, open, no_root, exit_unknown } = read.completeness;
  const settled = executions - open + no_root;
  if (settled === 0) return 1;
  return 1 - (no_root + exit_unknown + awaitingOf(read)) / settled;
}

export function dataSignalOf(read: FlowRead, _frame: FlowFrame): FlowSignal {
  const awaiting = awaitingOf(read);
  const id = awaiting > 0 ? "data.awaiting" : "data.completeness";
  const value = awaiting > 0 ? awaiting : completenessOf(read);
  const span = spanOf(read, 0, read.window.buckets.length - 1);
  return {
    id,
    where: "data",
    stage: null,
    group: null,
    metric: awaiting > 0 ? "awaiting ingestion" : "completeness",
    label: awaiting > 0 ? "Awaiting ingestion" : "Completeness",
    short: awaiting > 0 ? "awaiting" : "completeness",
    unit: awaiting > 0 ? "count" : "ratio",
    bounds: boundsOf(id),
    window: value,
    shown: value,
    previous: null,
    series: null,
    slices: read.completeness.awaiting_ingestion
      .filter((worker) => worker.count > 0)
      .map((worker) => ({ key: worker.worker_name, window: worker.count, series: null })),
    slice: [],
    cause: null,
    target: signalTarget(id, { project_id: null, worker_name: null }, span),
  };
}
