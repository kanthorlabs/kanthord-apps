import { useMemo } from "react";

import type { TraceSpan } from "@/api/types";
import { sessionLabel, sessionSpansOf, turnsByEntry } from "@/lib/conversation-spans";

export interface SessionOption {
  readonly value: string;
  readonly label: string;
}

export interface ConversationView {
  readonly sessions: readonly SessionOption[];
  readonly turnOf: (entryId: string) => TraceSpan | null;
}

export function useConversation(
  spans: readonly TraceSpan[],
  sessionId: string | null,
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
  return { sessions, turnOf: (entryId) => turns.get(entryId) ?? null };
}
