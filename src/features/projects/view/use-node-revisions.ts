import { listNodeRevisions } from "@/api/resources/mission";
import type { MissionRevision } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

export function useNodeRevisions(nodeId: string): Resource<readonly MissionRevision[]> {
  return useResource(() => listNodeRevisions(nodeId), [nodeId]);
}
