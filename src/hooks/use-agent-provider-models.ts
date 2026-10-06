import { listAgentProviderModels } from "@/api/resources/workers";
import type { AgentModel } from "@/api/types";
import { asApiError, useResource } from "@/hooks/use-resource";

export interface AgentProviderModels {
  readonly models: readonly AgentModel[] | null;
  readonly failure: string | null;
}

interface Listed extends AgentProviderModels {
  readonly agentName: string;
  readonly providerName: string;
}

export function useAgentProviderModels(
  agentName: string,
  providerName: string,
): AgentProviderModels {
  const { data } = useResource<Listed>(
    () =>
      listAgentProviderModels(agentName, providerName).then(
        (models) => ({ agentName, providerName, models, failure: null }),
        (cause: unknown) => ({
          agentName,
          providerName,
          models: null,
          failure: asApiError(cause).message,
        }),
      ),
    [agentName, providerName],
  );
  const current = data?.agentName === agentName && data.providerName === providerName ? data : null;
  return { models: current?.models ?? null, failure: current?.failure ?? null };
}
