import type { ChatItem } from "@/lib/workbench-chat";
import { ChatEntry } from "./chat-entry";

export function ChatTranscript({ items }: { items: readonly ChatItem[] }) {
  return (
    <div role="log" aria-label="Transcript" className="flex min-w-0 flex-col gap-3">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No messages. Write the first one below.</p>
      )}
      {items.map((item) => (
        <ChatEntry key={item.id} item={item} />
      ))}
    </div>
  );
}
