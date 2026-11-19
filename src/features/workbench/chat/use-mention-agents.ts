import { useCallback, useMemo } from "react";

import { listAgents } from "@/api/resources/workers";
import type { AgentSummary } from "@/api/types";
import { useAgentVariants } from "@/hooks/use-agent-variants";
import { useResource } from "@/hooks/use-resource";
import { mentionAgentsOf, mentionOptionsOf } from "@/lib/workbench-mention";

export interface MentionAgentsState {
  readonly agents: readonly AgentSummary[];
  readonly names: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly failure: string | null;
  readonly displayNameOf: (agentName: string) => string | null;
}

export function useMentionAgents(): MentionAgentsState {
  const { data, error } = useResource(listAgents, []);
  const variants = useAgentVariants();
  const agents = useMemo(() => mentionAgentsOf(data ?? []), [data]);
  const options = useMemo(
    () => mentionOptionsOf(agents, variants.data ?? []),
    [agents, variants.data],
  );
  const names = useMemo(() => options.map((option) => option.name), [options]);
  const labels = useMemo(
    () => Object.fromEntries(options.map((option) => [option.name, option.label])),
    [options],
  );
  const displayNameOf = useCallback(
    (agentName: string) =>
      data?.find((agent) => agent.agentName === agentName)?.displayName ?? null,
    [data],
  );
  return {
    agents,
    names,
    labels,
    failure: error?.message ?? variants.error?.message ?? null,
    displayNameOf,
  };
}
