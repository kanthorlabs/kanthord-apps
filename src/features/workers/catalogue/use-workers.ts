import { useMemo } from "react";

import { listWorkerBindings } from "@/api/resources/projects";
import { listWorkerCatalog, listWorkerInstances } from "@/api/resources/workers";
import type { WorkerBindingRecord, WorkerCatalogItem, WorkerInstanceRecord } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { useResource, type Resource } from "@/hooks/use-resource";
import { bindingInstances, type BindingInstances } from "./binding-instances";

export interface WorkersData {
  readonly catalog: Resource<readonly WorkerCatalogItem[]>;
  readonly instances: Resource<readonly WorkerInstanceRecord[]>;
  readonly bindings: Resource<readonly WorkerBindingRecord[]>;
  readonly bindingEntries: readonly BindingInstances[];
}

export function useWorkers(): WorkersData {
  const projectId = useProjectId();
  const catalog = useResource(() => listWorkerCatalog(), []);
  const instances = useResource(() => listWorkerInstances(projectId), [projectId]);
  const bindings = useResource(() => listWorkerBindings(projectId), [projectId]);
  const bindingEntries = useMemo(
    () => bindingInstances(bindings.data ?? [], instances.data ?? [], catalog.data ?? []),
    [bindings.data, instances.data, catalog.data],
  );
  return { catalog, instances, bindings, bindingEntries };
}
