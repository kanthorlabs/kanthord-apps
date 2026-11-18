import type { ChatItem } from "@/lib/workbench-chat";

interface ScopeStopEntryProps {
  readonly item: Extract<ChatItem, { kind: "scope-stop" }>;
}

export function ScopeStopEntry({ item }: ScopeStopEntryProps) {
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {item.text}
    </p>
  );
}
