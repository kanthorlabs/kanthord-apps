import { useState, type ReactNode, type Ref } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DisabledActionProps {
  readonly label: string;
  readonly reason: ReactNode;
  readonly icon?: ReactNode;
  readonly ariaLabel?: string;
  readonly ref?: Ref<HTMLButtonElement>;
}

export function DisabledAction({ label, reason, icon, ariaLabel, ref }: DisabledActionProps) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <Button
            ref={ref}
            variant="outline"
            size="sm"
            aria-label={ariaLabel}
            disabled
            focusableWhenDisabled
            className="data-disabled:opacity-50"
          />
        }
        onPointerUp={() => setOpen(true)}
      >
        {icon}
        {label}
      </TooltipTrigger>
      <TooltipContent>
        <p>{reason}</p>
      </TooltipContent>
    </Tooltip>
  );
}
