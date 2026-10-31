import type { FlowRead, FlowStage, FlowStopReason } from "@/api/types";

import { BUCKET_MS, type FlowFilters, type FlowScope, type FlowSplit } from "./flow-query";

export interface FlowSpan {
  readonly from: number;
  readonly to: number;
}

export interface FlowSliceParams {
  readonly project_id: string | null;
  readonly worker_name: string | null;
}

export type FlowDrillTarget = "Traces" | "Timeline" | "Scheduler" | "Overview";

type DrillParams = Readonly<Record<string, string | number | null | undefined>>;
type PathOf = (slice: FlowSliceParams, span: FlowSpan) => string;

const TRACES = "/traces";
const TIMELINE = "/timeline";
const SCHEDULER = "/scheduler";
const OVERVIEW = "/";
const ANALYTICS = "/analytics";
const FLOW_DATA_ANCHOR = "#flow-data";

const TARGET_LABELS: Readonly<Record<string, FlowDrillTarget>> = {
  [TRACES]: "Traces",
  [TIMELINE]: "Timeline",
  [SCHEDULER]: "Scheduler",
  [OVERVIEW]: "Overview",
};

export function drillPath(path: string, params: DrillParams): string {
  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) query.set(name, String(value));
  }
  const text = query.toString();
  return text === "" ? path : `${path}?${text}`;
}

export function targetLabel(path: string): FlowDrillTarget {
  const label = TARGET_LABELS[path.split(/[?#]/)[0] ?? ""];
  if (label === undefined) throw new Error(`No drill label for ${path}`);
  return label;
}

export function spanOf(read: FlowRead, first: number, last: number): FlowSpan {
  const { buckets, bucket, now, to } = read.window;
  const start = buckets[first];
  const lastStart = buckets[last];
  if (start === undefined || lastStart === undefined) {
    throw new RangeError(`No bucket at ${first} or ${last}`);
  }
  const partial = last === buckets.length - 1 && now < to;
  return { from: start, to: partial ? now : lastStart + BUCKET_MS[bucket] };
}

export function sliceParamsOf(read: FlowRead, keys: readonly string[]): FlowSliceParams {
  const projects = new Set(read.usage.by.project_id.map((row) => row.key));
  return {
    project_id: keys.find((key) => projects.has(key)) ?? null,
    worker_name: keys.find((key) => !projects.has(key)) ?? null,
  };
}

function scopeParamsOf(scope: FlowScope): FlowSliceParams {
  return { project_id: scope.projectId, worker_name: scope.workerName };
}

const tracesOf =
  (fixed: DrillParams, withSlice: boolean): PathOf =>
  (slice, span) =>
    drillPath(TRACES, { ...fixed, ...(withSlice ? slice : {}), ...span });

const SIGNAL_PATHS: Readonly<Record<string, PathOf>> = {
  "queued.wait": () => SCHEDULER,
  "evaluation.review": () => SCHEDULER,
  "executing.leak": tracesOf({ state: "error" }, true),
  "evaluation.leak": tracesOf({ state: "error" }, true),
  "executing.turn_rate_limited": tracesOf({ error_type: "rate_limited" }, true),
  "executing.turn_quota_exhausted": tracesOf({ error_type: "quota_exhausted" }, true),
  "executing.turn_unavailable": tracesOf({ error_type: "unavailable" }, true),
  "executing.tool_error": tracesOf({ error_type: "tool_error" }, false),
  "release_gate.leak": tracesOf({ state: "error", q: "operation_failed" }, true),
  "outcome.rework": (slice, span) => drillPath(TIMELINE, { project_id: slice.project_id, ...span }),
  "outcome.blocked": () => OVERVIEW,
  "tile.cost_per_success": tracesOf({ sort: "cost_usd" }, false),
  "tile.total_cost": tracesOf({ sort: "cost_usd" }, false),
  "tile.rejected_review_cost": tracesOf({ sort: "cost_usd" }, false),
  "tile.leaked_share": tracesOf({ state: "error", sort: "cost_usd" }, false),
  "tile.tokens_per_success": tracesOf({ sort: "total_tokens" }, false),
  "tile.total_tokens": tracesOf({ sort: "total_tokens" }, false),
  "tile.cache_hit": (slice, span) =>
    drillPath(TRACES, { model: slice.worker_name, sort: "total_tokens", ...span }),
  "causes.unattributed": tracesOf({ cause_category: "unattributed", sort: "cost_usd" }, false),
  "data.awaiting": (slice, span) =>
    drillPath(TRACES, { worker_name: slice.worker_name, state: "ok", ...span }),
  "data.completeness": (slice, span) =>
    drillPath(TRACES, { worker_name: slice.worker_name, state: "ok", ...span }),
  "tile.unpriced": (slice, span) => drillPath(TRACES, { worker_name: slice.worker_name, ...span }),
};

export function signalTarget(id: string, slice: FlowSliceParams, span: FlowSpan): string {
  const pathOf =
    SIGNAL_PATHS[id] ??
    (id.startsWith("verification.") || id.endsWith(".time") ? tracesOf({}, true) : undefined);
  if (pathOf === undefined) throw new Error(`No drill path for ${id}`);
  return pathOf(slice, span);
}

export function dayTarget(stage: FlowStage, scope: FlowScope, span: FlowSpan): string {
  const { project_id, worker_name } = scopeParamsOf(scope);
  if (stage === "executing") {
    return drillPath(TRACES, { state: "error", ...span, worker_name, project_id });
  }
  if (stage === "verification") return drillPath(TRACES, { project_id, worker_name, ...span });
  if (stage === "release_gate") {
    return drillPath(TRACES, { state: "error", q: "operation_failed", ...span });
  }
  return drillPath(TIMELINE, { project_id, ...span });
}

export function causeTarget(category: string, scope: FlowScope, span: FlowSpan): string {
  return drillPath(TRACES, { cause_category: category, ...scopeParamsOf(scope), ...span });
}

export function stopReasonTarget(reason: FlowStopReason | null, span: FlowSpan): string {
  return drillPath(TRACES, reason === null ? { state: "error", ...span } : { q: reason, ...span });
}

export function splitRowTarget(split: FlowSplit, key: string, span: FlowSpan): string {
  return drillPath(TRACES, { [split]: key, sort: "cost_usd", ...span });
}

function analyticsTarget(tab: "cost" | "flow", filters: FlowScope & Pick<FlowFilters, "range">) {
  return drillPath(ANALYTICS, { tab, ...scopeParamsOf(filters), range: filters.range });
}

export function costTabTarget(filters: FlowScope & Pick<FlowFilters, "range">): string {
  return analyticsTarget("cost", filters);
}

export function flowDataTarget(filters: FlowScope & Pick<FlowFilters, "range">): string {
  return `${analyticsTarget("flow", filters)}${FLOW_DATA_ANCHOR}`;
}
