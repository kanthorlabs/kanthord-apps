import { listWorkerBindings } from "@/api/resources/projects";
import { listWorkerInstances } from "@/api/resources/worker-instances";
import { listAllWorkerRegistrations, readWorkerCatalogEntry } from "@/api/resources/workers";
import type {
  WorkerBindingRecord,
  WorkerCatalogEntry,
  WorkerInstanceListItem,
  WorkerRegistrationRecord,
} from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { useInstanceExecutions, type InstanceExecution } from "@/hooks/use-instance-executions";
import { useResource, type Resource } from "@/hooks/use-resource";

export interface WorkerPage {
  readonly projectId: string;
  readonly entry: Resource<WorkerCatalogEntry>;
  readonly instances: Resource<readonly WorkerInstanceListItem[]>;
  readonly registrations: Resource<readonly WorkerRegistrationRecord[]>;
  readonly bindings: Resource<readonly WorkerBindingRecord[]>;
  readonly projectRegistrations: readonly WorkerRegistrationRecord[];
  readonly executionOf: (instanceName: string) => InstanceExecution | null;
}

export function useWorkerPage(workerName: string): WorkerPage {
  const projectId = useProjectId();
  const entry = useResource(() => readWorkerCatalogEntry(workerName), [workerName]);
  const instances = useResource(() => listWorkerInstances(workerName), [workerName]);
  const registrations = useResource(() => listAllWorkerRegistrations(), [workerName]);
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
  return {
    projectId,
    entry,
    instances,
    registrations,
    bindings,
    projectRegistrations,
    executionOf,
  };
}
