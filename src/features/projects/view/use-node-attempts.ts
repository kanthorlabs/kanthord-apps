import { listNodeAttempts } from "@/api/resources/mission";
import type { MissionAttempt } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

export function useNodeAttempts(nodeId: string): Resource<readonly MissionAttempt[]> {
  return useResource(() => listNodeAttempts(nodeId), [nodeId]);
}
