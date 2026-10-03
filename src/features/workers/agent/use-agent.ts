import { readAgent } from "@/api/resources/workers";
import type { AgentDeclaration } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export function useAgent(agentName: string): Resource<AgentDeclaration> {
  return useResource(() => readAgent(agentName), [agentName]);
}
