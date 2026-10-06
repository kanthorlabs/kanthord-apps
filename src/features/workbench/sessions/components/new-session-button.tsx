import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NewSessionButtonProps {
  readonly unavailableReason: string | null;
  readonly size?: "sm";
  readonly label?: string;
  readonly onStart: () => void;
}

export function NewSessionButton({
  unavailableReason,
  size,
  label,
  onStart,
}: NewSessionButtonProps) {
  const [open, setOpen] = useState(false);

  if (unavailableReason === null) {
    return (
      <Button size={size} aria-label={label} onClick={onStart}>
        <PlusIcon aria-hidden="true" data-icon="inline-start" />
        New Session
      </Button>
    );
  }

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <Button
            size={size}
            aria-label={label}
            disabled
            focusableWhenDisabled
            className="data-disabled:opacity-50"
          />
        }
        onPointerUp={() => setOpen(true)}
      >
        <PlusIcon aria-hidden="true" data-icon="inline-start" />
        New Session
      </TooltipTrigger>
      <TooltipContent>{unavailableReason}</TooltipContent>
    </Tooltip>
  );
}
