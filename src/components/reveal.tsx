import type { ReactNode } from "react";

import { Collapsible, CollapsibleContent } from "./ui/collapsible";

interface RevealPanelProps {
  readonly children: ReactNode;
}

export function RevealPanel({ children }: RevealPanelProps) {
  return (
    <CollapsibleContent className="-m-1 h-(--collapsible-panel-height) overflow-hidden p-1 transition-[height,opacity] duration-200 ease-out data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none">
      {children}
    </CollapsibleContent>
  );
}

interface RevealProps {
  readonly open: boolean;
  readonly children: ReactNode;
}

export function Reveal({ open, children }: RevealProps) {
  return (
    <Collapsible open={open}>
      <RevealPanel>{children}</RevealPanel>
    </Collapsible>
  );
}
