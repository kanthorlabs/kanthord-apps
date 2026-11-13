import { runErrorTargetId } from "@/lib/workbench-chat";
import type { ChatItem } from "@/lib/workbench-chat";
import { ChatEntry } from "./chat-entry";
import { InlineError } from "./inline-error";

interface ChatTranscriptProps {
  readonly items: readonly ChatItem[];
  readonly runError: string | null;
}

export function ChatTranscript({ items, runError }: ChatTranscriptProps) {
  const targetId = runError === null ? null : runErrorTargetId(items);
  return (
    <div role="log" aria-label="Transcript" className="flex min-w-0 flex-col gap-3">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No messages. Write the first one below.</p>
      )}
      {items.map((item) => (
        <ChatEntry key={item.id} item={item} runError={item.id === targetId ? runError : null} />
      ))}
      {runError !== null && targetId === null && <InlineError code={null} message={runError} />}
    </div>
  );
}
