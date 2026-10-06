import { Badge } from "@/components/ui/badge";
import type { ChatItem } from "@/lib/workbench-chat";
import { MarkdownText } from "./markdown-text";
import { ToolRow } from "./tool-row";

const CALL_STATE_LABEL = { running: "Running", "awaiting-approval": "Awaiting Approval" } as const;

export function ChatEntry({ item }: { item: ChatItem }) {
  if (item.kind === "user") {
    return (
      <div className="max-w-[85%] self-end rounded-lg bg-secondary px-3 py-2 text-sm break-words whitespace-pre-wrap text-secondary-foreground">
        {item.text}
      </div>
    );
  }

  if (item.kind === "assistant") {
    return (
      <div
        aria-busy={item.streaming}
        className="flex min-w-0 flex-col items-start gap-1 break-words"
      >
        <MarkdownText text={item.text} />
        {item.streaming && <Badge variant="outline">Streaming</Badge>}
      </div>
    );
  }

  if (item.kind === "tool-call") {
    return (
      <ToolRow
        label="Tool Call"
        name={item.name}
        detail={item.input}
        status={
          item.state === "done" ? null : (
            <Badge variant="secondary">{CALL_STATE_LABEL[item.state]}</Badge>
          )
        }
      />
    );
  }

  return (
    <ToolRow
      label="Tool Result"
      name={item.name}
      detail={item.text}
      status={
        item.isError ? (
          <Badge variant="destructive">Error</Badge>
        ) : (
          <Badge variant="outline">OK</Badge>
        )
      }
    />
  );
}
