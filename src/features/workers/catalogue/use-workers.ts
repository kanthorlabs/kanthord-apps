import { listWorkerCatalog, listWorkerInstances } from "@/api/resources/workers";
import { listWorkerBindings } from "@/api/resources/projects";
import type { WorkerBindingRecord, WorkerCatalogItem, WorkerInstanceRecord } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { useResource, type Resource } from "@/hooks/use-resource";

export interface WorkersData {
  readonly catalog: Resource<readonly WorkerCatalogItem[]>;
  readonly instances: Resource<readonly WorkerInstanceRecord[]>;
  readonly bindings: Resource<readonly WorkerBindingRecord[]>;
}

export function useWorkers(): WorkersData {
  const projectId = useProjectId();
  const catalog = useResource(() => listWorkerCatalog(), []);
  const instances = useResource(() => listWorkerInstances(projectId), [projectId]);
  const bindings = useResource(() => listWorkerBindings(projectId), [projectId]);
  return { catalog, instances, bindings };
}
