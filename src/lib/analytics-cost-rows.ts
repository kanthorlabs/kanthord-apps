import type { AnalyticsCostItem } from "@/api/types";

import type { AnalyticsSelectableBucket } from "./analytics-query";
import { utcDateTime } from "./format";
import { costText, tokenText } from "./trace-format";

export interface CostField {
  readonly label: string;
  readonly value: string;
}

export interface CostRow {
  readonly key: string;
  readonly title: string;
  readonly bucketText: string | null;
  readonly fields: readonly CostField[];
  readonly cost: number;
  readonly costText: string;
  readonly maxCost: number;
}

const UNKNOWN_KEY = "Unknown";
const DATE_LENGTH = 10;

function dateText(ms: number): string {
  return new Date(ms).toISOString().slice(0, DATE_LENGTH);
}

export function bucketTextOf(
  bucket: AnalyticsSelectableBucket,
  start: number | null,
): string | null {
  if (start === null) return null;
  if (bucket === "hour") return utcDateTime(start);
  if (bucket === "week") return `Week of ${dateText(start)}`;
  return dateText(start);
}

export function costKeyLabel(key: string | null, names: ReadonlyMap<string, string>): string {
  if (key === null) return UNKNOWN_KEY;
  return names.get(key) ?? key;
}

export function costFieldsOf(item: AnalyticsCostItem): readonly CostField[] {
  return [
    { label: "Turns", value: String(item.turn_count) },
    { label: "Input", value: tokenText(item.input_tokens) },
    { label: "Output", value: tokenText(item.output_tokens) },
    {
      label: "Cached",
      value: tokenText(item.cache_read_tokens + item.cache_creation_tokens),
    },
    { label: "Est. cost", value: costText(item.cost_usd) },
  ];
}

export function costRowsOf(
  items: readonly AnalyticsCostItem[],
  bucket: AnalyticsSelectableBucket,
  names: ReadonlyMap<string, string>,
): readonly CostRow[] {
  const largest = Math.max(0, ...items.map((item) => item.cost_usd));
  const maxCost = largest > 0 ? largest : 1;
  return items.map((item) => ({
    key: JSON.stringify([item.bucket_start, item.key]),
    title: costKeyLabel(item.key, names),
    bucketText: bucketTextOf(bucket, item.bucket_start),
    fields: costFieldsOf(item),
    cost: item.cost_usd,
    costText: costText(item.cost_usd),
    maxCost,
  }));
}
