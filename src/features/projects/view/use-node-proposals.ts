import { listNodeProposals } from "@/api/resources/mission";
import type { MissionProposal } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export function useNodeProposals(nodeId: string): Resource<readonly MissionProposal[]> {
  return useResource(() => listNodeProposals(nodeId), [nodeId]);
}
