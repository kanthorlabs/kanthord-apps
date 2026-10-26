import type { TraceSpan } from "@/api/types";

import { durationText } from "./format";
import { spanLabel } from "./span-labels";

const MINUTE_MS = 60_000;
const GAP_POLLS = 6;

export interface NowFacts {
  readonly running: TraceSpan | null;
  readonly runningLabel: string | null;
  readonly age: string | null;
  readonly sinceLatestRecord: string | null;
  readonly gapWarning: string | null;
}

function depthOf(parents: ReadonlyMap<string, string | null>, spanId: string): number {
  let depth = 0;
  let current = parents.get(spanId) ?? null;
  while (current !== null && depth <= parents.size) {
    depth += 1;
    current = parents.get(current) ?? null;
  }
  return depth;
}

export function runningSpanOf(spans: readonly TraceSpan[]): TraceSpan | null {
  const parents = new Map(spans.map((span) => [span.span_id, span.parent_span_id]));
  return spans
    .filter((span) => span.end_time === null)
    .reduce<TraceSpan | null>((deepest, span) => {
      if (deepest === null) return span;
      const difference = depthOf(parents, span.span_id) - depthOf(parents, deepest.span_id);
      if (difference !== 0) return difference > 0 ? span : deepest;
      return (span.start_time ?? Number.NEGATIVE_INFINITY) >=
        (deepest.start_time ?? Number.NEGATIVE_INFINITY)
        ? span
        : deepest;
    }, null);
}

export function nowFactsOf(spans: readonly TraceSpan[], now: number, pollMs: number): NowFacts {
  const running = runningSpanOf(spans);
  const latest = spans.reduce<number | null>(
    (last, span) => (last === null || span.created_at > last ? span.created_at : last),
    null,
  );
  const gap = latest === null ? 0 : Math.max(0, now - latest);
  return {
    running,
    runningLabel: running === null ? null : spanLabel(running),
    age:
      running === null || running.start_time === null
        ? null
        : durationText(now - running.start_time),
    sinceLatestRecord: latest === null ? null : durationText(gap),
    gapWarning:
      gap > GAP_POLLS * pollMs
        ? `No new record for ${Math.max(1, Math.floor(gap / MINUTE_MS))} min`
        : null,
  };
}
