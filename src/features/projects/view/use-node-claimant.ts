import { listWorkerInstances } from "@/api/resources/workers";
import type { InstanceActivity, SchedulerExecutionRecord, WorkerInstanceRecord } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export type ActivityRead =
  | { readonly state: "loading" }
  | { readonly state: "failed"; readonly message: string; readonly retry: () => void }
  | { readonly state: "gone" }
  | { readonly state: "found"; readonly activity: InstanceActivity };

export type NodeClaimant =
  | { readonly kind: "failed"; readonly message: string; readonly retry: () => void }
  | { readonly kind: "none"; readonly attempt: number }
  | {
      readonly kind: "claimed";
      readonly claimant: SchedulerExecutionRecord["claimant"];
      readonly deadline: number;
      readonly activity: ActivityRead;
    };

export interface NodeClaimantRead {
  readonly claimant: NodeClaimant | null;
  readonly reload: () => void;
}

interface InstanceRead {
  readonly runtimeIdentity: string | null;
  readonly items: readonly WorkerInstanceRecord[];
}

async function readInstances(
  projectId: string,
  runtimeIdentity: string | null,
): Promise<InstanceRead> {
  const items = runtimeIdentity === null ? [] : await listWorkerInstances(projectId);
  return { runtimeIdentity, items };
}

function activityOf(instances: Resource<InstanceRead>, runtimeIdentity: string): ActivityRead {
  if (
    instances.loading ||
    (instances.data !== null && instances.data.runtimeIdentity !== runtimeIdentity)
  ) {
    return { state: "loading" };
  }
  if (instances.data === null) {
    return {
      state: "failed",
      message: instances.error?.message ?? "",
      retry: instances.reload,
    };
  }
  const instance = instances.data.items.find((item) => item.runtime_identity === runtimeIdentity);
  return instance === undefined
    ? { state: "gone" }
    : { state: "found", activity: instance.activity };
}

export function useNodeClaimant(
  projectId: string,
  attempt: number,
  live: boolean,
  executions: Resource<readonly SchedulerExecutionRecord[]>,
): NodeClaimantRead {
  const running = executions.data?.find((execution) => execution.claim_state === "running");
  const runtimeIdentity = running?.claimant.runtime_identity ?? null;
  const instances = useResource(
    () => readInstances(projectId, runtimeIdentity),
    [projectId, runtimeIdentity],
  );
  const { reload } = instances;

  if (!live || executions.loading) return { claimant: null, reload };
  if (executions.data === null) {
    return {
      claimant: {
        kind: "failed",
        message: executions.error?.message ?? "",
        retry: executions.reload,
      },
      reload,
    };
  }
  if (running === undefined) return { claimant: { kind: "none", attempt }, reload };
  return {
    claimant: {
      kind: "claimed",
      claimant: running.claimant,
      deadline: running.expired_at,
      activity: activityOf(instances, running.claimant.runtime_identity),
    },
    reload,
  };
}
