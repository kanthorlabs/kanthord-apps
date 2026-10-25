import type { TraceSessionEntry, TraceSpan } from "@/api/types";

import { pinnedContextEntryIds, workPromptEntryIds } from "./agent-prompt-parts";
import { pickCausalSpan } from "./causal-span";
import { utcDateTime } from "./format";
import { conversationIdOf, isTool, isTurn, replyEntryIdOf, toolCallIdOf } from "./span-detail";

const OPERATION_SESSION = "agent.session";
const ATTRIBUTE_AGENT_NAME = "kanthord.agent.name";
const FALLBACK_AGENT_NAME = "Agent";
const LABEL_SEPARATOR = " · ";
const SYSTEM_PROMPT_LABEL = "System prompt";
const WORK_PROMPT_LABEL = "Work prompt";

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

export function promptLabelsOf(
  spans: readonly TraceSpan[],
  entries: readonly TraceSessionEntry[],
): ReadonlyMap<string, string> {
  const labels = new Map<string, string>();
  for (const [taskId, entryId] of workPromptEntryIds(spans, entries)) {
    labels.set(entryId, `${WORK_PROMPT_LABEL} ${taskId}`);
  }
  for (const entryId of pinnedContextEntryIds(entries)) labels.set(entryId, SYSTEM_PROMPT_LABEL);
  return labels;
}

function causalEntryIdIn(
  causal: TraceSpan,
  sessionId: string,
  entries: readonly TraceSessionEntry[],
): string | null {
  if (isTurn(causal)) {
    const replyId = replyEntryIdOf(causal);
    if (conversationIdOf(causal) !== sessionId || replyId === null) return null;
    return entries.find((entry) => entry.entry_id === replyId)?.entry_id ?? null;
  }
  if (!isTool(causal)) return null;
  const callId = toolCallIdOf(causal);
  if (callId === null) return null;
  return entries.find((entry) => entry.tool_call_id === callId)?.entry_id ?? null;
}

export function causalEntryIdOf(
  spans: readonly TraceSpan[],
  sessionId: string,
  entries: readonly TraceSessionEntry[],
): string | null {
  const root = spans.find((span) => span.parent_span_id === null);
  if (root === undefined) return null;
  const causal = pickCausalSpan(spans, root.span_id);
  return causal === null ? null : causalEntryIdIn(causal, sessionId, entries);
}
