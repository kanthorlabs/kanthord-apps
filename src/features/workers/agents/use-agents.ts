import { listAgents } from "@/api/resources/workers";
import type { AgentSummary } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

export function useAgents(): Resource<readonly AgentSummary[]> {
  return useResource(() => listAgents(), []);
}
