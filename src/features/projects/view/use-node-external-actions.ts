import { listNodeExternalActions } from "@/api/resources/mission";
import type { MissionExternalAction } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

const NO_ACTIONS: readonly MissionExternalAction[] = [];

export function useNodeExternalActions(
  nodeId: string,
  attempt: number,
  paused: boolean,
): Resource<readonly MissionExternalAction[]> {
  return useResource(
    () => (paused ? listNodeExternalActions(nodeId, attempt) : Promise.resolve(NO_ACTIONS)),
    [nodeId, attempt, paused],
  );
}
