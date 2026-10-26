import type { SpanStatus, TraceSpan, TraceState } from "@/api/types";

import { durationText } from "./format";
import type { SpanUsage } from "./span-usage";
import { costText, PRICE_LABEL } from "./trace-format";

const STATUS_TEXTS: Readonly<Record<SpanStatus, string>> = {
  Unset: "Unset",
  Ok: "OK",
  Error: "Error",
};

const ATTRIBUTE_ERROR_TYPE = "error.type";
const SEPARATOR = " · ";

function durationOf(span: TraceSpan, traceState: TraceState): string {
  if (span.start_time === null) return "No start recorded";
  if (span.end_time !== null) return durationText(span.end_time - span.start_time);
  return traceState === "open" ? "Running" : "No end recorded";
}

export function spanHeadline(
  span: TraceSpan,
  usage: SpanUsage | undefined,
  traceState: TraceState,
): string {
  const errorType = span.attributes[ATTRIBUTE_ERROR_TYPE];
  return [
    STATUS_TEXTS[span.status],
    ...(typeof errorType === "string" ? [errorType] : []),
    durationOf(span, traceState),
    ...(usage === undefined ? [] : [`${PRICE_LABEL} ${costText(usage.costUsd)}`]),
  ].join(SEPARATOR);
}
