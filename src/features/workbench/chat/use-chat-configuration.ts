import { useCallback, useState } from "react";

import { configureWorkbenchSession } from "@/api/resources/workbench";
import { listAgentProviderModels } from "@/api/resources/workers";
import type { AgentEnablement, ReasoningEffort, WorkbenchConfiguration } from "@/api/types";
import { useAgentProviderModels } from "@/hooks/use-agent-provider-models";
import { asApiError } from "@/hooks/use-resource";
import { reasoningEffortOf } from "@/lib/enablement-draft";
import {
  effortAfterModelChange,
  effortOptions,
  modelAfterProviderChange,
  modelOptions,
} from "@/lib/workbench-configuration";

export interface ChatConfigurationState {
  readonly configuration: WorkbenchConfiguration;
  readonly agentProviders: readonly string[];
  readonly models: readonly string[];
  readonly reasoningEfforts: readonly string[];
  readonly modelsFailure: string | null;
  readonly failure: string | null;
  readonly pending: boolean;
  readonly selectAgentProvider: (value: string | null) => void;
  readonly selectModel: (value: string | null) => void;
  readonly selectReasoningEffort: (value: string | null) => void;
}

export function useChatConfiguration(
  sessionId: string,
  agentName: string,
  initial: WorkbenchConfiguration,
  enablement: AgentEnablement | null,
): ChatConfigurationState {
  const [configuration, setConfiguration] = useState(initial);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const providerModels = useAgentProviderModels(agentName, configuration.agent_provider);

  const change = useCallback(
    (patch: Promise<Partial<WorkbenchConfiguration>> | Partial<WorkbenchConfiguration>) => {
      if (pending) return;
      setFailure(null);
      setPending(true);
      Promise.resolve(patch)
        .then((resolved) => configureWorkbenchSession(sessionId, { ...configuration, ...resolved }))
        .then(
          (answer) => {
            setPending(false);
            setConfiguration(answer);
          },
          (cause: unknown) => {
            setPending(false);
            setFailure(asApiError(cause).message);
          },
        );
    },
    [pending, sessionId, configuration],
  );

  const selectAgentProvider = useCallback(
    (value: string | null) => {
      if (value === null || value === configuration.agent_provider || pending) return;
      change(
        listAgentProviderModels(agentName, value).then((models) => {
          const modelIdentifier = modelAfterProviderChange(models);
          return {
            agent_provider: value,
            model_identifier: modelIdentifier,
            reasoning_effort: effortAfterModelChange(
              configuration.reasoning_effort,
              modelIdentifier,
              models,
            ),
          };
        }),
      );
    },
    [change, pending, agentName, configuration],
  );

  const selectModel = useCallback(
    (value: string | null) => {
      if (value !== null && value !== configuration.model_identifier) {
        change({
          model_identifier: value,
          reasoning_effort: effortAfterModelChange(
            configuration.reasoning_effort,
            value,
            providerModels.models ?? [],
          ),
        });
      }
    },
    [change, configuration.model_identifier, configuration.reasoning_effort, providerModels.models],
  );

  const selectReasoningEffort = useCallback(
    (value: string | null) => {
      const effort: ReasoningEffort | "" = reasoningEffortOf(value);
      if (effort !== "" && effort !== configuration.reasoning_effort) {
        change({ reasoning_effort: effort });
      }
    },
    [change, configuration.reasoning_effort],
  );

  return {
    configuration,
    agentProviders: [
      ...new Set([
        configuration.agent_provider,
        ...(enablement?.agent_providers ?? []).map((provider) => provider.name),
      ]),
    ],
    models: modelOptions(configuration.model_identifier, providerModels.models),
    reasoningEfforts: effortOptions(
      configuration.reasoning_effort,
      configuration.model_identifier,
      providerModels.models,
    ),
    modelsFailure: providerModels.failure,
    failure,
    pending,
    selectAgentProvider,
    selectModel,
    selectReasoningEffort,
  };
}
