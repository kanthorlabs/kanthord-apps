import { Fragment, type ReactNode } from "react";

import { runErrorTargetId, runLineIndexOf } from "@/lib/workbench-chat";
import type { ChatItem } from "@/lib/workbench-chat";
import { type ChatAuthors, ChatEntry } from "./chat-entry";
import { InlineError } from "./inline-error";

interface ChatTranscriptProps {
  readonly items: readonly ChatItem[];
  readonly authors: ChatAuthors;
  readonly runError: string | null;
  readonly runLine: ReactNode;
}

export function ChatTranscript({ items, authors, runError, runLine }: ChatTranscriptProps) {
  const targetId = runError === null ? null : runErrorTargetId(items);
  const runLineIndex = runLineIndexOf(items);
  return (
    <div role="log" aria-label="Transcript" className="flex min-w-0 flex-col gap-3">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">No messages. Write the first one below.</p>
      )}
      {items.map((item, index) => (
        <Fragment key={item.id}>
          <ChatEntry
            item={item}
            authors={authors}
            runError={item.id === targetId ? runError : null}
          />
          {index === runLineIndex && runLine}
        </Fragment>
      ))}
      {runLineIndex === items.length && runLine}
      {runError !== null && targetId === null && <InlineError code={null} message={runError} />}
    </div>
  );
}
