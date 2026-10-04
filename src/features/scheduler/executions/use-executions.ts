import { useMemo, useState } from "react";

import { listProjectExecutions } from "@/api/resources/scheduler";
import type { ApiError } from "@/api/errors";
import type { SchedulerExecutionRecord } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { useMissionNodes } from "@/hooks/use-mission-nodes";
import { useResource } from "@/hooks/use-resource";

export type ExecutionScope = "live" | "all";

export interface ExecutionView {
  readonly execution: SchedulerExecutionRecord;
  readonly nodeName: string;
}

export interface ExecutionsState {
  readonly projectId: string;
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly reload: () => void;
  readonly views: readonly ExecutionView[];
  readonly scope: ExecutionScope;
  readonly selectScope: (value: readonly string[]) => void;
}

export function useExecutions(): ExecutionsState {
  const projectId = useProjectId();
  const [scope, setScope] = useState<ExecutionScope>("live");
  const executions = useResource(() => listProjectExecutions(projectId), [projectId]);
  const nodes = useMissionNodes(projectId);

  const views = useMemo(() => {
    const names = new Map((nodes.data ?? []).map((node) => [node.id, node.content.name]));
    return (executions.data ?? [])
      .filter((execution) => scope === "all" || execution.claimState === "running")
      .map((execution) => ({
        execution,
        nodeName: names.get(execution.nodeId) ?? execution.nodeId,
      }));
  }, [executions.data, nodes.data, scope]);

  const reload = () => {
    executions.reload();
    nodes.reload();
  };

  const selectScope = (values: readonly string[]) => {
    const value = values[0];
    if (value === "live" || value === "all") setScope(value);
  };

  return {
    projectId,
    loading: executions.loading || nodes.loading,
    error: executions.error ?? nodes.error,
    reload,
    views,
    scope,
    selectScope,
  };
}
