import { type ReactNode, type Ref, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface DisabledActionProps {
  readonly label: string;
  readonly reason: ReactNode;
  readonly icon?: ReactNode;
  readonly ariaLabel?: string;
  readonly keyShortcuts?: string;
  readonly hint?: ReactNode;
  readonly describedBy?: string;
  readonly ref?: Ref<HTMLButtonElement>;
}

export function DisabledAction({
  label,
  reason,
  icon,
  ariaLabel,
  keyShortcuts,
  hint,
  describedBy,
  ref,
}: DisabledActionProps) {
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
            aria-keyshortcuts={keyShortcuts}
            aria-describedby={describedBy}
            disabled
            focusableWhenDisabled
            className="data-disabled:opacity-50"
          />
        }
        onPointerUp={() => setOpen(true)}
      >
        {icon}
        {label}
        {hint}
      </TooltipTrigger>
      <TooltipContent>
        <p>{reason}</p>
      </TooltipContent>
    </Tooltip>
  );
}
