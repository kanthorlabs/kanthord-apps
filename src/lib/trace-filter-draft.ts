import type { TraceQueryKey } from "./trace-query";

const MS_PER_SECOND = 1000;

export const SHEET_KEYS = [
  "project_id",
  "range",
  "worker_name",
  "agent_name",
  "model",
  "error_type",
  "cause_category",
  "min_duration_ms",
  "min_total_tokens",
  "min_cost_usd",
  "sort",
] as const satisfies readonly TraceQueryKey[];

export type SheetKey = (typeof SHEET_KEYS)[number];

export function millisecondsOf(seconds: string): string | null {
  if (seconds.trim() === "") return null;
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return null;
  return String(Math.round(value * MS_PER_SECOND));
}

export function secondsOf(milliseconds: string | null): string {
  if (milliseconds === null) return "";
  const value = Number(milliseconds);
  return Number.isFinite(value) ? String(value / MS_PER_SECOND) : "";
}

export function sheetChangesOf(
  draft: URLSearchParams,
  durationSeconds: string,
): Readonly<Partial<Record<TraceQueryKey, string | null>>> {
  const changes: Partial<Record<TraceQueryKey, string | null>> = {};
  for (const key of SHEET_KEYS) changes[key] = draft.get(key);
  changes.min_duration_ms = millisecondsOf(durationSeconds);
  return changes;
}
