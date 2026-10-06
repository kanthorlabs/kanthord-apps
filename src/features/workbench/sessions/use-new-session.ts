import { useState } from "react";

import type { AgentEnablement, AgentSummary } from "@/api/types";

export interface NewSessionChoice {
  readonly agentName: string | null;
  readonly agentOptions: readonly string[];
  readonly enablement: AgentEnablement | null;
  readonly selectAgent: (value: string | null) => void;
}

export function useNewSession(
  agents: readonly AgentSummary[],
  initialAgentName: string | null,
): NewSessionChoice {
  const [agentName, setAgentName] = useState<string | null>(initialAgentName);
  const enabled = agents.filter((agent) => agent.enablement?.state === "enabled");
  const enablement = enabled.find((agent) => agent.agentName === agentName)?.enablement ?? null;

  const selectAgent = (value: string | null) => {
    if (value !== null) setAgentName(value);
  };

  return {
    agentName,
    agentOptions: enabled.map((agent) => agent.agentName),
    enablement,
    selectAgent,
  };
}
