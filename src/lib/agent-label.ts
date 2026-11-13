import type { AgentSummary } from "@/api/types";

export function agentLabel(agent: Pick<AgentSummary, "displayName" | "agentName">): string {
  return `${agent.displayName} (${agent.agentName})`;
}
