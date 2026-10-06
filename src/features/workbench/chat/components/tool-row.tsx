import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { summaryOf } from "@/lib/workbench-chat";
import { ToolDetail } from "./tool-detail";

interface ToolRowProps {
  readonly label: string;
  readonly name: string;
  readonly status: ReactNode;
  readonly detail: string;
}

export function ToolRow({ label, name, status, detail }: ToolRowProps) {
  return (
    <Collapsible className="min-w-0 rounded-md border">
      <CollapsibleTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            aria-label={`${label} ${name}`}
            className="w-full min-w-0 justify-start"
          />
        }
      >
        <ChevronRightIcon aria-hidden="true" data-icon="inline-start" />
        <span className="shrink-0 text-muted-foreground">{label}</span>
        <span className="shrink-0 font-mono">{name}</span>
        {status}
        <span className="min-w-0 truncate font-mono text-xs text-muted-foreground">
          {summaryOf(detail)}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ToolDetail detail={detail} />
      </CollapsibleContent>
    </Collapsible>
  );
}
