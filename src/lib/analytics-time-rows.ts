import type { AnalyticsDurationItem, AnalyticsMeasure } from "@/api/types";

import { bucketTextOf, type CostField, costKeyLabel, tracesPathOf } from "./analytics-cost-rows";
import type { AnalyticsSelectableBucket, TimeGroupName } from "./analytics-query";
import { durationText } from "./format";

export interface TimeMark {
  readonly label: string;
  readonly percent: number;
}

export interface TimeRow {
  readonly key: string;
  readonly title: string;
  readonly bucketText: string | null;
  readonly fields: readonly CostField[];
  readonly max: number;
  readonly scale: number;
  readonly marks: readonly TimeMark[];
  readonly barLabel: string;
  readonly tracesPath: string | null;
}

const ALL_TITLE = "All";
const FULL_PERCENT = 100;

function valueTextOf(measure: AnalyticsMeasure, value: number): string {
  return measure === "revision_turns" ? String(value) : durationText(value);
}

function titleOf(
  key: string | null,
  group: TimeGroupName,
  names: ReadonlyMap<string, string>,
): string {
  return group === "none" ? ALL_TITLE : costKeyLabel(key, names);
}

export function timeRowsOf(
  items: readonly AnalyticsDurationItem[],
  measure: AnalyticsMeasure,
  bucket: AnalyticsSelectableBucket,
  group: TimeGroupName,
  names: ReadonlyMap<string, string>,
): readonly TimeRow[] {
  const largest = Math.max(0, ...items.map((item) => item.max));
  const scale = largest > 0 ? largest : 1;
  return items.map((item) => {
    const title = titleOf(item.key, group, names);
    const bucketText = bucketTextOf(bucket, item.bucket_start);
    const percentiles = [
      { label: "p50", value: item.p50 },
      { label: "p90", value: item.p90 },
      { label: "p99", value: item.p99 },
    ];
    const texts = [
      ...percentiles.map(({ label, value }) => `${label} ${valueTextOf(measure, value)}`),
      `max ${valueTextOf(measure, item.max)}`,
    ];
    return {
      key: JSON.stringify([item.bucket_start, item.key]),
      title,
      bucketText,
      fields: [
        { label: "Count", value: String(item.count) },
        ...percentiles.map(({ label, value }) => ({
          label,
          value: valueTextOf(measure, value),
        })),
        { label: "Max", value: valueTextOf(measure, item.max) },
      ],
      max: item.max,
      scale,
      marks: percentiles.map(({ label, value }) => ({
        label,
        percent: (value / scale) * FULL_PERCENT,
      })),
      barLabel: `Time of ${title}${bucketText === null ? "" : ` ${bucketText}`}: ${texts.join(", ")}`,
      tracesPath: tracesPathOf(group, item.key),
    };
  });
}
