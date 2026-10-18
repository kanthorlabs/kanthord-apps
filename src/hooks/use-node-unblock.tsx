import { Fragment, useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { unblockNode } from "@/api/resources/mission";
import type { MissionProposal, MissionNodeRecord } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { asApiError } from "@/hooks/use-resource";
import { openProposalsOf } from "@/lib/attention";

export interface NodeUnblockState {
  readonly available: boolean;
  readonly open: boolean;
  readonly reason: string;
  readonly startChoice: boolean;
  readonly fromBase: boolean;
  readonly error: string | null;
  readonly unblocking: boolean;
  readonly consequence: ReactNode;
  readonly proposalNotice: ReactNode;
  readonly saferPath: ReactNode;
  readonly request: () => void;
  readonly setReason: (reason: string) => void;
  readonly setFromBase: (fromBase: boolean) => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  "mission.node.state_conflict":
    "The node is no longer Blocked at this attempt. The view now shows its current state.",
  "mission.node.control_refused":
    "The node is no longer Blocked. The view now shows its current state.",
  "mission.revision.conflict":
    "The content of the node changed after this read. The view now shows the current revision. Review it and unblock again.",
  "mission.version.conflict":
    "The mission changed after this read. The view now shows the current mission. Review the node and unblock again.",
  "mission.node.retired": "The node is retired. The view now shows its current state.",
  "mission.node.terminal": "The node is terminal. The view now shows its current state.",
  "mission.node.tags_unmatched":
    "No worker binding of the project matches the tags of this node. Add a worker binding whose tags hold each key, then try again.",
  "mission.node.intent_locked": "The node opened an attempt, so its intent cannot change.",
};

function isUnblockable(node: MissionNodeRecord): boolean {
  return node.retired_at === null && node.state === "Blocked";
}

function hasStartChoice(node: MissionNodeRecord): boolean {
  return node.intent === "implement" && node.attempt > 0;
}

function consequenceOf(node: MissionNodeRecord): ReactNode {
  const name = <RecordName>{node.content.name}</RecordName>;
  if (node.attempt === 0) {
    return (
      <>
        Unblock makes {name} Available at revision {node.visible_revision}. The scheduler then
        routes the node.
      </>
    );
  }
  return (
    <>
      Unblock opens attempt {node.attempt + 1} of {name} at revision {node.visible_revision} and
      makes the node Available.
    </>
  );
}

function proposalNoticeOf(
  node: MissionNodeRecord,
  proposals: readonly MissionProposal[],
): ReactNode {
  const open = openProposalsOf(node, proposals);
  if (open.length === 0) return null;
  return (
    <>
      Unblock rejects the open proposals:{" "}
      {open.map((proposal, index) => (
        <Fragment key={proposal.id}>
          {index > 0 && ", "}
          <RecordName>{proposal.content.name}</RecordName>
        </Fragment>
      ))}
      . They stay recorded, but the examine node runs the next attempt without the fix node.
    </>
  );
}

export function useNodeUnblock(
  node: MissionNodeRecord,
  missionVersion: number,
  proposals: readonly MissionProposal[],
  reload: () => void,
): NodeUnblockState {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [fromBase, setFromBase] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState(false);
  const available = isUnblockable(node);

  const request = useCallback(() => {
    if (!isUnblockable(node)) return;
    setError(null);
    setReason("");
    setFromBase(false);
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
      ...(fromBase && hasStartChoice(node) ? { start_point: "base_branch" as const } : {}),
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
        const message = CONFLICT_MESSAGES[failure.detail] ?? failure.message;
        setError(message);
        toast.error(`Unblocking ${node.content.name} failed.`, { description: message });
        reload();
      },
    );
  }, [unblocking, open, node, reason, fromBase, missionVersion, reload]);

  return {
    available,
    open,
    reason,
    startChoice: hasStartChoice(node),
    fromBase,
    error,
    unblocking,
    consequence: consequenceOf(node),
    proposalNotice: node.intent === "examine" ? proposalNoticeOf(node, proposals) : null,
    saferPath: (
      <>
        To end <RecordName>{node.content.name}</RecordName> instead, keep it Blocked and discard it.
      </>
    ),
    request,
    setReason,
    setFromBase,
    cancel,
    confirm,
  };
}
