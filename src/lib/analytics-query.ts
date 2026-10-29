import type {
  AnalyticsBucket,
  AnalyticsCostGroup,
  AnalyticsCostQuery,
  AnalyticsDurationGroup,
  AnalyticsDurationQuery,
  AnalyticsMeasure,
} from "@/api/types";

import { rangeStartOf, TIME_RANGE_LABELS } from "./trace-query";

export const ANALYTICS_RANGES = ["24h", "7d", "30d"] as const;

export type AnalyticsTimeRange = (typeof ANALYTICS_RANGES)[number];

export type AnalyticsSelectableBucket = Exclude<AnalyticsBucket, "none">;

export type CostGroupName = Exclude<AnalyticsCostGroup, "none">;

export interface AnalyticsFilters {
  readonly projectId: string | null;
  readonly range: AnalyticsTimeRange;
  readonly bucket: AnalyticsSelectableBucket;
}

export interface CostQueries {
  readonly grouped: AnalyticsCostQuery;
  readonly totals: AnalyticsCostQuery;
}

export type TimeGroupName = AnalyticsDurationGroup;

interface Option<T extends string> {
  readonly value: T;
  readonly label: string;
}

const DEFAULT_RANGE: AnalyticsTimeRange = "7d";
const DEFAULT_BUCKET: AnalyticsSelectableBucket = "day";
const DEFAULT_COST_GROUP: CostGroupName = "model";

const BUCKET_LABELS: Readonly<Record<AnalyticsSelectableBucket, string>> = {
  hour: "Hour",
  day: "Day",
  week: "Week",
};

const COST_GROUP_LABELS: Readonly<Record<CostGroupName, string>> = {
  model: "Model",
  agent_name: "Agent",
  provider_name: "Provider",
  worker_name: "Worker",
  node_id: "Node",
  project_id: "Project",
};

const DEFAULT_TIME_MEASURE: AnalyticsMeasure = "span_duration";
const DEFAULT_TIME_GROUP: TimeGroupName = "none";

const TIME_MEASURE_LABELS: Readonly<Record<AnalyticsMeasure, string>> = {
  span_duration: "Span duration",
  tool_latency: "Tool latency",
  verification_time: "Verification time",
  queue_wait: "Queue wait",
  review_wait: "Review wait",
  revision_turns: "Revision turns",
  test_floor_share: "Test floor share",
};

const TIME_GROUP_LABELS: Readonly<Record<TimeGroupName, string>> = {
  none: "None",
  operation: "Operation",
  tool_name: "Tool",
  agent_name: "Agent",
  model: "Model",
  worker_name: "Worker",
  node_id: "Node",
  project_id: "Project",
};

function optionsOf<T extends string>(labels: Readonly<Record<T, string>>): readonly Option<T>[] {
  return (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value] }));
}

export const ANALYTICS_RANGE_OPTIONS: readonly Option<AnalyticsTimeRange>[] = ANALYTICS_RANGES.map(
  (value) => ({ value, label: TIME_RANGE_LABELS[value] }),
);

export const ANALYTICS_BUCKET_OPTIONS = optionsOf(BUCKET_LABELS);

export const COST_GROUP_OPTIONS = optionsOf(COST_GROUP_LABELS);

export const TIME_MEASURE_OPTIONS = optionsOf(TIME_MEASURE_LABELS);

export const TIME_GROUP_OPTIONS = optionsOf(TIME_GROUP_LABELS);

function choiceOf<T extends string>(
  options: readonly Option<T>[],
  requested: string | null,
  fallback: T,
): T {
  return options.find((option) => option.value === requested)?.value ?? fallback;
}

export function analyticsFiltersOf(params: URLSearchParams): AnalyticsFilters {
  return {
    projectId: params.get("project_id") || null,
    range: choiceOf(ANALYTICS_RANGE_OPTIONS, params.get("range"), DEFAULT_RANGE),
    bucket: choiceOf(ANALYTICS_BUCKET_OPTIONS, params.get("bucket"), DEFAULT_BUCKET),
  };
}

export function costGroupOf(params: URLSearchParams): CostGroupName {
  return choiceOf(COST_GROUP_OPTIONS, params.get("group_by"), DEFAULT_COST_GROUP);
}

export function costQueriesOf(
  filters: AnalyticsFilters,
  group: CostGroupName,
  now: number,
): CostQueries {
  const scope = {
    from: rangeStartOf(filters.range, now) ?? now,
    to: now,
    ...(filters.projectId === null ? {} : { project_id: filters.projectId }),
  };
  return {
    grouped: { ...scope, bucket: filters.bucket, group_by: group },
    totals: { ...scope, bucket: "none", group_by: "none" },
  };
}

export function timeMeasureOf(params: URLSearchParams): AnalyticsMeasure {
  return choiceOf(TIME_MEASURE_OPTIONS, params.get("time_measure"), DEFAULT_TIME_MEASURE);
}

export function timeGroupOf(params: URLSearchParams): TimeGroupName {
  return choiceOf(TIME_GROUP_OPTIONS, params.get("time_group_by"), DEFAULT_TIME_GROUP);
}

export function timeQueryOf(
  filters: AnalyticsFilters,
  measure: AnalyticsMeasure,
  group: TimeGroupName,
  now: number,
): AnalyticsDurationQuery {
  return {
    from: rangeStartOf(filters.range, now) ?? now,
    to: now,
    ...(filters.projectId === null ? {} : { project_id: filters.projectId }),
    bucket: filters.bucket,
    measure,
    group_by: group,
  };
}
