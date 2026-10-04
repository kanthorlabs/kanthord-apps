import { ShieldCheckIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface VerifyButtonProps {
  readonly platform: string;
  readonly verifiable: boolean;
  readonly checking: boolean;
  readonly onVerify: () => void;
  readonly label?: string;
}

function VerifyLabel() {
  return (
    <>
      <ShieldCheckIcon aria-hidden="true" data-icon="inline-start" />
      Verify
    </>
  );
}

export function VerifyButton({
  platform,
  verifiable,
  checking,
  onVerify,
  label,
}: VerifyButtonProps) {
  const [open, setOpen] = useState(false);

  if (verifiable) {
    return (
      <Button
        variant="outline"
        size="sm"
        aria-label={label}
        aria-busy={checking}
        disabled={checking}
        onClick={onVerify}
      >
        <VerifyLabel />
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
        <VerifyLabel />
      </TooltipTrigger>
      <TooltipContent>Verification is not supported yet for {platform}.</TooltipContent>
    </Tooltip>
  );
}
