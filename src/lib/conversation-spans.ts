import type { TraceSpan } from "@/api/types";

import { utcDateTime } from "./format";
import { conversationIdOf, isTurn, replyEntryIdOf } from "./span-detail";

const OPERATION_SESSION = "agent.session";
const ATTRIBUTE_AGENT_NAME = "kanthord.agent.name";
const FALLBACK_AGENT_NAME = "Agent";
const LABEL_SEPARATOR = " · ";

function startOf(span: TraceSpan): number {
  return span.start_time ?? Number.POSITIVE_INFINITY;
}

export function sessionSpansOf(spans: readonly TraceSpan[]): readonly TraceSpan[] {
  return spans
    .filter((span) => span.operation === OPERATION_SESSION)
    .sort((a, b) => startOf(a) - startOf(b));
}

export function sessionLabel(session: TraceSpan): string {
  const name = session.attributes[ATTRIBUTE_AGENT_NAME];
  const agent = typeof name === "string" ? name : FALLBACK_AGENT_NAME;
  return session.start_time === null
    ? agent
    : `${agent}${LABEL_SEPARATOR}${utcDateTime(session.start_time)}`;
}

export function turnsByEntry(
  spans: readonly TraceSpan[],
  sessionId: string,
): ReadonlyMap<string, TraceSpan> {
  const turns = new Map<string, TraceSpan>();
  for (const span of spans) {
    const entryId =
      isTurn(span) && conversationIdOf(span) === sessionId ? replyEntryIdOf(span) : null;
    if (entryId !== null && !turns.has(entryId)) turns.set(entryId, span);
  }
  return turns;
}
