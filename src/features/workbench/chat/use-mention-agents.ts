import { useMemo } from "react";

import { listAgents } from "@/api/resources/workers";
import type { AgentSummary } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { mentionAgentsOf } from "@/lib/workbench-mention";

export interface MentionAgentsState {
  readonly agents: readonly AgentSummary[];
  readonly failure: string | null;
}

export function useMentionAgents(): MentionAgentsState {
  const { data, error } = useResource(listAgents, []);
  const agents = useMemo(() => mentionAgentsOf(data ?? []), [data]);
  return { agents, failure: error?.message ?? null };
}
