import type { ReactNode } from "react";

import { Collapsible, CollapsibleContent } from "./ui/collapsible";

interface RevealProps {
  readonly open: boolean;
  readonly children: ReactNode;
}

export function Reveal({ open, children }: RevealProps) {
  return (
    <Collapsible open={open}>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height,opacity] duration-200 ease-out data-ending-style:h-0 data-ending-style:opacity-0 data-starting-style:h-0 data-starting-style:opacity-0 motion-reduce:transition-none">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
