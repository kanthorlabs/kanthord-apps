import { useCallback } from "react";

import { listProjects } from "@/api/resources/projects";
import { readWorkerInstance } from "@/api/resources/worker-instances";
import { readWorkerMachine } from "@/api/resources/worker-machines";
import type { WorkerMachineDetail, WorkerMachineInstance } from "@/api/types";
import { useCredentialPlatforms } from "@/features/credentials/use-credential-platforms";
import {
  credentialRowsOf,
  type InstanceCredentialRow,
} from "@/features/workers/instance/use-instance-page";
import { type Resource, useResource } from "@/hooks/use-resource";

export interface MachinePage {
  readonly machine: Resource<WorkerMachineDetail>;
  readonly liveInstances: readonly WorkerMachineInstance[];
  readonly credentialRows: readonly InstanceCredentialRow[];
  readonly servedProjects: readonly string[];
  readonly contextError: string | null;
  readonly retryContext: () => void;
}

export function liveInstancesOf(
  detail: WorkerMachineDetail | null,
): readonly WorkerMachineInstance[] {
  return (detail?.instances ?? []).filter((instance) => instance.ended_at === null);
}

async function readServedProjects(
  instances: readonly WorkerMachineInstance[],
): Promise<readonly string[]> {
  if (instances.length === 0) return [];
  const [projects, details] = await Promise.all([
    listProjects(),
    Promise.all(instances.map((instance) => readWorkerInstance(instance.name))),
  ]);
  const projectIds = [
    ...new Set(details.flatMap((detail) => detail.bindings.map((binding) => binding.project_id))),
  ];
  return projectIds.map((id) => projects.find((project) => project.id === id)?.name ?? id);
}

export function useMachinePage(machineName: string): MachinePage {
  const machine = useResource(() => readWorkerMachine(machineName), [machineName]);
  const liveInstances = liveInstancesOf(machine.data);
  const served = useResource(
    () => readServedProjects(liveInstances),
    [liveInstances.map((instance) => `${instance.name}/${instance.revision}`)],
  );
  const platforms = useCredentialPlatforms("llm");
  const reloadServed = served.reload;
  const reloadPlatforms = platforms.reload;
  const retryContext = useCallback(() => {
    reloadServed();
    reloadPlatforms();
  }, [reloadServed, reloadPlatforms]);
  return {
    machine,
    liveInstances,
    credentialRows: credentialRowsOf(
      machine.data?.credentials ?? [],
      platforms.data?.items ?? null,
    ),
    servedProjects: served.data ?? [],
    contextError: (served.error ?? platforms.error)?.message ?? null,
    retryContext,
  };
}
