import { useState } from "react";

import { RecordName } from "@/components/record-name";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProviderRemovalBlock } from "@/lib/agent-provider-draft";

interface RemoveProviderButtonProps {
  readonly providerName: string;
  readonly block: ProviderRemovalBlock | null;
  readonly onRemove: () => void;
}

export function RemoveProviderButton({ providerName, block, onRemove }: RemoveProviderButtonProps) {
  const [open, setOpen] = useState(false);
  const label = `Remove ${providerName}`;

  if (block === null) {
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
      <TooltipContent>
        {block === "last-provider" ? (
          "An enablement keeps at least one agent provider. Add another agent provider first."
        ) : (
          <>
            The default configuration names <RecordName>{providerName}</RecordName>. Change the
            default configuration first.
          </>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
