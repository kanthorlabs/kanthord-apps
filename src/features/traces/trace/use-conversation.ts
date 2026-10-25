import { useMemo } from "react";

import type { TraceSessionEntry, TraceSpan } from "@/api/types";
import {
  causalEntryIdOf,
  promptLabelsOf,
  sessionLabel,
  sessionSpansOf,
  turnsByEntry,
} from "@/lib/conversation-spans";

export interface SessionOption {
  readonly value: string;
  readonly label: string;
}

export interface ConversationView {
  readonly sessions: readonly SessionOption[];
  readonly turnOf: (entryId: string) => TraceSpan | null;
  readonly promptLabelOf: (entryId: string) => string | null;
  readonly causalEntryId: string | null;
}

export function useConversation(
  spans: readonly TraceSpan[],
  sessionId: string | null,
  entries: readonly TraceSessionEntry[],
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
  return {
    sessions,
    turnOf: (entryId) => turns.get(entryId) ?? null,
    promptLabelOf: (entryId) => labels.get(entryId) ?? null,
    causalEntryId,
  };
}
