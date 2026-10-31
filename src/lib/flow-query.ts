import type { FlowQuery, FlowStage } from "@/api/types";

export const FLOW_TABS = ["flow", "cost"] as const;
export const FLOW_RANGES = ["24h", "7d", "30d"] as const;
export const FLOW_SPLITS = ["model", "worker_name", "project_id", "stage"] as const;
export const FLOW_FILTER_STAGES = [
  "executing",
  "verification",
  "release_gate",
  "evaluation",
  "outcome",
] as const satisfies readonly FlowStage[];

export type FlowTab = (typeof FLOW_TABS)[number];
export type FlowRange = (typeof FLOW_RANGES)[number];
export type FlowSplit = (typeof FLOW_SPLITS)[number];
export type FlowFilterStage = (typeof FLOW_FILTER_STAGES)[number];

export interface FlowFilters {
  readonly tab: FlowTab;
  readonly projectId: string | null;
  readonly workerName: string | null;
  readonly range: FlowRange;
  readonly stage: FlowFilterStage | null;
  readonly cause: string | null;
  readonly split: FlowSplit;
}

export type FlowScope = Pick<FlowFilters, "projectId" | "workerName">;

export const BUCKET_MS: Readonly<Record<FlowQuery["bucket"], number>> = {
  hour: 3_600_000,
  day: 86_400_000,
};

const DEFAULT_TAB: FlowTab = "flow";
const DEFAULT_RANGE: FlowRange = "7d";
const DEFAULT_SPLIT: FlowSplit = "model";

const RANGE_BUCKETS: Readonly<
  Record<FlowRange, { readonly bucket: FlowQuery["bucket"]; readonly earlier: number }>
> = {
  "24h": { bucket: "hour", earlier: 23 },
  "7d": { bucket: "day", earlier: 6 },
  "30d": { bucket: "day", earlier: 29 },
};

function choiceOf<T extends string>(values: readonly T[], requested: string | null): T | null {
  return values.find((value) => value === requested) ?? null;
}

export function flowFiltersOf(params: URLSearchParams): FlowFilters {
  return {
    tab: choiceOf(FLOW_TABS, params.get("tab")) ?? DEFAULT_TAB,
    projectId: params.get("project_id") || null,
    workerName: params.get("worker_name") || null,
    range: choiceOf(FLOW_RANGES, params.get("range")) ?? DEFAULT_RANGE,
    stage: choiceOf(FLOW_FILTER_STAGES, params.get("stage")),
    cause: params.get("cause") || null,
    split: choiceOf(FLOW_SPLITS, params.get("split")) ?? DEFAULT_SPLIT,
  };
}

export function flowQueryOf(
  filters: FlowScope & Pick<FlowFilters, "range">,
  now: number,
): FlowQuery {
  const { bucket, earlier } = RANGE_BUCKETS[filters.range];
  const unit = BUCKET_MS[bucket];
  return {
    from: Math.floor(now / unit) * unit - earlier * unit,
    to: now,
    bucket,
    ...(filters.projectId === null ? {} : { project_id: filters.projectId }),
    ...(filters.workerName === null ? {} : { worker_name: filters.workerName }),
    compare: "previous",
  };
}
