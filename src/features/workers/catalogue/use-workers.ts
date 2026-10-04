import { listWorkerCatalog, listWorkerInstances } from "@/api/resources/workers";
import type { WorkerCatalogItem, WorkerInstanceRecord } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { useResource, type Resource } from "@/hooks/use-resource";

export interface WorkersData {
  readonly catalog: Resource<readonly WorkerCatalogItem[]>;
  readonly instances: Resource<readonly WorkerInstanceRecord[]>;
}

export function useWorkers(): WorkersData {
  const projectId = useProjectId();
  const catalog = useResource(() => listWorkerCatalog(), []);
  const instances = useResource(() => listWorkerInstances(projectId), [projectId]);
  return { catalog, instances };
}
