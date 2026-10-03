import { listAgents } from "@/api/resources/workers";
import type { AgentSummary } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export function useAgents(): Resource<readonly AgentSummary[]> {
  return useResource(() => listAgents(), []);
}
