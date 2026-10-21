import { listProjects } from "@/api/resources/projects";
import { readWorkerInstance } from "@/api/resources/worker-instances";
import { useResource, type Resource } from "@/hooks/use-resource";

export interface InstanceSharing {
  readonly instance: string;
  readonly projects: readonly string[];
}

interface SharedIds {
  readonly instance: string;
  readonly projectIds: readonly string[];
}

const NO_SHARING: readonly InstanceSharing[] = [];

async function readInstanceSharing(
  projectId: string,
  instances: readonly string[],
): Promise<readonly InstanceSharing[]> {
  if (instances.length === 0) return NO_SHARING;
  const details = await Promise.all(instances.map((instance) => readWorkerInstance(instance)));
  const shared: readonly SharedIds[] = details
    .map((detail) => ({
      instance: detail.name,
      projectIds: [
        ...new Set([projectId, ...detail.bindings.map((binding) => binding.project_id)]),
      ],
    }))
    .filter((item) => item.projectIds.length >= 2);
  if (shared.length === 0) return NO_SHARING;
  const projects = await listProjects();
  const nameOf = (id: string) => projects.find((project) => project.id === id)?.name ?? id;
  return shared.map((item) => ({
    instance: item.instance,
    projects: [...new Set(item.projectIds.map(nameOf))],
  }));
}

export function useInstanceSharing(
  projectId: string,
  instances: readonly string[],
): Resource<readonly InstanceSharing[]> {
  return useResource(() => readInstanceSharing(projectId, instances), [projectId, instances]);
}
