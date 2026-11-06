import { listNodeLinkUpdates } from "@/api/resources/mission";
import type { MissionLinkUpdate } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

const NO_UPDATES: readonly MissionLinkUpdate[] = [];

export function useNodeLinkUpdates(
  nodeId: string,
  linked: boolean,
): Resource<readonly MissionLinkUpdate[]> {
  return useResource(
    () => (linked ? listNodeLinkUpdates(nodeId) : Promise.resolve(NO_UPDATES)),
    [nodeId, linked],
  );
}
