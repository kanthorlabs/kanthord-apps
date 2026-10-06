import { useCallback, useState } from "react";

import { configureWorkbenchSession } from "@/api/resources/workbench";
import type { AgentEnablement, ReasoningEffort, WorkbenchConfiguration } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { reasoningEffortOf } from "@/lib/enablement-draft";
import { modelChoices } from "@/lib/workbench-configuration";

export interface ChatConfigurationState {
  readonly configuration: WorkbenchConfiguration;
  readonly agentProviders: readonly string[];
  readonly models: readonly string[];
  readonly failure: string | null;
  readonly pending: boolean;
  readonly selectAgentProvider: (value: string | null) => void;
  readonly selectModel: (value: string | null) => void;
  readonly selectReasoningEffort: (value: string | null) => void;
}

export function useChatConfiguration(
  sessionId: string,
  initial: WorkbenchConfiguration,
  enablement: AgentEnablement | null,
): ChatConfigurationState {
  const [configuration, setConfiguration] = useState(initial);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const change = useCallback(
    (patch: Partial<WorkbenchConfiguration>) => {
      if (pending) return;
      setFailure(null);
      setPending(true);
      configureWorkbenchSession(sessionId, { ...configuration, ...patch }).then(
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
      if (value !== null && value !== configuration.agentProvider) {
        change({ agentProvider: value });
      }
    },
    [change, configuration.agentProvider],
  );

  const selectModel = useCallback(
    (value: string | null) => {
      if (value !== null && value !== configuration.modelIdentifier) {
        change({ modelIdentifier: value });
      }
    },
    [change, configuration.modelIdentifier],
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
    models: modelChoices(configuration.modelIdentifier, enablement),
    failure,
    pending,
    selectAgentProvider,
    selectModel,
    selectReasoningEffort,
  };
}
