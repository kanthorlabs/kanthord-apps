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

export const PRICE_LABEL = "API price";
export const PRICE_NOTE =
  "API price is the list price of these tokens at the provider. A subscription does not pay this amount.";

export interface CacheFacts {
  readonly uncached: number;
  readonly read: number;
  readonly write: number;
  readonly hitRatio: number;
}

export function cacheFacts(input: number, read: number, write: number): CacheFacts {
  const hitRatio = input === 0 ? 0 : Math.min(1, Math.max(0, read / input));
  return { uncached: Math.max(0, input - read - write), read, write, hitRatio };
}

export function percentText(ratio: number): string {
  return `${Math.round(ratio * PERCENT)}%`;
}

export function cacheShareText(summary: TraceSummary): string {
  const { input_tokens: input, cache_read_tokens: read, cache_creation_tokens: write } = summary;
  return percentText(cacheFacts(input, read, write).hitRatio);
}
