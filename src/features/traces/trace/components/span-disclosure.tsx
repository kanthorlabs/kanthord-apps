import { ChevronDownIcon } from "lucide-react";
import type { ReactNode } from "react";

import { RevealPanel } from "@/components/reveal";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";

interface SpanDisclosureProps {
  readonly title: string;
  readonly children: ReactNode;
}

export function SpanDisclosure({ title, children }: SpanDisclosureProps) {
  return (
    <Collapsible className="flex min-w-0 flex-col gap-2">
      <TouchTarget>
        <CollapsibleTrigger render={<Button variant="outline" size="sm" className="self-start" />}>
          <ChevronDownIcon aria-hidden="true" data-icon="inline-start" />
          {title}
        </CollapsibleTrigger>
      </TouchTarget>
      <RevealPanel>
        <div role="region" aria-label={title} className="flex min-w-0 flex-col gap-2">
          {children}
        </div>
      </RevealPanel>
    </Collapsible>
  );
}
