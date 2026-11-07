import { listProjects } from "@/api/resources/projects";
import { readWorkerInstance } from "@/api/resources/worker-instances";
import { readWorkerMachine } from "@/api/resources/worker-machines";
import type { WorkerMachineDetail, WorkerMachineInstance } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

export interface MachinePage {
  readonly machine: Resource<WorkerMachineDetail>;
  readonly liveInstances: readonly WorkerMachineInstance[];
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
  return {
    machine,
    liveInstances,
    servedProjects: served.data ?? [],
    contextError: served.error?.message ?? null,
    retryContext: served.reload,
  };
}
