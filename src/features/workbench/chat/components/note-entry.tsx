import { Badge } from "@/components/ui/badge";
import type { ChatItem } from "@/lib/workbench-chat";
import { BubbleAuthor } from "./bubble-author";

interface NoteEntryProps {
  readonly item: Extract<ChatItem, { kind: "note" }>;
}

export function NoteEntry({ item }: NoteEntryProps) {
  return (
    <div className="flex max-w-[85%] min-w-0 flex-col items-start gap-1">
      <div className="flex min-w-0 items-center gap-2">
        <BubbleAuthor name={item.author.name} timestamp={item.timestamp} />
        {item.author.kind === "guest" && <Badge variant="outline">guest</Badge>}
      </div>
      <p className="rounded-lg border bg-muted px-3 py-2 text-sm break-words whitespace-pre-wrap">
        {item.text}
      </p>
    </div>
  );
}
