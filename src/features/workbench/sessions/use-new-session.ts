import { useState } from "react";

import type { AgentEnablement, AgentSummary } from "@/api/types";
import { agentLabel } from "@/lib/agent-label";

export interface NewSessionChoice {
  readonly agentName: string | null;
  readonly agentOptions: readonly string[];
  readonly agentLabels: Readonly<Record<string, string>>;
  readonly enablement: AgentEnablement | null;
  readonly selectAgent: (value: string | null) => void;
}

export function useNewSession(
  agents: readonly AgentSummary[],
  initialAgentName: string | null,
): NewSessionChoice {
  const [agentName, setAgentName] = useState<string | null>(initialAgentName);
  const enabled = agents.filter(
    (agent) => agent.enablement?.state === "enabled" && agent.consumers.includes("workbench"),
  );
  const enablement = enabled.find((agent) => agent.agentName === agentName)?.enablement ?? null;

  const selectAgent = (value: string | null) => {
    if (value !== null) setAgentName(value);
  };

  return {
    agentName,
    agentOptions: enabled.map((agent) => agent.agentName),
    agentLabels: Object.fromEntries(enabled.map((agent) => [agent.agentName, agentLabel(agent)])),
    enablement,
    selectAgent,
  };
}
