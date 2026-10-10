import { ShieldCheckIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RecordName } from "@/components/record-name";

interface VerifyButtonProps {
  readonly platform: string;
  readonly verifiable: boolean;
  readonly checking: boolean;
  readonly onVerify: () => void;
  readonly label?: string;
  readonly incomplete?: boolean;
  readonly size?: "sm" | "lg";
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
  incomplete = false,
  size = "sm",
}: VerifyButtonProps) {
  const [open, setOpen] = useState(false);

  if (verifiable) {
    return (
      <Button
        variant="outline"
        size={size}
        aria-label={label}
        aria-busy={checking}
        disabled={checking || incomplete}
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
            size={size}
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
      <TooltipContent>
        Verification is not supported yet for <RecordName>{platform}</RecordName>.
      </TooltipContent>
    </Tooltip>
  );
}
