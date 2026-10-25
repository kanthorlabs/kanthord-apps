import { useSearchParams } from "react-router-dom";

import type { TraceSpan } from "@/api/types";
import { sessionSpansOf } from "@/lib/conversation-spans";
import { withParam } from "@/lib/trace-query";

const DEFAULT_TAB = "summary";
const STEPS_TAB = "steps";
const CONVERSATION_TAB = "conversation";
const TABS: readonly string[] = [DEFAULT_TAB, STEPS_TAB, CONVERSATION_TAB];
const TAB_ALIASES: Readonly<Record<string, string>> = { span_tree: STEPS_TAB };
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
  const named = requested === null ? null : (TAB_ALIASES[requested] ?? requested);
  const tab = named !== null && TABS.includes(named) ? named : DEFAULT_TAB;
  const sessions = sessionSpansOf(spans);
  const requestedSession = params.get("session");
  const session =
    sessions.find((candidate) => candidate.span_id === requestedSession)?.span_id ??
    sessions[0]?.span_id ??
    null;
  const spanOpen = params.get("span") !== null;

  const write = (changes: Readonly<Record<string, string | null>>) => {
    const opensSpan = !spanOpen && (changes.span ?? null) !== null;
    setParams(
      (current) =>
        Object.entries(changes).reduce(
          (next, [key, value]) => withParam(next, key, value),
          current,
        ),
      { replace: !opensSpan },
    );
  };

  return {
    tab,
    span: params.get("span"),
    entry: params.get("entry"),
    session,
    selectTab: (next) => write({ tab: next }),
    selectSpan: (spanId) => write({ tab, span: spanId }),
    selectEntry: (entryId) => write({ entry: entryId }),
    selectSession: (sessionId) => write({ session: sessionId, entry: null }),
    showInTimeline: (spanId) => write({ tab: STEPS_TAB, span: spanId }),
    openInConversation: (sessionId, entryId) =>
      write({ tab: CONVERSATION_TAB, session: sessionId, entry: entryId }),
  };
}
