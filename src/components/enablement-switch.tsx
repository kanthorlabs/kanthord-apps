import type { AgentEnablementState } from "@/api/types";
import { EnablementDisableDialog } from "@/components/enablement-disable-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useEnablementSwitch } from "@/hooks/use-enablement-switch";

interface EnablementSwitchProps {
  readonly agentName: string;
  readonly state: AgentEnablementState;
  readonly reload: () => void;
}

export function EnablementSwitch({ agentName, state, reload }: EnablementSwitchProps) {
  const control = useEnablementSwitch({ agentName, state }, reload);

  return (
    <div className="flex flex-col gap-2">
      {control.failure !== null && (
        <Alert variant="destructive">
          <AlertTitle>The state did not change.</AlertTitle>
          <AlertDescription>{control.failure}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        aria-label={`${control.label} ${agentName}`}
        aria-busy={control.pending}
        disabled={control.pending}
        onClick={control.run}
      >
        {control.label}
      </Button>
      <EnablementDisableDialog agentName={agentName} control={control} />
    </div>
  );
}
