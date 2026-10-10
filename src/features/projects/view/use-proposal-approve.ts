import { useCallback, useState } from "react";
import { toast } from "sonner";

import { approveProposal } from "@/api/resources/mission";
import type { MissionProposal, MissionRunnableNode } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export interface ProposalApproveState {
  readonly target: MissionProposal | null;
  readonly reason: string;
  readonly error: string | null;
  readonly approving: boolean;
  readonly consequence: string;
  readonly saferPath: string;
  readonly canApprove: (proposal: MissionProposal) => boolean;
  readonly unavailableReason: (proposal: MissionProposal) => string | null;
  readonly request: (proposal: MissionProposal) => void;
  readonly setReason: (reason: string) => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  "mission.proposal.already_approved":
    "Another approve of this proposal came first. The section now shows the objective that it created.",
  "mission.node.state_conflict":
    "The initiative is no longer Blocked at the attempt of this proposal. The section now shows its current state.",
  "mission.version.conflict":
    "The mission changed after this read. The section now shows the current mission. Review the proposal and approve again.",
};

function unavailableReasonOf(
  initiative: MissionRunnableNode,
  proposal: MissionProposal,
): string | null {
  if (proposal.approved_at !== null) return null;
  if (initiative.retired_at !== null)
    return "The initiative is retired. Approve needs an active initiative.";
  if (initiative.state !== "Blocked") {
    return `The initiative is ${initiative.state}. Approve needs a Blocked initiative.`;
  }
  if (initiative.attempt !== proposal.attempt) {
    return `The proposal belongs to attempt ${proposal.attempt}. The initiative is blocked after attempt ${initiative.attempt}.`;
  }
  return null;
}

function isApprovable(initiative: MissionRunnableNode, proposal: MissionProposal): boolean {
  return proposal.approved_at === null && unavailableReasonOf(initiative, proposal) === null;
}

export function useProposalApprove(
  initiative: MissionRunnableNode,
  missionVersion: number,
  reload: () => void,
): ProposalApproveState {
  const [target, setTarget] = useState<MissionProposal | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  const canApprove = useCallback(
    (proposal: MissionProposal) => isApprovable(initiative, proposal),
    [initiative],
  );

  const unavailableReason = useCallback(
    (proposal: MissionProposal) => unavailableReasonOf(initiative, proposal),
    [initiative],
  );

  const request = useCallback(
    (proposal: MissionProposal) => {
      if (!isApprovable(initiative, proposal)) return;
      setError(null);
      setReason("");
      setTarget(proposal);
    },
    [initiative],
  );

  const cancel = useCallback(() => {
    if (approving) return;
    setTarget(null);
    setError(null);
  }, [approving]);

  const confirm = useCallback(() => {
    if (approving || target === null) return;
    if (!isApprovable(initiative, target)) {
      setTarget(null);
      return;
    }
    const trimmed = reason.trim();
    setApproving(true);
    setError(null);
    approveProposal(target.id, {
      expected_mission_version: missionVersion,
      ...(trimmed.length === 0 ? {} : { reason: trimmed }),
    }).then(
      () => {
        setApproving(false);
        toast.success(`Approved the proposal ${target.content.name}.`, {
          description: `The objective is created under ${initiative.content.name}, and the initiative is unblocked.`,
        });
        setTarget(null);
        reload();
      },
      (cause: unknown) => {
        setApproving(false);
        const failure = asApiError(cause);
        setError(CONFLICT_MESSAGES[failure.detail] ?? failure.message);
        reload();
      },
    );
  }, [approving, target, initiative, reason, missionVersion, reload]);

  return {
    target,
    reason,
    error,
    approving,
    consequence: `Approve creates the objective ${target?.content.name ?? ""} with its task under ${initiative.content.name} and unblocks the initiative. An approve cannot be undone.`,
    saferPath: `To reject the proposal, keep it unapproved and unblock or discard ${initiative.content.name} instead.`,
    canApprove,
    unavailableReason,
    request,
    setReason,
    cancel,
    confirm,
  };
}
