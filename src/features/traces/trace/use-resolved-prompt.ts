import type { ApiError } from "@/api/errors";
import { resolveAgentPrompt } from "@/api/resources/workers";
import { useResource } from "@/hooks/use-resource";

export interface PromptSource {
  readonly executionId: string;
  readonly agentName: string;
}

export interface ResolvedPrompt {
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly final: string | null;
  readonly retry: () => void;
}

export function useResolvedPrompt(source: PromptSource): ResolvedPrompt {
  const { executionId, agentName } = source;
  const resource = useResource(
    () => resolveAgentPrompt(executionId, agentName),
    [executionId, agentName],
  );
  return {
    loading: resource.loading,
    error: resource.error,
    final: resource.data?.final ?? null,
    retry: resource.reload,
  };
}
