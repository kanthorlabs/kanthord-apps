import { listNodeProposals } from "@/api/resources/mission";
import type { MissionProposal } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

const NO_PROPOSALS: readonly MissionProposal[] = [];

export function useNodeProposals(
  nodeId: string,
  initiative: boolean,
): Resource<readonly MissionProposal[]> {
  return useResource(
    () => (initiative ? listNodeProposals(nodeId) : Promise.resolve(NO_PROPOSALS)),
    [nodeId, initiative],
  );
}
