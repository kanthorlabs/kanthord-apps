import { useSearchParams } from "react-router-dom";

import type { TraceSpan } from "@/api/types";
import { sessionSpansOf } from "@/lib/conversation-spans";
import { withParam } from "@/lib/trace-query";

const DEFAULT_TAB = "span_tree";
const CONVERSATION_TAB = "conversation";
const TABS: readonly string[] = [DEFAULT_TAB, CONVERSATION_TAB];
const NO_SPANS: readonly TraceSpan[] = [];

export interface TraceSelection {
  readonly tab: string;
  readonly span: string | null;
  readonly entry: string | null;
  readonly session: string | null;
  readonly selectTab: (tab: string) => void;
  readonly selectSpan: (spanId: string | null) => void;
  readonly selectEntry: (entryId: string | null) => void;
  readonly selectSession: (sessionId: string) => void;
  readonly showInTimeline: (spanId: string) => void;
  readonly openInConversation: (sessionId: string, entryId: string) => void;
}

export function useTraceSelection(spans: readonly TraceSpan[] = NO_SPANS): TraceSelection {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = requested !== null && TABS.includes(requested) ? requested : DEFAULT_TAB;
  const sessions = sessionSpansOf(spans);
  const requestedSession = params.get("session");
  const session =
    sessions.find((candidate) => candidate.span_id === requestedSession)?.span_id ??
    sessions[0]?.span_id ??
    null;

  const write = (changes: Readonly<Record<string, string | null>>) =>
    setParams(
      (current) =>
        Object.entries(changes).reduce(
          (next, [key, value]) => withParam(next, key, value),
          current,
        ),
      { replace: true },
    );

  return {
    tab,
    span: params.get("span"),
    entry: params.get("entry"),
    session,
    selectTab: (next) => write({ tab: next }),
    selectSpan: (spanId) => write({ tab, span: spanId }),
    selectEntry: (entryId) => write({ entry: entryId }),
    selectSession: (sessionId) => write({ session: sessionId, entry: null }),
    showInTimeline: (spanId) => write({ tab: DEFAULT_TAB, span: spanId }),
    openInConversation: (sessionId, entryId) =>
      write({ tab: CONVERSATION_TAB, session: sessionId, entry: entryId }),
  };
}
