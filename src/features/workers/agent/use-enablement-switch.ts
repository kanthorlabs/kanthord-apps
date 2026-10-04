import { useCallback, useState } from "react";
import { toast } from "sonner";

import { disableAgentEnablement, enableAgentEnablement } from "@/api/resources/workers";
import type { AgentEnablement } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export interface EnablementSwitchState {
  readonly label: "Enable" | "Disable";
  readonly failure: string | null;
  readonly pending: boolean;
  readonly run: () => void;
}

export function useEnablementSwitch(
  enablement: AgentEnablement,
  reload: () => void,
): EnablementSwitchState {
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const enabled = enablement.state === "enabled";

  const run = useCallback(() => {
    if (pending) return;
    const change = enabled ? disableAgentEnablement : enableAgentEnablement;
    setFailure(null);
    setPending(true);
    change(enablement.agentName, enablement.revision).then(
      (answer) => {
        setPending(false);
        toast.success(`${answer.agentName} is ${answer.state} at revision ${answer.revision}.`);
        reload();
      },
      (cause: unknown) => {
        setPending(false);
        setFailure(asApiError(cause).message);
      },
    );
  }, [pending, enabled, enablement.agentName, enablement.revision, reload]);

  return { label: enabled ? "Disable" : "Enable", failure, pending, run };
}
