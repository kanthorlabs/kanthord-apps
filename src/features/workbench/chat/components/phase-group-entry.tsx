import { ChevronRightIcon } from "lucide-react";
import type { ReactNode } from "react";

import { RevealPanel } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { PHASE_LABELS } from "@/lib/workbench-chat";

interface PhaseGroupEntryProps {
  readonly phase: keyof typeof PHASE_LABELS;
  readonly children: ReactNode;
}

export function PhaseGroupEntry({ phase, children }: PhaseGroupEntryProps) {
  return (
    <div className="min-w-0">
      <Collapsible>
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="w-full min-w-0 justify-start border border-dashed text-xs text-muted-foreground"
            />
          }
        >
          <ChevronRightIcon aria-hidden="true" data-icon="inline-start" />
          {PHASE_LABELS[phase]}
        </CollapsibleTrigger>
        <RevealPanel>
          <div className="flex min-w-0 flex-col gap-3 px-3 py-2">{children}</div>
        </RevealPanel>
      </Collapsible>
    </div>
  );
}
