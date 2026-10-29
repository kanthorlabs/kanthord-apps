import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { decideProposals } from "@/api/resources/mission";
import type { MissionNodeRecord, MissionProposal } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { openProposalsOf } from "@/lib/attention";

export interface ProposalDecisionState {
  readonly open: boolean;
  readonly openProposals: readonly MissionProposal[];
  readonly checked: readonly string[];
  readonly reason: string;
  readonly error: string | null;
  readonly deciding: boolean;
  readonly available: boolean;
  readonly unavailableReason: string | null;
  readonly toggle: (proposalId: string) => void;
  readonly setReason: (reason: string) => void;
  readonly request: () => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  "mission.node.tags_unmatched":
    "No worker binding of the project matches the tags of this node. Add a worker binding whose tags include every tag of this node, then try again.",
  "mission.proposal.decided":
    "Another decision of this assessment came first. The view now shows it.",
  "mission.proposal.assessment_mismatch":
    "A proposal no longer belongs to this assessment. The view now shows the current proposals.",
  "mission.node.state_conflict":
    "The proposer is no longer Blocked at the attempt of these proposals. The view now shows its current state.",
  "mission.version.conflict":
    "The mission changed after this read. The view now shows the current mission. Review the proposals and decide again.",
};

function unavailableReasonOf(
  proposer: MissionNodeRecord,
  openProposals: readonly MissionProposal[],
): string | null {
  if (openProposals.length === 0) return null;
  if (proposer.retired_at !== null)
    return "The proposer is retired. Decide needs an active proposer.";
  if (proposer.state !== "Blocked") {
    return `The proposer is ${proposer.state}. Decide needs a Blocked proposer.`;
  }
  return null;
}

function countText(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

export function useProposalDecision(
  proposer: MissionNodeRecord,
  proposals: readonly MissionProposal[],
  missionVersion: number,
  reload: () => void,
): ProposalDecisionState {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<readonly string[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);

  const openProposals = useMemo(() => openProposalsOf(proposer, proposals), [proposer, proposals]);
  const unavailableReason = unavailableReasonOf(proposer, openProposals);
  const available = openProposals.length > 0 && unavailableReason === null;

  const toggle = useCallback((proposalId: string) => {
    setChecked((current) =>
      current.includes(proposalId)
        ? current.filter((id) => id !== proposalId)
        : [...current, proposalId],
    );
  }, []);

  const request = useCallback(() => {
    if (!available) return;
    setError(null);
    setReason("");
    setChecked([]);
    setOpen(true);
  }, [available]);

  const cancel = useCallback(() => {
    if (deciding) return;
    setOpen(false);
    setError(null);
  }, [deciding]);

  const confirm = useCallback(() => {
    if (deciding || !open) return;
    if (!available) {
      setOpen(false);
      return;
    }
    const approved = openProposals
      .filter((proposal) => checked.includes(proposal.id))
      .map((proposal) => proposal.id);
    const first = openProposals[0];
    if (approved.length === 0 || first === undefined) return;
    const trimmed = reason.trim();
    setDeciding(true);
    setError(null);
    decideProposals(first.assessment_id, {
      expected_mission_version: missionVersion,
      approved_proposal_ids: approved,
      ...(trimmed.length === 0 ? {} : { reason: trimmed }),
    }).then(
      ({ created, rejected_proposal_ids: rejected, proposer: unblocked }) => {
        setDeciding(false);
        toast.success(`Decided the proposals of ${proposer.content.name}.`, {
          description: `${countText(created.length, "fix node")} created, ${countText(rejected.length, "proposal")} rejected. The proposer is ${unblocked.node.state}.`,
        });
        setOpen(false);
        reload();
      },
      (cause: unknown) => {
        setDeciding(false);
        const failure = asApiError(cause);
        const message = CONFLICT_MESSAGES[failure.detail] ?? failure.message;
        setError(message);
        toast.error(`Deciding the proposals of ${proposer.content.name} failed.`, {
          description: message,
        });
        reload();
      },
    );
  }, [deciding, open, available, openProposals, checked, reason, missionVersion, proposer, reload]);

  return {
    open,
    openProposals,
    checked,
    reason,
    error,
    deciding,
    available,
    unavailableReason,
    toggle,
    setReason,
    request,
    cancel,
    confirm,
  };
}
