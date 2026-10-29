import { listProjects, listWorkerBindings } from "@/api/resources/projects";
import { listWorkerInstances } from "@/api/resources/worker-instances";
import { listAllWorkerRegistrations, readWorkerCatalogEntry } from "@/api/resources/workers";
import type {
  WorkerBindingRecord,
  WorkerCatalogEntry,
  WorkerInstanceListItem,
  WorkerRegistrationRecord,
} from "@/api/types";
import { type InstanceExecution, useInstanceExecutions } from "@/hooks/use-instance-executions";
import { usePolledResource } from "@/hooks/use-polled-resource";
import { type Resource, useResource } from "@/hooks/use-resource";
import { useWorkersProjectId } from "../use-workers-project-id";

const INSTANCES_INTERVAL_MS = 15_000;

export interface WorkerPage {
  readonly projectId: string;
  readonly entry: Resource<WorkerCatalogEntry>;
  readonly instances: Resource<readonly WorkerInstanceListItem[]>;
  readonly registrations: Resource<readonly WorkerRegistrationRecord[]>;
  readonly bindings: Resource<readonly WorkerBindingRecord[]>;
  readonly projectRegistrations: readonly WorkerRegistrationRecord[];
  readonly executionOf: (instanceName: string) => InstanceExecution | null;
  readonly projectNameOf: (projectId: string) => string;
  readonly runsUnlisted: (instance: WorkerInstanceListItem) => boolean;
}

export function useWorkerPage(workerName: string): WorkerPage {
  const projectId = useWorkersProjectId();
  const entry = useResource(() => readWorkerCatalogEntry(workerName), [workerName]);
  const polled = usePolledResource(() => listWorkerInstances(workerName), [workerName], {
    intervalMs: INSTANCES_INTERVAL_MS,
  });
  const instances: Resource<readonly WorkerInstanceListItem[]> = {
    ...polled,
    reload: polled.refresh,
  };
  const registrations = useResource(() => listAllWorkerRegistrations(), [workerName]);
  const projects = useResource(() => listProjects(), []);
  const projectNameOf = (id: string) =>
    projects.data?.find((project) => project.id === id)?.name ?? id;
  const bindings = useResource(
    async () =>
      (await listWorkerBindings(projectId)).filter(
        (binding) => binding.config.worker === workerName,
      ),
    [projectId, workerName],
  );
  const own = (registrations.data ?? []).filter(
    (registration) => registration.worker_name === workerName,
  );
  const executions = useInstanceExecutions(own);
  const projectRegistrations = own.filter((registration) => registration.project_id === projectId);
  const executionOf = (instanceName: string) => {
    const runtimes = own
      .filter((registration) => registration.instance === instanceName)
      .map((registration) => registration.runtime_identity);
    return executions.find((execution) => runtimes.includes(execution.runtimeIdentity)) ?? null;
  };
  const runsUnlisted = (instance: WorkerInstanceListItem) =>
    instance.placement !== "worker" && instance.binding_count === 0;
  return {
    projectId,
    entry,
    instances,
    registrations,
    bindings,
    projectRegistrations,
    executionOf,
    projectNameOf,
    runsUnlisted,
  };
}
