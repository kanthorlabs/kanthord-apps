import { useId } from "react";

import { Badge } from "@/components/ui/badge";
import { toolResultText } from "@/lib/health-names";
import type { ChatItem } from "@/lib/workbench-chat";
import { AgentText } from "./agent-text";
import { InlineError } from "./inline-error";
import { ToolRow } from "./tool-row";

const CALL_STATE_LABEL = { running: "Running", "awaiting-approval": "Awaiting Approval" } as const;

function UserMessage({ text, error }: { text: string; error: string | null }) {
  const errorId = useId();
  return (
    <div className="flex max-w-[85%] min-w-0 flex-col items-end gap-1 self-end">
      <div
        aria-describedby={error === null ? undefined : errorId}
        className={
          error === null
            ? "rounded-lg border border-transparent bg-secondary px-3 py-2 text-sm break-words whitespace-pre-wrap text-secondary-foreground"
            : "rounded-lg border border-destructive bg-secondary px-3 py-2 text-sm break-words whitespace-pre-wrap text-secondary-foreground"
        }
      >
        {text}
      </div>
      {error !== null && <InlineError id={errorId} code={null} message={error} />}
    </div>
  );
}

interface ChatEntryProps {
  readonly item: ChatItem;
  readonly runError: string | null;
}

export function ChatEntry({ item, runError }: ChatEntryProps) {
  if (item.kind === "user") return <UserMessage text={item.text} error={runError} />;

  if (item.kind === "assistant") {
    return (
      <div
        aria-busy={item.streaming}
        className="flex min-w-0 flex-col items-start gap-1 break-words"
      >
        <AgentText text={item.text} />
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

  const detail = toolResultText(item.name, item.text);
  return (
    <ToolRow
      label="Tool Result"
      name={item.name}
      detail={detail}
      error={item.isError ? detail : undefined}
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
