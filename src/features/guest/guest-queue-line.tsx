import { useState } from "react";

import type { WorkbenchGuestQueueItem } from "@/api/types";
import { RevealPanel } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";

function rowOf(item: WorkbenchGuestQueueItem): string {
  return `to @${item.display_name} · ${item.author_name}`;
}

export function GuestQueueLine({ queue }: { readonly queue: readonly WorkbenchGuestQueueItem[] }) {
  const [open, setOpen] = useState(false);
  const next = queue[0];
  if (next === undefined) return null;
  return (
    <div className="mb-2 min-w-0 rounded-md border">
      <Collapsible open={open} onOpenChange={setOpen} className="min-w-0">
        <CollapsibleTrigger
          render={<Button variant="ghost" size="sm" className="w-full min-w-0 justify-start" />}
        >
          <span className="shrink-0">{queue.length} queued</span>
          {!open && (
            <span className="min-w-0 grow basis-0 truncate text-left text-xs text-muted-foreground">
              Next: {rowOf(next)}
            </span>
          )}
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">
            {open ? "Hide ▴" : "Show all ▾"}
          </span>
        </CollapsibleTrigger>
        <RevealPanel>
          <ol aria-label="Queued runs" className="flex list-decimal flex-col gap-1 pr-3 pb-2 pl-8">
            {queue.map((item) => (
              <li key={item.id} className="min-w-0 text-sm break-words">
                {rowOf(item)}
              </li>
            ))}
          </ol>
        </RevealPanel>
      </Collapsible>
    </div>
  );
}
