import { useMemo } from "react";

import { listWorkerBindings } from "@/api/resources/projects";
import { listWorkerCatalog, listWorkerRegistrations } from "@/api/resources/workers";
import type { WorkerBindingRecord, WorkerCatalogItem, WorkerRegistrationRecord } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { useResource, type Resource } from "@/hooks/use-resource";
import { bindingInstances, type BindingInstances } from "./binding-instances";

export interface WorkersData {
  readonly catalog: Resource<readonly WorkerCatalogItem[]>;
  readonly registrations: Resource<readonly WorkerRegistrationRecord[]>;
  readonly bindings: Resource<readonly WorkerBindingRecord[]>;
  readonly bindingEntries: readonly BindingInstances[];
}

export function useWorkers(): WorkersData {
  const projectId = useProjectId();
  const catalog = useResource(() => listWorkerCatalog(), []);
  const registrations = useResource(() => listWorkerRegistrations(projectId), [projectId]);
  const bindings = useResource(() => listWorkerBindings(projectId), [projectId]);
  const bindingEntries = useMemo(
    () => bindingInstances(bindings.data ?? [], registrations.data ?? [], catalog.data ?? []),
    [bindings.data, registrations.data, catalog.data],
  );
  return { catalog, registrations, bindings, bindingEntries };
}
