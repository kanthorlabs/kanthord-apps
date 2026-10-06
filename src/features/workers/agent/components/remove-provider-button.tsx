import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface RemoveProviderButtonProps {
  readonly providerName: string;
  readonly blockedReason: string | null;
  readonly onRemove: () => void;
}

export function RemoveProviderButton({
  providerName,
  blockedReason,
  onRemove,
}: RemoveProviderButtonProps) {
  const [open, setOpen] = useState(false);
  const label = `Remove ${providerName}`;

  if (blockedReason === null) {
    return (
      <Button variant="outline" size="sm" aria-label={label} onClick={onRemove}>
        Remove
      </Button>
    );
  }

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label={label}
            disabled
            focusableWhenDisabled
            className="data-disabled:opacity-50"
          />
        }
        onPointerUp={() => setOpen(true)}
      >
        Remove
      </TooltipTrigger>
      <TooltipContent>{blockedReason}</TooltipContent>
    </Tooltip>
  );
}
