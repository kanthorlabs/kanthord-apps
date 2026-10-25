import type { TraceListItem } from "@/api/types";

import { durationText, utcDateTime, utcShortDateTime } from "./format";
import { costText } from "./trace-format";

export interface TraceFact {
  readonly label: string;
  readonly value: string;
  readonly compact: string;
}

function countText(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function same(label: string, value: string): TraceFact {
  return { label, value, compact: value };
}

export function traceFactsOf(trace: TraceListItem): readonly TraceFact[] {
  const facts: TraceFact[] = [];
  if (trace.worker_name !== null) facts.push(same("Worker", trace.worker_name));
  if (trace.attempt !== null) {
    facts.push({ label: "Attempt", value: String(trace.attempt), compact: `#${trace.attempt}` });
  }
  facts.push(
    same("Duration", trace.duration_ms === null ? "running" : durationText(trace.duration_ms)),
    same("Est. cost", costText(trace.cost_usd)),
  );
  if (trace.started_at !== null) {
    facts.push({
      label: "Started",
      value: utcDateTime(trace.started_at),
      compact: utcShortDateTime(trace.started_at),
    });
  }
  facts.push(
    {
      label: "Turns",
      value: String(trace.turn_count),
      compact: countText(trace.turn_count, "turn"),
    },
    {
      label: "Errors (incl. recovered)",
      value: String(trace.error_count),
      compact: `${trace.error_count} err`,
    },
  );
  return facts;
}
