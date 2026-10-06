import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NewSessionButtonProps {
  readonly available: boolean;
  readonly onStart: () => void;
}

export function NewSessionButton({ available, onStart }: NewSessionButtonProps) {
  const [open, setOpen] = useState(false);

  if (available) {
    return (
      <Button onClick={onStart}>
        <PlusIcon aria-hidden="true" data-icon="inline-start" />
        New Session
      </Button>
    );
  }

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={<Button disabled focusableWhenDisabled className="data-disabled:opacity-50" />}
        onPointerUp={() => setOpen(true)}
      >
        <PlusIcon aria-hidden="true" data-icon="inline-start" />
        New Session
      </TooltipTrigger>
      <TooltipContent>Enable the agent before a session can start.</TooltipContent>
    </Tooltip>
  );
}
