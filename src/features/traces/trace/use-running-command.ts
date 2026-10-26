import { readSessionEntry } from "@/api/resources/tracking";
import type { TraceSpan } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { entryView, toolCallIn } from "@/lib/session-entries";
import { conversationIdOf, isTool, replyEntryIdOf, toolCallIdOf } from "@/lib/span-detail";
import { commandLineOf } from "@/lib/tool-command";

interface CommandRef {
  readonly sessionId: string;
  readonly entryId: string;
  readonly callId: string;
}

function commandRefOf(span: TraceSpan | null): CommandRef | null {
  if (span === null || !isTool(span)) return null;
  const sessionId = conversationIdOf(span);
  const entryId = replyEntryIdOf(span);
  const callId = toolCallIdOf(span);
  return sessionId === null || entryId === null || callId === null
    ? null
    : { sessionId, entryId, callId };
}

export function useRunningCommand(traceId: string, span: TraceSpan | null): string | null {
  const ref = commandRefOf(span);
  const command = useResource(async () => {
    if (ref === null) return null;
    const entry = await readSessionEntry(traceId, ref.sessionId, ref.entryId);
    const call = toolCallIn(entryView(entry), ref.callId);
    return call === null ? null : commandLineOf(call.arguments);
  }, [traceId, ref?.sessionId, ref?.entryId, ref?.callId]);
  return ref === null ? null : command.data;
}
