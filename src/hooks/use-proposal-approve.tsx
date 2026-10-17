import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { approveProposal } from "@/api/resources/mission";
import type { MissionNodeRecord, MissionProposal } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { asApiError } from "@/hooks/use-resource";

export interface ProposalApproveState {
  readonly target: MissionProposal | null;
  readonly reason: string;
  readonly error: string | null;
  readonly approving: boolean;
  readonly consequence: ReactNode;
  readonly saferPath: ReactNode;
  readonly canApprove: (proposal: MissionProposal) => boolean;
  readonly unavailableReason: (proposal: MissionProposal) => string | null;
  readonly request: (proposal: MissionProposal) => void;
  readonly setReason: (reason: string) => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  "mission.node.requires_unmatched":
    "No worker binding of the project matches the requires list of this node. Add a worker binding whose traits hold each key, then try again.",
  "mission.proposal.already_approved":
    "Another approve of this proposal came first. The view now shows the fix node that it created.",
  "mission.node.state_conflict":
    "The proposer is no longer Blocked at the attempt of this proposal. The view now shows its current state.",
  "mission.version.conflict":
    "The mission changed after this read. The view now shows the current mission. Review the proposal and approve again.",
};

function unavailableReasonOf(
  proposer: MissionNodeRecord,
  proposal: MissionProposal,
): string | null {
  if (proposal.approved_at !== null) return null;
  if (proposer.retired_at !== null)
    return "The proposer is retired. Approve needs an active proposer.";
  if (proposer.state !== "Blocked") {
    return `The proposer is ${proposer.state}. Approve needs a Blocked proposer.`;
  }
  if (proposer.attempt !== proposal.attempt) {
    return `The proposal belongs to attempt ${proposal.attempt}. The proposer is blocked after attempt ${proposer.attempt}.`;
  }
  return null;
}

function isApprovable(proposer: MissionNodeRecord, proposal: MissionProposal): boolean {
  return proposal.approved_at === null && unavailableReasonOf(proposer, proposal) === null;
}

export function useProposalApprove(
  proposer: MissionNodeRecord,
  missionVersion: number,
  reload: () => void,
): ProposalApproveState {
  const [target, setTarget] = useState<MissionProposal | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  const canApprove = useCallback(
    (proposal: MissionProposal) => isApprovable(proposer, proposal),
    [proposer],
  );

  const unavailableReason = useCallback(
    (proposal: MissionProposal) => unavailableReasonOf(proposer, proposal),
    [proposer],
  );

  const request = useCallback(
    (proposal: MissionProposal) => {
      if (!isApprovable(proposer, proposal)) return;
      setError(null);
      setReason("");
      setTarget(proposal);
    },
    [proposer],
  );

  const cancel = useCallback(() => {
    if (approving) return;
    setTarget(null);
    setError(null);
  }, [approving]);

  const confirm = useCallback(() => {
    if (approving || target === null) return;
    if (!isApprovable(proposer, target)) {
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
      ({ created, proposer: unblocked }) => {
        setApproving(false);
        toast.success(`Approved the proposal ${target.content.name}.`, {
          description: (
            <>
              The fix node is created as a dependency of{" "}
              <RecordName>{unblocked.node.content.name}</RecordName>. The proposer is{" "}
              {unblocked.node.state} at mission version {created.mission_version}.
            </>
          ),
        });
        setTarget(null);
        reload();
      },
      (cause: unknown) => {
        setApproving(false);
        const failure = asApiError(cause);
        const message = CONFLICT_MESSAGES[failure.detail] ?? failure.message;
        setError(message);
        toast.error(`Approving the proposal ${target.content.name} failed.`, {
          description: message,
        });
        reload();
      },
    );
  }, [approving, target, proposer, reason, missionVersion, reload]);

  return {
    target,
    reason,
    error,
    approving,
    consequence: (
      <>
        Approve creates the fix node <RecordName>{target?.content.name ?? ""}</RecordName> with its
        task, adds it as a dependency of <RecordName>{proposer.content.name}</RecordName> and
        unblocks the proposer. An approve cannot be undone.
      </>
    ),
    saferPath: (
      <>
        To reject the proposal, keep it unapproved and use Unblock or Discard on{" "}
        <RecordName>{proposer.content.name}</RecordName> instead.
      </>
    ),
    canApprove,
    unavailableReason,
    request,
    setReason,
    cancel,
    confirm,
  };
}
