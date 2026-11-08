import { listNodeProposals } from "@/api/resources/mission";
import type { MissionProposal } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";
import { isFixProposal } from "@/lib/proposal-kind";

const NO_PROPOSALS: readonly MissionProposal[] = [];

async function listFixProposals(nodeId: string): Promise<readonly MissionProposal[]> {
  return (await listNodeProposals(nodeId)).filter(isFixProposal);
}

export function useNodeProposals(
  nodeId: string,
  examine: boolean,
): Resource<readonly MissionProposal[]> {
  return useResource(
    () => (examine ? listFixProposals(nodeId) : Promise.resolve(NO_PROPOSALS)),
    [nodeId, examine],
  );
}
