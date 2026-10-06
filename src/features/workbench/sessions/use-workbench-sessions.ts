import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { listWorkbenchSessions } from "@/api/resources/workbench";
import type { ApiError } from "@/api/errors";
import type { AgentEnablement, WorkbenchSessionListItem } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { useAgents } from "@/features/workers/agents/use-agents";
import { sessionsNewestFirst } from "@/lib/workbench-sessions";

export const ALL_AGENTS = "all";
const AGENT_PARAM = "agentName";

export interface WorkbenchSessionsState {
  readonly status: "loading" | "ready" | "error";
  readonly error: ApiError | null;
  readonly reload: () => void;
  readonly sessions: readonly WorkbenchSessionListItem[];
  readonly agentName: string | null;
  readonly agentOptions: readonly string[];
  readonly selectAgent: (value: string | null) => void;
  readonly enablement: AgentEnablement | null;
}

export function useWorkbenchSessions(): WorkbenchSessionsState {
  const [params, setParams] = useSearchParams();
  const agentName = params.get(AGENT_PARAM);
  const list = useResource(() => listWorkbenchSessions(agentName), [agentName]);
  const agents = useAgents();
  const sessions = useMemo(() => sessionsNewestFirst(list.data ?? []), [list.data]);
  const enablement =
    agents.data?.find((agent) => agent.agentName === agentName)?.enablement ?? null;

  const error = list.error ?? agents.error;
  const status = error !== null ? "error" : list.loading || agents.loading ? "loading" : "ready";

  const reload = () => {
    list.reload();
    agents.reload();
  };

  const selectAgent = (value: string | null) => {
    if (value === null) return;
    setParams(value === ALL_AGENTS ? {} : { [AGENT_PARAM]: value });
  };

  return {
    status,
    error,
    reload,
    sessions,
    agentName,
    agentOptions: [ALL_AGENTS, ...(agents.data ?? []).map((agent) => agent.agentName)],
    selectAgent,
    enablement,
  };
}
