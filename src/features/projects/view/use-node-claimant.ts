import { listWorkerInstances } from "@/api/resources/workers";
import type { InstanceActivity, SchedulerExecutionRecord, WorkerInstanceRecord } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export interface NodeClaimant {
  readonly claimant: SchedulerExecutionRecord["claimant"];
  readonly activity: InstanceActivity | null;
}

const NO_INSTANCES: readonly WorkerInstanceRecord[] = [];

export function useNodeClaimant(
  projectId: string,
  executions: Resource<readonly SchedulerExecutionRecord[]>,
): NodeClaimant | null {
  const running = executions.data?.find((execution) => execution.claim_state === "running");
  const runtimeIdentity = running?.claimant.runtime_identity ?? null;
  const instances = useResource(
    () =>
      runtimeIdentity === null ? Promise.resolve(NO_INSTANCES) : listWorkerInstances(projectId),
    [projectId, runtimeIdentity],
  );

  if (running === undefined) return null;
  const instance = instances.data?.find((item) => item.runtime_identity === runtimeIdentity);
  return { claimant: running.claimant, activity: instance?.activity ?? null };
}
