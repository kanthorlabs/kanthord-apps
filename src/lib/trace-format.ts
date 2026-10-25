import type { TraceSummary } from "@/api/types";

const THOUSAND = 1000;
const MILLION = 1000000;
const DOLLAR = 1;

export function tokenText(count: number): string {
  if (count < THOUSAND) return String(Math.round(count));
  if (count < MILLION) return `${(count / THOUSAND).toFixed(1)}k`;
  return `${(count / MILLION).toFixed(1)}M`;
}

export function costText(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < DOLLAR) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

const PERCENT = 100;

export function cacheShareText(summary: TraceSummary): string {
  const total = summary.input_tokens + summary.cache_read_tokens + summary.cache_creation_tokens;
  if (total === 0) return "0%";
  return `${Math.round((summary.cache_read_tokens / total) * PERCENT)}%`;
}
