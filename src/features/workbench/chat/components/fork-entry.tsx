import { ChevronRightIcon } from "lucide-react";

import { RevealPanel } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ChatItem } from "@/lib/workbench-chat";
import { workbenchSessionPath } from "@/lib/workbench-sessions";
import { AgentText } from "./agent-text";
import { openWorkbenchUrl, workbenchUrl } from "./workbench-url";

const GUARD_LINE = "Guard checked it for orders and secrets, not for accuracy.";

type ForkItem = Extract<ChatItem, { kind: "fork" }>;

export function ForkEntry({ item }: { readonly item: ForkItem }) {
  const url = workbenchUrl(workbenchSessionPath(item.source_id));
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="min-w-0 text-sm break-words text-muted-foreground">
        Forked from{" "}
        <a
          href={url}
          className="underline"
          onClick={(event) => {
            event.preventDefault();
            openWorkbenchUrl(url);
          }}
        >
          {item.source_title}
        </a>
      </p>
      <div className="min-w-0 rounded-md border">
        <Collapsible>
          <CollapsibleTrigger
            render={<Button variant="ghost" size="sm" className="w-full min-w-0 justify-start" />}
          >
            <ChevronRightIcon aria-hidden="true" data-icon="inline-start" />
            <span className="min-w-0 truncate">Summary of {item.source_title}</span>
          </CollapsibleTrigger>
          <RevealPanel>
            <div className="flex min-w-0 flex-col gap-2 px-3 pb-2 break-words">
              <AgentText text={item.summary} />
              <p className="text-xs text-muted-foreground">{GUARD_LINE}</p>
            </div>
          </RevealPanel>
        </Collapsible>
      </div>
    </div>
  );
}
