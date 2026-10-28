import { listNodeExternalActions } from "@/api/resources/mission";
import type { MissionExternalAction } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

const NO_ACTIONS: readonly MissionExternalAction[] = [];

export function useNodeExternalActions(
  nodeId: string,
  attempt: number,
  enabled: boolean,
): Resource<readonly MissionExternalAction[]> {
  return useResource(
    () =>
      enabled && attempt > 0
        ? listNodeExternalActions(nodeId, attempt)
        : Promise.resolve(NO_ACTIONS),
    [nodeId, attempt, enabled],
  );
}
