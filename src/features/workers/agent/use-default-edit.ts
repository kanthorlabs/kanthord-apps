import { useCallback, useState } from "react";
import { toast } from "sonner";

import { putAgentEnablement } from "@/api/resources/workers";
import type { AgentEnablement } from "@/api/types";
import {
  useConfigurationDraft,
  type ConfigurationDraftState,
} from "@/hooks/use-configuration-draft";
import { asApiError } from "@/hooks/use-resource";
import { configurationOf, type ConfigurationErrors } from "@/lib/workbench-configuration";

export interface DefaultEditState extends ConfigurationDraftState {
  readonly errors: ConfigurationErrors;
  readonly failure: string | null;
  readonly submitting: boolean;
  readonly submit: () => void;
}

const NO_ERRORS: ConfigurationErrors = {};

export function useDefaultEdit(
  agentName: string,
  enablement: AgentEnablement,
  onSaved: () => void,
): DefaultEditState {
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
    putAgentEnablement(agentName, {
      expectedRevision: enablement.revision,
      agentProviders: enablement.agentProviders,
      defaultConfiguration: result.configuration,
    }).then(
      (answer) => {
        setSubmitting(false);
        toast.success(`Saved the default of ${answer.agentName} at revision ${answer.revision}.`);
        onSaved();
      },
      (cause: unknown) => {
        setSubmitting(false);
        setFailure(asApiError(cause).message);
      },
    );
  }, [submitting, switching, draft, agentName, enablement, onSaved]);

  return {
    ...configuration,
    errors,
    failure: failure ?? configuration.switchFailure,
    submitting,
    submit,
  };
}
