import type { TraceSpan } from "@/api/types";
import { TouchTarget } from "@/components/touch-target";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

import { useConversation, type ConversationView } from "../use-conversation";
import { useSessionEntries, type SessionEntries } from "../use-session-entries";
import type { TraceSelection } from "../use-trace-selection";
import { EntryBlock } from "./entry-block";

interface TranscriptProps {
  readonly sessionEntries: SessionEntries;
  readonly conversation: ConversationView;
  readonly selection: TraceSelection;
}

function Transcript({ sessionEntries, conversation, selection }: TranscriptProps) {
  const { entries, loading, error, retry } = sessionEntries;
  if (loading)
    return <Skeleton role="status" aria-label="Loading entries" className="h-40 w-full" />;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {entries.length === 0 && error === null ? (
        <p className="text-muted-foreground">This session holds no entries.</p>
      ) : (
        <ItemGroup role="list" aria-label="Entries" className="min-w-0 gap-3">
          {entries.map((entry) => (
            <EntryBlock
              key={entry.sequence}
              entry={entry}
              current={entry.entry_id === selection.entry}
              turn={conversation.turnOf(entry.entry_id)}
              promptLabel={conversation.promptLabelOf(entry.entry_id)}
              onShowInTimeline={selection.showInTimeline}
            />
          ))}
        </ItemGroup>
      )}
      {error !== null && (
        <Alert variant="destructive" className="flex flex-wrap items-center gap-2">
          <AlertDescription>{error.message}</AlertDescription>
          <TouchTarget>
            <Button variant="outline" size="sm" onClick={retry}>
              Retry
            </Button>
          </TouchTarget>
        </Alert>
      )}
    </div>
  );
}

interface HeadProps {
  readonly session: string;
  readonly conversation: ConversationView;
  readonly selection: TraceSelection;
}

function Head({ session, conversation, selection }: HeadProps) {
  const { sessions, causalEntryId } = conversation;
  if (sessions.length < 2 && causalEntryId === null) return null;
  return (
    <div className="sticky top-[calc(var(--app-header-height,3.5rem)+var(--trace-sticky-height,0px))] z-[5] flex min-w-0 flex-wrap items-center gap-2 bg-background py-1">
      {sessions.length >= 2 && (
        <TouchTarget>
          <Select
            items={sessions}
            value={session}
            onValueChange={(next) => next !== null && selection.selectSession(next)}
          >
            <SelectTrigger aria-label="Session" className="w-full md:w-96">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TouchTarget>
      )}
      {causalEntryId !== null && (
        <TouchTarget>
          <Button variant="outline" onClick={() => selection.selectEntry(causalEntryId)}>
            Jump to the causal entry
          </Button>
        </TouchTarget>
      )}
    </div>
  );
}

interface SessionConversationProps {
  readonly traceId: string;
  readonly sessionId: string;
  readonly spans: readonly TraceSpan[];
  readonly live: boolean;
  readonly selection: TraceSelection;
}

function SessionConversation({
  traceId,
  sessionId,
  spans,
  live,
  selection,
}: SessionConversationProps) {
  const sessionEntries = useSessionEntries(traceId, sessionId, live);
  const conversation = useConversation(spans, sessionId, sessionEntries.entries);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Head session={sessionId} conversation={conversation} selection={selection} />
      <Transcript
        sessionEntries={sessionEntries}
        conversation={conversation}
        selection={selection}
      />
    </div>
  );
}

interface ConversationProps {
  readonly traceId: string;
  readonly spans: readonly TraceSpan[];
  readonly live: boolean;
  readonly selection: TraceSelection;
}

export function Conversation({ traceId, spans, live, selection }: ConversationProps) {
  const { session } = selection;
  if (session === null) return <p>This trace holds no agent session.</p>;
  return (
    <SessionConversation
      traceId={traceId}
      sessionId={session}
      spans={spans}
      live={live}
      selection={selection}
    />
  );
}
