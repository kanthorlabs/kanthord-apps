import { InfoIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface LabelHintProps {
  readonly label: string;
  readonly hint: string;
}

export function LabelHint({ label, hint }: LabelHintProps) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <Button variant="ghost" size="icon-xs" type="button" aria-label={`About ${label}`} />
        }
        closeOnClick={false}
        onPointerUp={() => setOpen(true)}
      >
        <InfoIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}
