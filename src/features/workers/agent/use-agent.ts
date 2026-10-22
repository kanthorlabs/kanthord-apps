import { readAgent } from "@/api/resources/workers";
import type { AgentDeclaration } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export interface AgentRead {
  readonly agent: AgentDeclaration;
  readonly readAt: number;
}

async function readAgentAt(agentName: string): Promise<AgentRead> {
  const agent = await readAgent(agentName);
  return { agent, readAt: Date.now() };
}

export function useAgent(agentName: string): Resource<AgentRead> {
  return useResource(() => readAgentAt(agentName), [agentName]);
}
