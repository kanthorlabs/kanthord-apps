import { useCallback, useState } from "react";
import { toast } from "sonner";

import { unblockNode } from "@/api/resources/mission";
import type { MissionProposal, MissionRunnableNode } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export interface NodeUnblockState {
  readonly available: boolean;
  readonly open: boolean;
  readonly reason: string;
  readonly error: string | null;
  readonly unblocking: boolean;
  readonly consequence: string;
  readonly proposalNotice: string | null;
  readonly saferPath: string;
  readonly request: () => void;
  readonly setReason: (reason: string) => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  "mission.node.state_conflict":
    "The node is no longer Blocked at this attempt. The sheet now shows its current state.",
  "mission.node.control_refused":
    "The node is no longer Blocked. The sheet now shows its current state.",
  "mission.revision.conflict":
    "The content of the node changed after this read. The sheet now shows the current revision. Review it and unblock again.",
  "mission.version.conflict":
    "The mission changed after this read. The sheet now shows the current mission. Review the node and unblock again.",
  "mission.node.retired": "The node is retired. The sheet now shows its current state.",
  "mission.node.terminal": "The node is terminal. The sheet now shows its current state.",
};

function isUnblockable(node: MissionRunnableNode): boolean {
  return node.retired_at === null && node.state === "Blocked";
}

function openProposalsOf(
  node: MissionRunnableNode,
  proposals: readonly MissionProposal[],
): readonly MissionProposal[] {
  return proposals.filter(
    (proposal) => proposal.approved_at === null && proposal.attempt === node.attempt,
  );
}

function consequenceOf(node: MissionRunnableNode): string {
  if (node.attempt === 0) {
    return `Unblock makes ${node.content.name} Available at revision ${node.visible_revision}. The scheduler then routes the node.`;
  }
  return `Unblock opens attempt ${node.attempt + 1} of ${node.content.name} at revision ${node.visible_revision} and makes the node Available.`;
}

function proposalNoticeOf(
  node: MissionRunnableNode,
  proposals: readonly MissionProposal[],
): string | null {
  const open = openProposalsOf(node, proposals);
  if (open.length === 0) return null;
  const names = open.map((proposal) => proposal.content.name).join(", ");
  return `Unblock rejects the open proposals: ${names}. They stay recorded, but the initiative runs the next attempt without the fix objective.`;
}

export function useNodeUnblock(
  node: MissionRunnableNode,
  missionVersion: number,
  proposals: readonly MissionProposal[],
  reload: () => void,
): NodeUnblockState {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState(false);
  const available = isUnblockable(node);

  const request = useCallback(() => {
    if (!isUnblockable(node)) return;
    setError(null);
    setReason("");
    setOpen(true);
  }, [node]);

  const cancel = useCallback(() => {
    if (unblocking) return;
    setOpen(false);
    setError(null);
  }, [unblocking]);

  const confirm = useCallback(() => {
    if (unblocking || !open) return;
    if (!isUnblockable(node)) {
      setOpen(false);
      return;
    }
    const trimmed = reason.trim();
    setUnblocking(true);
    setError(null);
    unblockNode(node.id, {
      blocked_attempt: node.attempt,
      expected_revision: node.visible_revision,
      expected_mission_version: missionVersion,
      ...(trimmed.length === 0 ? {} : { reason: trimmed }),
    }).then(
      () => {
        setUnblocking(false);
        toast.success(`Unblocked ${node.content.name}.`, {
          description:
            node.attempt === 0
              ? "The node is Available."
              : `Attempt ${node.attempt + 1} is open, and the node is Available.`,
        });
        setOpen(false);
        reload();
      },
      (cause: unknown) => {
        setUnblocking(false);
        const failure = asApiError(cause);
        setError(CONFLICT_MESSAGES[failure.detail] ?? failure.message);
        reload();
      },
    );
  }, [unblocking, open, node, reason, missionVersion, reload]);

  return {
    available,
    open,
    reason,
    error,
    unblocking,
    consequence: consequenceOf(node),
    proposalNotice: node.kind === "initiative" ? proposalNoticeOf(node, proposals) : null,
    saferPath: `To end ${node.content.name} instead, keep it Blocked and discard it.`,
    request,
    setReason,
    cancel,
    confirm,
  };
}
