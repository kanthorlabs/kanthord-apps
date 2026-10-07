import { useCallback, useState } from "react";

import { createWorkbenchSession } from "@/api/resources/workbench";
import type { AgentEnablement, WorkbenchSession } from "@/api/types";
import {
  useConfigurationDraft,
  type ConfigurationDraftState,
} from "@/hooks/use-configuration-draft";
import { asApiError } from "@/hooks/use-resource";
import { configurationOf, type ConfigurationErrors } from "@/lib/workbench-configuration";

export interface SessionCreateState extends ConfigurationDraftState {
  readonly errors: ConfigurationErrors;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly submit: () => void;
}

const NO_ERRORS: ConfigurationErrors = {};

export function useSessionCreate(
  agentName: string,
  enablement: AgentEnablement | null,
  onCreated: (session: WorkbenchSession) => void,
): SessionCreateState {
  const configuration = useConfigurationDraft(agentName, enablement);
  const { draft, switching } = configuration;
  const [errors, setErrors] = useState<ConfigurationErrors>(NO_ERRORS);
  const [failure, setFailure] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = useCallback(() => {
    if (submitting || switching) return;
    const result = configurationOf(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors(NO_ERRORS);
    setFailure(null);
    setSubmitting(true);
    createWorkbenchSession({ agent_name: agentName, ...result.configuration }).then(
      (session) => {
        setSubmitting(false);
        onCreated(session);
      },
      (cause: unknown) => {
        setSubmitting(false);
        setFailure(asApiError(cause).message);
      },
    );
  }, [submitting, switching, draft, agentName, onCreated]);

  return {
    ...configuration,
    errors,
    failure: failure ?? configuration.switchFailure,
    submitting,
    submit,
  };
}
