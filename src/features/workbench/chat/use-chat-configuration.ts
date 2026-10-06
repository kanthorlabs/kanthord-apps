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
  const providerModels = useAgentProviderModels(agentName, configuration.agentProvider);

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
      if (value === null || value === configuration.agentProvider || pending) return;
      change(
        listAgentProviderModels(agentName, value).then((models) => {
          const modelIdentifier = modelAfterProviderChange(configuration.modelIdentifier, models);
          return {
            agentProvider: value,
            modelIdentifier,
            reasoningEffort: effortAfterModelChange(
              configuration.reasoningEffort,
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
      if (value !== null && value !== configuration.modelIdentifier) {
        change({
          modelIdentifier: value,
          reasoningEffort: effortAfterModelChange(
            configuration.reasoningEffort,
            value,
            providerModels.models ?? [],
          ),
        });
      }
    },
    [change, configuration.modelIdentifier, configuration.reasoningEffort, providerModels.models],
  );

  const selectReasoningEffort = useCallback(
    (value: string | null) => {
      const effort: ReasoningEffort | "" = reasoningEffortOf(value);
      if (effort !== "" && effort !== configuration.reasoningEffort) {
        change({ reasoningEffort: effort });
      }
    },
    [change, configuration.reasoningEffort],
  );

  return {
    configuration,
    agentProviders: [
      ...new Set([
        configuration.agentProvider,
        ...(enablement?.agentProviders ?? []).map((provider) => provider.name),
      ]),
    ],
    models: modelOptions(configuration.modelIdentifier, providerModels.models),
    reasoningEfforts: effortOptions(
      configuration.reasoningEffort,
      configuration.modelIdentifier,
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
