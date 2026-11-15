import { useCallback, useState } from "react";
import { toast } from "sonner";

import { putAgentEnablement } from "@/api/resources/workers";
import type { AgentEnablement } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export interface PinnedCredentialEditState {
  readonly agentProvider: string;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly selectAgentProvider: (value: string | null) => void;
  readonly submit: () => void;
}

export function usePinnedCredentialEdit(
  agentName: string,
  enablement: AgentEnablement,
  pinnedModelIdentifier: string,
  onSaved: () => void,
): PinnedCredentialEditState {
  const [agentProvider, setAgentProvider] = useState(
    enablement.default_configuration.agent_provider,
  );
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectAgentProvider = useCallback(
    (value: string | null) => setAgentProvider(value ?? ""),
    [],
  );

  const submit = useCallback(() => {
    if (submitting || agentProvider === "") return;
    setFailure(null);
    setSubmitting(true);
    putAgentEnablement(agentName, {
      expected_revision: enablement.revision,
      agent_providers: enablement.agent_providers,
      default_configuration: {
        agent_provider: agentProvider,
        model_identifier: pinnedModelIdentifier,
        reasoning_effort: "off",
      },
      fallback_configurations: enablement.fallback_configurations,
    }).then(
      (answer) => {
        setSubmitting(false);
        toast.success(
          `Saved the credential of ${answer.agent_name} at revision ${answer.revision}.`,
        );
        onSaved();
      },
      (cause: unknown) => {
        setSubmitting(false);
        setFailure(asApiError(cause).message);
      },
    );
  }, [submitting, agentProvider, agentName, enablement, pinnedModelIdentifier, onSaved]);

  return { agentProvider, failure, submitting, selectAgentProvider, submit };
}
