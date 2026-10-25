import type { TraceListQuery, TraceSort, TraceState } from "@/api/types";

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
  "state",
  "range",
  "q",
  "worker_name",
  "agent_name",
  "model",
  "error_type",
  "min_duration_ms",
  "min_total_tokens",
  "min_cost_usd",
  "sort",
] as const;

const TEXT_KEYS = ["project_id", "q", "worker_name", "agent_name", "model", "error_type"] as const;
const MINIMUM_KEYS = ["min_duration_ms", "min_total_tokens", "min_cost_usd"] as const;
const TRACE_STATES: readonly TraceState[] = ["open", "ok", "error"];
const TRACE_SORTS: readonly TraceSort[] = ["started_at", "duration_ms", "total_tokens", "cost_usd"];

type MutableQuery = { -readonly [K in keyof TraceListQuery]: TraceListQuery[K] };

export function isTimeRange(value: string | null): value is TimeRange {
  return value !== null && (TIME_RANGES as readonly string[]).includes(value);
}

function minimumOf(value: string): number | null {
  if (value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
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
  const sort = TRACE_SORTS.find((candidate) => candidate === params.get("sort"));
  if (sort) query.sort = sort;
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
