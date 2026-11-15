import { useId } from "react";

import { Switch } from "@/components/ui/switch";
import { useAutoMode } from "../use-auto-mode";
import { InlineError } from "./inline-error";

interface AutoModeSwitchProps {
  readonly sessionId: string;
  readonly enabled: boolean;
  readonly disabled?: boolean;
  readonly onEnabled: (enabled: boolean) => void;
}

export function AutoModeSwitch({
  sessionId,
  enabled,
  disabled = false,
  onEnabled,
}: AutoModeSwitchProps) {
  const labelId = useId();
  const errorId = useId();
  const autoMode = useAutoMode(sessionId, onEnabled);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center gap-2 text-sm">
        <span id={labelId}>Auto mode</span>
        <Switch
          checked={enabled}
          disabled={disabled || autoMode.pending}
          aria-labelledby={labelId}
          aria-describedby={autoMode.failure === null ? undefined : errorId}
          onCheckedChange={(checked) => void autoMode.toggle(checked)}
        />
      </div>
      {autoMode.failure !== null && (
        <InlineError id={errorId} code={autoMode.failure.code} message={autoMode.failure.message} />
      )}
    </div>
  );
}
