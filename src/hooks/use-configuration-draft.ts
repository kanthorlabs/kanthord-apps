import { useCallback, useState } from "react";

import { listAgentProviderModels } from "@/api/resources/workers";
import type { AgentEnablement } from "@/api/types";
import { useAgentProviderModels } from "@/hooks/use-agent-provider-models";
import { asApiError } from "@/hooks/use-resource";
import { reasoningEffortOf } from "@/lib/enablement-draft";
import {
  draftOf,
  effortAfterModelChange,
  effortOptions,
  modelAfterProviderChange,
  modelOptions,
  type ConfigurationDraft,
} from "@/lib/workbench-configuration";

export interface ConfigurationDraftState {
  readonly draft: ConfigurationDraft;
  readonly models: readonly string[];
  readonly reasoningEfforts: readonly string[];
  readonly modelsFailure: string | null;
  readonly switchFailure: string | null;
  readonly switching: boolean;
  readonly selectAgentProvider: (value: string | null) => void;
  readonly selectModel: (value: string | null) => void;
  readonly selectReasoningEffort: (value: string | null) => void;
}

export function useConfigurationDraft(
  agentName: string,
  enablement: AgentEnablement | null,
): ConfigurationDraftState {
  const [draft, setDraft] = useState<ConfigurationDraft>(() => draftOf(enablement));
  const [switching, setSwitching] = useState(false);
  const [switchFailure, setSwitchFailure] = useState<string | null>(null);
  const providerModels = useAgentProviderModels(agentName, draft.agentProvider);

  const selectAgentProvider = useCallback(
    (value: string | null) => {
      if (value === null || value === draft.agentProvider || switching) return;
      setSwitchFailure(null);
      setSwitching(true);
      listAgentProviderModels(agentName, value).then(
        (models) => {
          setSwitching(false);
          setDraft((current) => {
            const modelIdentifier = modelAfterProviderChange(models);
            return {
              agentProvider: value,
              modelIdentifier,
              reasoningEffort: effortAfterModelChange(
                current.reasoningEffort,
                modelIdentifier,
                models,
              ),
            };
          });
        },
        (cause: unknown) => {
          setSwitching(false);
          setSwitchFailure(asApiError(cause).message);
        },
      );
    },
    [agentName, draft.agentProvider, switching],
  );

  const selectModel = useCallback(
    (value: string | null) => {
      if (value === null) return;
      setDraft((current) => ({
        ...current,
        modelIdentifier: value,
        reasoningEffort: effortAfterModelChange(
          current.reasoningEffort,
          value,
          providerModels.models ?? [],
        ),
      }));
    },
    [providerModels.models],
  );

  const selectReasoningEffort = useCallback((value: string | null) => {
    if (value === null) return;
    setDraft((current) => ({ ...current, reasoningEffort: reasoningEffortOf(value) }));
  }, []);

  return {
    draft,
    models: modelOptions(draft.modelIdentifier, providerModels.models),
    reasoningEfforts: effortOptions(
      draft.reasoningEffort,
      draft.modelIdentifier,
      providerModels.models,
    ),
    modelsFailure: providerModels.failure,
    switchFailure,
    switching,
    selectAgentProvider,
    selectModel,
    selectReasoningEffort,
  };
}
