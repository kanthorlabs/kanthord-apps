import type { ReactNode } from "react";

import { runErrorTargetId } from "@/lib/workbench-chat";
import type { ActionCardItem, ChatItem } from "@/lib/workbench-chat";
import { type ChatAuthors, ChatEntry } from "./chat-entry";
import { InlineError } from "./inline-error";

interface ChatTranscriptProps {
  readonly items: readonly ChatItem[];
  readonly authors: ChatAuthors;
  readonly runError: string | null;
  readonly runLine: ReactNode;
  readonly actionLineOf?: (item: ActionCardItem) => ReactNode | null;
  readonly sessionId: string;
  readonly canRun?: boolean;
}

export function ChatTranscript({
  items,
  authors,
  runError,
  runLine,
  actionLineOf,
  sessionId,
  canRun,
}: ChatTranscriptProps) {
  const targetId = runError === null ? null : runErrorTargetId(items);
  return (
    <div role="log" aria-label="Transcript" className="flex min-w-0 flex-col gap-3">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No messages. Write the first one below.</p>
      )}
      {items.map((item) => (
        <ChatEntry
          key={item.id}
          item={item}
          authors={authors}
          runError={item.id === targetId ? runError : null}
          actionLineOf={actionLineOf}
          sessionId={sessionId}
          canRun={canRun}
        />
      ))}
      {runLine}
      {runError !== null && targetId === null && <InlineError code={null} message={runError} />}
    </div>
  );
}
