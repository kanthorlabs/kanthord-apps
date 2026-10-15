import { listNodeExecutions } from "@/api/resources/scheduler";
import type { SchedulerExecutionRecord } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

const NO_EXECUTIONS: readonly SchedulerExecutionRecord[] = [];

export function useNodeExecutions(
  projectId: string,
  nodeId: string,
  attempt: number,
  paused: boolean,
): Resource<readonly SchedulerExecutionRecord[]> {
  return useResource(
    () =>
      paused && attempt > 0
        ? listNodeExecutions(projectId, nodeId, attempt)
        : Promise.resolve(NO_EXECUTIONS),
    [projectId, nodeId, attempt, paused],
  );
}
