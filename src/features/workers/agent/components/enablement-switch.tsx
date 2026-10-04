import type { AgentEnablement } from "@/api/types";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useEnablementSwitch } from "../use-enablement-switch";

interface EnablementSwitchProps {
  readonly enablement: AgentEnablement;
  readonly reload: () => void;
}

export function EnablementSwitch({ enablement, reload }: EnablementSwitchProps) {
  const control = useEnablementSwitch(enablement, reload);

  return (
    <div className="flex flex-col gap-2">
      {control.failure !== null && (
        <Alert variant="destructive">
          <AlertTitle>The state did not change.</AlertTitle>
          <AlertDescription>{control.failure}</AlertDescription>
        </Alert>
      )}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={control.pending}
        onClick={control.run}
      >
        {control.label}
      </Button>
    </div>
  );
}
