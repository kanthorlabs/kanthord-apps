import { useState } from "react";

import type { AgentEnablement, AgentSummary } from "@/api/types";
import { agentLabel } from "@/lib/agent-label";

export interface NewSessionChoice {
  readonly agentName: string | null;
  readonly agentOptions: readonly string[];
  readonly agentLabels: Readonly<Record<string, string>>;
  readonly agentDisplayName: string | null;
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
  const chosen = enabled.find((agent) => agent.agentName === agentName) ?? null;

  const selectAgent = (value: string | null) => {
    if (value !== null) setAgentName(value);
  };

  return {
    agentName,
    agentOptions: enabled.map((agent) => agent.agentName),
    agentLabels: Object.fromEntries(enabled.map((agent) => [agent.agentName, agentLabel(agent)])),
    agentDisplayName: chosen?.displayName ?? null,
    enablement: chosen?.enablement ?? null,
    selectAgent,
  };
}
