import { useEffect } from "react";

import { useDependencyRemove, type DependencyRemoveState } from "@/hooks/use-dependency-remove";
import { useNodeDiscard, type NodeDiscardState } from "@/hooks/use-node-discard";
import { useNodeOverride, type NodeOverrideState } from "@/hooks/use-node-override";
import { useNodeResume, type NodeResumeState } from "@/hooks/use-node-resume";
import { useNodeUnblock, type NodeUnblockState } from "@/hooks/use-node-unblock";
import { useProposalApprove, type ProposalApproveState } from "@/hooks/use-proposal-approve";
import type { AttentionDetail, AttentionItem } from "@/lib/attention";

export interface DecisionActs {
  readonly unblock: NodeUnblockState;
  readonly approve: ProposalApproveState;
  readonly override: NodeOverrideState;
  readonly resume: NodeResumeState;
  readonly remove: DependencyRemoveState;
  readonly discard: NodeDiscardState;
  readonly ready: boolean;
  readonly waiting: string | null;
  readonly failed: boolean;
}

interface DecisionContext {
  readonly reload: () => void;
  readonly setDialogOpen: (nodeId: string, open: boolean) => void;
}

interface ReadState {
  readonly ready: boolean;
  readonly waiting: string | null;
  readonly failed: boolean;
}

const READY: ReadState = { ready: true, waiting: null, failed: false };

function proposalsStateOf(detail: AttentionDetail | null): ReadState {
  if (detail?.kind !== "blocked") {
    return {
      ready: false,
      waiting: "Reading the fix proposals. The acts show after the read.",
      failed: false,
    };
  }
  if (detail.proposals.status === "failed") {
    return {
      ready: false,
      waiting: `The fix proposals could not be read: ${detail.proposals.message}. Unblock and Discard wait for them.`,
      failed: true,
    };
  }
  return READY;
}

function pausedStateOf(attempt: number, detail: AttentionDetail | null): ReadState {
  if (detail?.kind !== "paused") {
    return {
      ready: false,
      waiting: `Reading the executions and the external actions of attempt ${attempt}. The acts show after the read.`,
      failed: false,
    };
  }
  const failure = [detail.executions, detail.actions].find((read) => read.status === "failed");
  if (failure?.status === "failed") {
    return {
      ready: false,
      waiting: `The executions or the external actions of attempt ${attempt} could not be read: ${failure.message}. The acts wait for them.`,
      failed: true,
    };
  }
  return READY;
}

function readStateOf(item: AttentionItem, detail: AttentionDetail | null): ReadState {
  if (item.kind === "paused") return pausedStateOf(item.node.attempt, detail);
  if (item.kind === "blocked" && item.node.kind === "initiative") return proposalsStateOf(detail);
  return READY;
}

export function useDecisionActs(
  item: AttentionItem,
  detail: AttentionDetail | null,
  { reload, setDialogOpen }: DecisionContext,
): DecisionActs {
  const { node, missionVersion } = item;
  const proposals =
    detail?.kind === "blocked" && detail.proposals.status === "ready" ? detail.proposals.data : [];
  const actions =
    detail?.kind === "paused" && detail.actions.status === "ready" ? detail.actions.data : null;
  const unblock = useNodeUnblock(node, missionVersion, proposals, reload);
  const approve = useProposalApprove(node, missionVersion, reload);
  const override = useNodeOverride(node, missionVersion, reload, actions);
  const cause = item.kind === "paused" ? (item.pause?.cause ?? null) : null;
  const resume = useNodeResume(node, missionVersion, item.nodes, actions, cause, reload);
  const remove = useDependencyRemove(node, missionVersion, reload);
  const discard = useNodeDiscard(node, missionVersion, reload, actions);
  const open =
    unblock.open ||
    approve.target !== null ||
    override.open ||
    resume.open ||
    remove.target !== null ||
    discard.open;

  useEffect(() => {
    if (!open) return undefined;
    setDialogOpen(node.id, true);
    return () => setDialogOpen(node.id, false);
  }, [node.id, open, setDialogOpen]);

  return {
    unblock,
    approve,
    override,
    resume,
    remove,
    discard,
    ...readStateOf(item, detail),
  };
}
