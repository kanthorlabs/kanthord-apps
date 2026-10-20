import { listWorkerRegistrations } from "@/api/resources/workers";
import type {
  RegistrationActivity,
  SchedulerExecutionRecord,
  WorkerRegistrationRecord,
} from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export type ActivityRead =
  | { readonly state: "loading" }
  | { readonly state: "failed"; readonly message: string; readonly retry: () => void }
  | { readonly state: "gone" }
  | { readonly state: "found"; readonly activity: RegistrationActivity };

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

interface RegistrationRead {
  readonly runtimeIdentity: string | null;
  readonly items: readonly WorkerRegistrationRecord[];
}

async function readInstances(
  projectId: string,
  runtimeIdentity: string | null,
): Promise<RegistrationRead> {
  const items = runtimeIdentity === null ? [] : await listWorkerRegistrations(projectId);
  return { runtimeIdentity, items };
}

function activityOf(
  registrations: Resource<RegistrationRead>,
  runtimeIdentity: string,
): ActivityRead {
  if (
    registrations.loading ||
    (registrations.data !== null && registrations.data.runtimeIdentity !== runtimeIdentity)
  ) {
    return { state: "loading" };
  }
  if (registrations.data === null) {
    return {
      state: "failed",
      message: registrations.error?.message ?? "",
      retry: registrations.reload,
    };
  }
  const registration = registrations.data.items.find(
    (item) => item.runtime_identity === runtimeIdentity,
  );
  return registration === undefined
    ? { state: "gone" }
    : { state: "found", activity: registration.activity };
}

export function useNodeClaimant(
  projectId: string,
  attempt: number,
  live: boolean,
  executions: Resource<readonly SchedulerExecutionRecord[]>,
): NodeClaimantRead {
  const running = executions.data?.find((execution) => execution.claim_state === "running");
  const runtimeIdentity = running?.claimant.runtime_identity ?? null;
  const registrations = useResource(
    () => readInstances(projectId, runtimeIdentity),
    [projectId, runtimeIdentity],
  );
  const { reload } = registrations;

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
      activity: activityOf(registrations, running.claimant.runtime_identity),
    },
    reload,
  };
}
