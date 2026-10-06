import { useMemo } from "react";

import { listWorkbenchSessions } from "@/api/resources/workbench";
import type { ApiError } from "@/api/errors";
import type { AgentEnablement, WorkbenchSessionListItem } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { useAgent } from "@/features/workers/agent/use-agent";
import { sessionsNewestFirst } from "@/lib/workbench-sessions";

export interface WorkbenchSessionsState {
  readonly status: "loading" | "ready" | "error";
  readonly error: ApiError | null;
  readonly reload: () => void;
  readonly sessions: readonly WorkbenchSessionListItem[];
  readonly enablement: AgentEnablement | null;
}

export function useWorkbenchSessions(agentName: string): WorkbenchSessionsState {
  const list = useResource(() => listWorkbenchSessions(agentName), [agentName]);
  const agent = useAgent(agentName);
  const sessions = useMemo(() => sessionsNewestFirst(list.data ?? []), [list.data]);

  const error = list.error ?? agent.error;
  const status = error !== null ? "error" : list.loading || agent.loading ? "loading" : "ready";

  const reload = () => {
    list.reload();
    agent.reload();
  };

  return { status, error, reload, sessions, enablement: agent.data?.enablement ?? null };
}
