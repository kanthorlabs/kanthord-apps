import {
  CAUSE_CATEGORIES,
  type TraceListQuery,
  type TraceSort,
  type TraceState,
} from "@/api/types";

const TIME_RANGES = ["1h", "24h", "7d", "30d", "all"] as const;

export type TimeRange = (typeof TIME_RANGES)[number];

export const DEFAULT_TIME_RANGE: TimeRange = "7d";

export const TIME_RANGE_LABELS: Readonly<Record<TimeRange, string>> = {
  "1h": "Last hour",
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  all: "All time",
};

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

const TIME_RANGE_MS: Readonly<Record<Exclude<TimeRange, "all">, number>> = {
  "1h": HOUR_MS,
  "24h": DAY_MS,
  "7d": 7 * DAY_MS,
  "30d": 30 * DAY_MS,
};

export const TRACE_QUERY_KEYS = [
  "project_id",
  "node_id",
  "state",
  "range",
  "q",
  "worker_name",
  "agent_name",
  "model",
  "error_type",
  "cause_category",
  "min_duration_ms",
  "min_total_tokens",
  "min_cost_usd",
  "sort",
  "from",
  "to",
] as const;

export type TraceQueryKey = (typeof TRACE_QUERY_KEYS)[number];

const TEXT_KEYS = [
  "project_id",
  "node_id",
  "q",
  "worker_name",
  "agent_name",
  "model",
  "error_type",
] as const;
const MINIMUM_KEYS = ["min_duration_ms", "min_total_tokens", "min_cost_usd"] as const;
const TRACE_STATES: readonly TraceState[] = ["open", "ok", "error"];
const TRACE_SORTS: readonly TraceSort[] = ["started_at", "duration_ms", "total_tokens", "cost_usd"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface TimeWindow {
  readonly from: number | null;
  readonly to: number | null;
}

type MutableQuery = { -readonly [K in keyof TraceListQuery]: TraceListQuery[K] };

export function isTimeRange(value: string | null): value is TimeRange {
  return value !== null && (TIME_RANGES as readonly string[]).includes(value);
}

function minimumOf(value: string): number | null {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function millisecondsParamOf(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const milliseconds = Number(value);
  return Number.isSafeInteger(milliseconds) ? milliseconds : null;
}

export function timeWindowOf(params: URLSearchParams): TimeWindow | null {
  const from = millisecondsParamOf(params.get("from"));
  const to = millisecondsParamOf(params.get("to"));
  if (from === null && to === null) return null;
  if (from !== null && to !== null && from > to) return null;
  return { from, to };
}

function windowInstantOf(milliseconds: number): string {
  const date = new Date(milliseconds);
  const time = date.toISOString().slice(11, 16);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()} ${time}`;
}

export function windowLabelOf(window: TimeWindow): string {
  if (window.from !== null && window.to !== null) {
    return `${windowInstantOf(window.from)} – ${windowInstantOf(window.to)} UTC`;
  }
  if (window.from !== null) return `From ${windowInstantOf(window.from)} UTC`;
  return `Until ${windowInstantOf(window.to as number)} UTC`;
}

export function rangeStartOf(range: TimeRange, now: number): number | null {
  return range === "all" ? null : now - TIME_RANGE_MS[range];
}

export function traceQueryOf(params: URLSearchParams, now: number): TraceListQuery {
  const query: MutableQuery = {};
  for (const key of TEXT_KEYS) {
    const value = params.get(key);
    if (value) query[key] = value;
  }
  for (const key of MINIMUM_KEYS) {
    const value = params.get(key);
    const minimum = value ? minimumOf(value) : null;
    if (minimum !== null) query[key] = minimum;
  }
  const state = TRACE_STATES.find((candidate) => candidate === params.get("state"));
  if (state) query.state = state;
  const causeCategory = CAUSE_CATEGORIES.find(
    (candidate) => candidate === params.get("cause_category"),
  );
  if (causeCategory) query.cause_category = causeCategory;
  const sort = TRACE_SORTS.find((candidate) => candidate === params.get("sort"));
  if (sort) query.sort = sort;
  const window = timeWindowOf(params);
  if (window !== null) {
    if (window.from !== null) query.from = window.from;
    if (window.to !== null) query.to = window.to;
    return query;
  }
  const rangeParam = params.get("range");
  const range = isTimeRange(rangeParam) ? rangeParam : DEFAULT_TIME_RANGE;
  if (range !== "all") query.from = now - TIME_RANGE_MS[range];
  return query;
}

export function withParam(
  params: URLSearchParams,
  key: string,
  value: string | null,
): URLSearchParams {
  const copy = new URLSearchParams(params);
  if (value === null || value === "") copy.delete(key);
  else copy.set(key, value);
  return copy;
}

export function withRange(params: URLSearchParams, range: string | null): URLSearchParams {
  const copy = withParam(params, "range", range);
  copy.delete("from");
  copy.delete("to");
  return copy;
}
