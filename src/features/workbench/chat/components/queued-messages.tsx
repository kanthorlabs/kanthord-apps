import { useState } from "react";

import type { WorkbenchQueuedMessage } from "@/api/types";
import { RevealPanel } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { summaryOf } from "@/lib/workbench-chat";
import type { ChatActionFailure } from "../use-chat-actions";
import { InlineError } from "./inline-error";

interface QueuedMessagesProps {
  readonly queue: readonly WorkbenchQueuedMessage[];
  readonly busy: boolean;
  readonly failure: ChatActionFailure | null;
  readonly onEdit: (item: WorkbenchQueuedMessage) => void;
  readonly onRemove: (item: WorkbenchQueuedMessage) => void;
}

export function QueuedMessages({ queue, busy, failure, onEdit, onRemove }: QueuedMessagesProps) {
  const [open, setOpen] = useState(false);
  const next = queue[0];
  return (
    <>
      {next !== undefined && (
        <div className="mb-2 min-w-0 rounded-md border">
          <Collapsible open={open} onOpenChange={setOpen} className="min-w-0">
            <CollapsibleTrigger
              render={<Button variant="ghost" size="sm" className="w-full min-w-0 justify-start" />}
            >
              <span className="shrink-0">{queue.length} queued</span>
              {!open && (
                <span className="min-w-0 grow basis-0 truncate text-left text-xs text-muted-foreground">
                  Next: {summaryOf(next.text)}
                </span>
              )}
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {open ? "Hide ▴" : "Show all ▾"}
              </span>
            </CollapsibleTrigger>
            <RevealPanel>
              <ol className="flex list-decimal flex-col gap-1 pr-3 pb-2 pl-8">
                {queue.map((item) => (
                  <li key={item.id} className="min-w-0">
                    <div className="flex min-w-0 items-start gap-2">
                      <p className="min-w-0 grow text-sm break-words whitespace-pre-wrap">
                        {item.text}
                      </p>
                      <Button variant="link" size="sm" disabled={busy} onClick={() => onEdit(item)}>
                        Edit
                      </Button>
                      <Button
                        variant="link"
                        size="sm"
                        disabled={busy}
                        onClick={() => onRemove(item)}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ol>
            </RevealPanel>
          </Collapsible>
        </div>
      )}
      {failure !== null && (
        <div className="mb-2">
          <InlineError code={failure.code} message={failure.message} />
        </div>
      )}
    </>
  );
}
