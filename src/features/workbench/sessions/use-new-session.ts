import { useState } from "react";

import type { AgentEnablement, AgentSummary } from "@/api/types";
import { useAgentVariants } from "@/features/workers/agents/use-agent-variants";
import { agentLabel } from "@/lib/agent-label";
import { variantLabel } from "@/lib/agent-variant";

export interface NewSessionChoice {
  readonly value: string | null;
  readonly agentName: string | null;
  readonly variantId: string | null;
  readonly agentOptions: readonly string[];
  readonly agentLabels: Readonly<Record<string, string>>;
  readonly agentDisplayName: string | null;
  readonly enablement: AgentEnablement | null;
  readonly variantsFailure: string | null;
  readonly selectAgent: (value: string | null) => void;
}

export function useNewSession(
  agents: readonly AgentSummary[],
  initialAgentName: string | null,
): NewSessionChoice {
  const [value, setValue] = useState<string | null>(initialAgentName);
  const variants = useAgentVariants();
  const enabled = agents.filter(
    (agent) => agent.enablement?.state === "enabled" && agent.consumers.includes("workbench"),
  );
  const offered = enabled.flatMap((agent) =>
    (variants.data ?? [])
      .filter((variant) => variant.agent_name === agent.agentName)
      .map((variant) => ({ variant, base: agent })),
  );
  const chosenVariant = offered.find(({ variant }) => variant.id === value) ?? null;
  const chosen = chosenVariant?.base ?? enabled.find((agent) => agent.agentName === value) ?? null;

  const selectAgent = (next: string | null) => {
    if (next !== null) setValue(next);
  };

  return {
    value,
    agentName: chosen?.agentName ?? null,
    variantId: chosenVariant?.variant.id ?? null,
    agentOptions: enabled.flatMap((agent) => [
      agent.agentName,
      ...offered.filter(({ base }) => base === agent).map(({ variant }) => variant.id),
    ]),
    agentLabels: {
      ...Object.fromEntries(enabled.map((agent) => [agent.agentName, agentLabel(agent)])),
      ...Object.fromEntries(
        offered.map(({ variant, base }) => [variant.id, variantLabel(variant, base)]),
      ),
    },
    agentDisplayName: chosen?.displayName ?? null,
    enablement: chosen?.enablement ?? null,
    variantsFailure: variants.error?.message ?? null,
    selectAgent,
  };
}
