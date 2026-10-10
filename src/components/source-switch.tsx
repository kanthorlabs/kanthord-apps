import { useId, useState, type ReactNode } from "react";

import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface SourceSwitchProps {
  readonly title: string;
  readonly checked: boolean;
  readonly disabled: boolean;
  readonly lockedReason: ReactNode;
  readonly onChange: (checked: boolean) => void;
}

export function SourceSwitch({
  title,
  checked,
  disabled,
  lockedReason,
  onChange,
}: SourceSwitchProps) {
  const reasonId = useId();
  const [open, setOpen] = useState(false);
  const control = (
    <Switch
      aria-label={`${title} switch`}
      aria-describedby={lockedReason === null ? undefined : reasonId}
      checked={checked}
      disabled={disabled || lockedReason !== null}
      onCheckedChange={onChange}
    />
  );
  if (lockedReason === null) return control;
  return (
    <>
      <span id={reasonId} className="sr-only">
        {lockedReason}
      </span>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger render={<span className="inline-flex" />} onPointerUp={() => setOpen(true)}>
          {control}
        </TooltipTrigger>
        <TooltipContent>{lockedReason}</TooltipContent>
      </Tooltip>
    </>
  );
}
