import { useCallback, useMemo } from "react";

import { listAgents } from "@/api/resources/workers";
import type { AgentSummary } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { mentionAgentsOf } from "@/lib/workbench-mention";

export interface MentionAgentsState {
  readonly agents: readonly AgentSummary[];
  readonly failure: string | null;
  readonly displayNameOf: (agentName: string) => string | null;
}

export function useMentionAgents(): MentionAgentsState {
  const { data, error } = useResource(listAgents, []);
  const agents = useMemo(() => mentionAgentsOf(data ?? []), [data]);
  const displayNameOf = useCallback(
    (agentName: string) =>
      data?.find((agent) => agent.agentName === agentName)?.displayName ?? null,
    [data],
  );
  return { agents, failure: error?.message ?? null, displayNameOf };
}
