import { queueClearSentence } from "@/lib/guest-chat";
import type { ChatItem } from "@/lib/workbench-chat";

interface QueueClearEntryProps {
  readonly item: Extract<ChatItem, { kind: "queue-clear" }>;
}

export function QueueClearEntry({ item }: QueueClearEntryProps) {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {queueClearSentence(item.count, item.cause)}
    </p>
  );
}
