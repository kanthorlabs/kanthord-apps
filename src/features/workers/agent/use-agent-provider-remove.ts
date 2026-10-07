import { useCallback, useState } from "react";
import { toast } from "sonner";

import { removeAgentProvider } from "@/api/resources/workers";
import type { AgentEnablement } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export interface AgentProviderRemoveState {
  readonly providerName: string | null;
  readonly consequence: string;
  readonly saferPath: string;
  readonly error: string | null;
  readonly removing: boolean;
  readonly request: (providerName: string) => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

export function useAgentProviderRemove(
  agentName: string,
  enablement: AgentEnablement,
  reload: () => void,
): AgentProviderRemoveState {
  const [providerName, setProviderName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  const request = useCallback((name: string) => {
    setError(null);
    setProviderName(name);
  }, []);

  const cancel = useCallback(() => {
    if (removing) return;
    setProviderName(null);
    setError(null);
  }, [removing]);

  const confirm = useCallback(() => {
    if (removing || providerName === null) return;
    setRemoving(true);
    setError(null);
    removeAgentProvider(agentName, providerName, enablement.revision).then(
      (answer) => {
        setRemoving(false);
        setProviderName(null);
        toast.success(
          `Removed ${providerName} from ${answer.agent_name} at revision ${answer.revision}.`,
        );
        reload();
      },
      (cause: unknown) => {
        setRemoving(false);
        setError(asApiError(cause).message);
      },
    );
  }, [removing, providerName, agentName, enablement.revision, reload]);

  return {
    providerName,
    consequence: `A workbench session that names ${providerName ?? ""} cannot run again until a human changes its configuration. The engine refuses the removal while a worker binding names ${providerName ?? ""}.`,
    saferPath: `Keep ${providerName ?? ""}. Add another agent provider instead when only the credential is wrong.`,
    error,
    removing,
    request,
    cancel,
    confirm,
  };
}
