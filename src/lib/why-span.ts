import type { SpanStatus, TraceSpan } from "@/api/types";

import { ErrorRole } from "./causal-span";
import { spanLabel } from "./span-labels";

const ROLE_TEXTS: Readonly<Record<ErrorRole, string>> = {
  [ErrorRole.Causal]: "Causal span of this trace.",
  [ErrorRole.Consequence]: "Consequence of the stop.",
  [ErrorRole.Recovered]: "Recovered error.",
};

const ENDED_TEXTS: Readonly<Record<SpanStatus, string>> = {
  Unset: "with no status",
  Ok: "OK",
  Error: "Error",
};

function parentLine(span: TraceSpan, spans: readonly TraceSpan[]): readonly string[] {
  if (span.parent_span_id === null) return [];
  const parent = spans.find((candidate) => candidate.span_id === span.parent_span_id);
  if (parent === undefined) return ["Parent span not stored."];
  return [`Parent ${spanLabel(parent)} ended ${ENDED_TEXTS[parent.status]}.`];
}

export function whySpanLines(
  span: TraceSpan,
  spans: readonly TraceSpan[],
  roles: ReadonlyMap<string, ErrorRole>,
): readonly string[] {
  const role = roles.get(span.span_id);
  return [...(role === undefined ? [] : [ROLE_TEXTS[role]]), ...parentLine(span, spans)];
}
