import { useMemo } from "react";

import { listWorkerBindings } from "@/api/resources/projects";
import { listWorkerCatalog, listWorkerRegistrations } from "@/api/resources/workers";
import type { WorkerBindingRecord, WorkerCatalogItem, WorkerRegistrationRecord } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { type Resource, useResource } from "@/hooks/use-resource";
import { bindingInstances, type BindingInstances } from "./binding-instances";

export interface WorkersData {
  readonly catalog: Resource<readonly WorkerCatalogItem[]>;
  readonly registrations: Resource<readonly WorkerRegistrationRecord[]>;
  readonly bindings: Resource<readonly WorkerBindingRecord[]>;
  readonly bindingEntries: readonly BindingInstances[];
  readonly liveCounts: Readonly<Record<string, number>>;
}

function liveCountsOf(
  registrations: readonly WorkerRegistrationRecord[],
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const registration of registrations) {
    counts[registration.worker_name] = (counts[registration.worker_name] ?? 0) + 1;
  }
  return counts;
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
  const liveCounts = useMemo(() => liveCountsOf(registrations.data ?? []), [registrations.data]);
  return { catalog, registrations, bindings, bindingEntries, liveCounts };
}
