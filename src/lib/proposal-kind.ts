import type { MissionFollowupProposal, MissionNodeProposal, MissionProposal } from "@/api/types";

export function isFollowupProposal(
  proposal: MissionNodeProposal,
): proposal is MissionFollowupProposal {
  return proposal.assessment_id === null;
}

export function isFixProposal(proposal: MissionNodeProposal): proposal is MissionProposal {
  return proposal.assessment_id !== null;
}
