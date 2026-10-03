import { listNodeRevisions } from "@/api/resources/mission";
import type { MissionRevision } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export function useNodeRevisions(nodeId: string): Resource<readonly MissionRevision[]> {
  return useResource(() => listNodeRevisions(nodeId), [nodeId]);
}
