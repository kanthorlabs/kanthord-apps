import { listBlocked } from "@/api/resources/mission";
import type { BlockedNode } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import type { Resource } from "@/hooks/use-resource";
import { useResource } from "@/hooks/use-resource";

export function useBlocked(): Resource<readonly BlockedNode[]> {
  const projectId = useProjectId();
  return useResource(() => listBlocked(projectId), [projectId]);
}
