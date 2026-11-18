import type { ChatItem } from "@/lib/workbench-chat";

interface QueueClearEntryProps {
  readonly item: Extract<ChatItem, { kind: "queue-clear" }>;
}

export function QueueClearEntry({ item }: QueueClearEntryProps) {
  const action = item.cause === "stop" ? "stopped" : "replaced";
  const noun = item.count === 1 ? "queued message was" : "queued messages were";
  return (
    <p role="status" className="text-sm text-muted-foreground">
      The owner {action} the run. {item.count} {noun} cleared.
    </p>
  );
}
