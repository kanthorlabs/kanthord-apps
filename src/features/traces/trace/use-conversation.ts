import { useMemo } from "react";

import type { TraceSessionEntry, TraceSpan } from "@/api/types";
import {
  agentNameOf,
  causalEntryIdOf,
  promptLabelsOf,
  sessionLabel,
  sessionSpansOf,
  turnsByEntry,
} from "@/lib/conversation-spans";

import type { PromptSource } from "./use-resolved-prompt";

export interface SessionOption {
  readonly value: string;
  readonly label: string;
}

export interface ConversationView {
  readonly sessions: readonly SessionOption[];
  readonly turnOf: (entryId: string) => TraceSpan | null;
  readonly promptLabelOf: (entryId: string) => string | null;
  readonly causalEntryId: string | null;
  readonly promptSource: PromptSource | null;
}

export function useConversation(
  spans: readonly TraceSpan[],
  sessionId: string | null,
  entries: readonly TraceSessionEntry[],
  executionId: string | null,
): ConversationView {
  const sessions = useMemo(
    () =>
      sessionSpansOf(spans).map((session) => ({
        value: session.span_id,
        label: sessionLabel(session),
      })),
    [spans],
  );
  const turns = useMemo(
    () => (sessionId === null ? new Map<string, TraceSpan>() : turnsByEntry(spans, sessionId)),
    [spans, sessionId],
  );
  const labels = useMemo(() => promptLabelsOf(spans, entries), [spans, entries]);
  const causalEntryId = useMemo(
    () => (sessionId === null ? null : causalEntryIdOf(spans, sessionId, entries)),
    [spans, sessionId, entries],
  );
  const promptSource = useMemo(() => {
    const session = sessionSpansOf(spans).find((span) => span.span_id === sessionId);
    const agentName = session === undefined ? null : agentNameOf(session);
    return executionId === null || agentName === null ? null : { executionId, agentName };
  }, [spans, sessionId, executionId]);
  return {
    sessions,
    promptSource,
    turnOf: (entryId) => turns.get(entryId) ?? null,
    promptLabelOf: (entryId) => labels.get(entryId) ?? null,
    causalEntryId,
  };
}
