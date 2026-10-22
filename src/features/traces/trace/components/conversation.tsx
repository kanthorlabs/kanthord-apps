import type { TraceSpan } from "@/api/types";
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
import { useSessionEntries } from "../use-session-entries";
import type { TraceSelection } from "../use-trace-selection";
import { EntryBlock } from "./entry-block";

interface TranscriptProps {
  readonly traceId: string;
  readonly sessionId: string;
  readonly live: boolean;
  readonly conversation: ConversationView;
  readonly selection: TraceSelection;
}

function Transcript({ traceId, sessionId, live, conversation, selection }: TranscriptProps) {
  const { entries, loading, error, retry } = useSessionEntries(traceId, sessionId, live);
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
              onShowInTimeline={selection.showInTimeline}
            />
          ))}
        </ItemGroup>
      )}
      {error !== null && (
        <Alert variant="destructive" className="flex flex-wrap items-center gap-2">
          <AlertDescription>{error.message}</AlertDescription>
          <Button variant="outline" size="sm" onClick={retry}>
            Retry
          </Button>
        </Alert>
      )}
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
  const conversation = useConversation(spans, session);
  if (session === null) return <p>This trace holds no agent session.</p>;
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {conversation.sessions.length >= 2 && (
        <Select
          items={conversation.sessions}
          value={session}
          onValueChange={(next) => next !== null && selection.selectSession(next)}
        >
          <SelectTrigger aria-label="Session" className="w-full md:w-96">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {conversation.sessions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Transcript
        traceId={traceId}
        sessionId={session}
        live={live}
        conversation={conversation}
        selection={selection}
      />
    </div>
  );
}
