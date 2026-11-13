import { useCallback, useState } from "react";

import type { AgentEnablement, WorkbenchConfiguration } from "@/api/types";
import {
  type ConfigurationDraftState,
  useConfigurationDraft,
} from "@/hooks/use-configuration-draft";
import {
  type ConfigurationErrors,
  configurationOf,
  effortAfterModelChange,
} from "@/lib/workbench-configuration";

export interface SessionStartState extends ConfigurationDraftState {
  readonly errors: ConfigurationErrors;
  readonly submit: () => void;
}

const NO_ERRORS: ConfigurationErrors = {};

export function useSessionStart(
  agentName: string,
  enablement: AgentEnablement | null,
  onStart: (configuration: WorkbenchConfiguration) => void,
): SessionStartState {
  const configuration = useConfigurationDraft(agentName, enablement, effortAfterModelChange);
  const { draft, switching } = configuration;
  const [errors, setErrors] = useState<ConfigurationErrors>(NO_ERRORS);

  const submit = useCallback(() => {
    if (switching) return;
    const result = configurationOf(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors(NO_ERRORS);
    onStart(result.configuration);
  }, [switching, draft, onStart]);

  return { ...configuration, errors, submit };
}
