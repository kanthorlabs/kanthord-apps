import { listNodeAttempts } from "@/api/resources/mission";
import type { MissionAttempt } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export function useNodeAttempts(nodeId: string): Resource<readonly MissionAttempt[]> {
  return useResource(() => listNodeAttempts(nodeId), [nodeId]);
}
