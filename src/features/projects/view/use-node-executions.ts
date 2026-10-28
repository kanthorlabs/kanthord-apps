import { listNodeExecutions } from "@/api/resources/scheduler";
import type { SchedulerExecutionRecord } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

const NO_EXECUTIONS: readonly SchedulerExecutionRecord[] = [];

interface ExecutionRead {
  readonly key: string;
  readonly items: readonly SchedulerExecutionRecord[];
}

export function useNodeExecutionHistory(
  projectId: string,
  nodeId: string,
): Resource<readonly SchedulerExecutionRecord[]> {
  return useResource(() => listNodeExecutions(projectId, nodeId), [projectId, nodeId]);
}

export function useNodeExecutions(
  projectId: string,
  nodeId: string,
  attempt: number,
  enabled: boolean,
): Resource<readonly SchedulerExecutionRecord[]> {
  const key = JSON.stringify([projectId, nodeId, attempt, enabled]);
  const read = useResource(
    async (): Promise<ExecutionRead> => ({
      key,
      items:
        enabled && attempt > 0
          ? await listNodeExecutions(projectId, nodeId, attempt)
          : NO_EXECUTIONS,
    }),
    [key],
  );
  const stale = read.data !== null && read.data.key !== key;

  return {
    data: stale ? null : (read.data?.items ?? null),
    error: read.error,
    loading: read.loading || stale,
    reload: read.reload,
  };
}
