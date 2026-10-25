import { useCallback, useEffect } from "react";

import type { EffectiveCause, MissionProposal, SchedulerExecutionRecord } from "@/api/types";
import { useNodeCheck, type NodeCheckState } from "@/hooks/use-node-check";
import { useNodeDiscard, type NodeDiscardState } from "@/hooks/use-node-discard";
import { useNodeOverride, type NodeOverrideState } from "@/hooks/use-node-override";
import { useNodeResume, type NodeResumeState } from "@/hooks/use-node-resume";
import { useNodeUnblock, type NodeUnblockState } from "@/hooks/use-node-unblock";
import { useProposalApprove, type ProposalApproveState } from "@/hooks/use-proposal-approve";
import { openProposalsOf, type AttentionDetail, type DecisionAttentionItem } from "@/lib/attention";
import {
  hasOpenAttempt,
  readFailureText,
  unresolvedRequestsOf,
  unresolvedRequestsText,
} from "@/lib/external-requests";

import { useDependencyRemove, type DependencyRemoveState } from "./use-dependency-remove";
import { useLastTraceCause } from "./use-last-trace-cause";

export interface DecisionActs {
  readonly unblock: NodeUnblockState;
  readonly approve: ProposalApproveState;
  readonly override: NodeOverrideState;
  readonly resume: NodeResumeState;
  readonly remove: DependencyRemoveState;
  readonly discard: NodeDiscardState;
  readonly check: NodeCheckState;
  readonly ready: boolean;
  readonly waiting: string | null;
  readonly failed: boolean;
  readonly proposals: readonly MissionProposal[];
  readonly unresolved: string | null;
  readonly lastTraceId: string | null;
  readonly lastTraceCause: EffectiveCause | null;
}

interface DecisionContext {
  readonly reload: () => void;
  readonly markActed: (itemId: string) => void;
  readonly setDialogOpen: (itemId: string, nodeId: string, open: boolean) => void;
}

interface ReadState {
  readonly ready: boolean;
  readonly waiting: string | null;
  readonly failed: boolean;
}

const NO_PROPOSALS: readonly MissionProposal[] = [];

const READY: ReadState = { ready: true, waiting: null, failed: false };

function newestExecutionOf(
  item: DecisionAttentionItem,
  detail: AttentionDetail | null,
): SchedulerExecutionRecord | null {
  if (item.kind !== "paused" || detail?.kind !== "paused") return null;
  if (detail.executions.status !== "ready") return null;
  const newest = detail.executions.data.reduce<SchedulerExecutionRecord | null>(
    (latest, execution) =>
      latest === null || execution.created_at > latest.created_at ? execution : latest,
    null,
  );
  return newest;
}

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
      waiting: readFailureText(attempt, failure.message, true),
      failed: true,
    };
  }
  return READY;
}

function openStateOf(attempt: number, detail: AttentionDetail | null): ReadState {
  if (detail?.kind !== "open") {
    return {
      ready: false,
      waiting: `Reading the external actions of attempt ${attempt}. The acts show after the read.`,
      failed: false,
    };
  }
  if (detail.actions.status === "failed") {
    return {
      ready: false,
      waiting: readFailureText(
        attempt,
        detail.actions.message,
        false,
        "Check now, Remove dependency and Discard wait for them.",
      ),
      failed: true,
    };
  }
  return READY;
}

function readStateOf(item: DecisionAttentionItem, detail: AttentionDetail | null): ReadState {
  if (item.kind === "paused") return pausedStateOf(item.node.attempt, detail);
  if (item.kind === "dependency_discarded" && hasOpenAttempt(item.node)) {
    return openStateOf(item.node.attempt, detail);
  }
  if (item.kind === "blocked" && item.node.intent === "examine") return proposalsStateOf(detail);
  return READY;
}

export function useDecisionActs(
  item: DecisionAttentionItem,
  detail: AttentionDetail | null,
  { reload, markActed, setDialogOpen }: DecisionContext,
): DecisionActs {
  const { node, missionVersion } = item;
  const proposalsRead =
    detail?.kind === "blocked" && detail.proposals.status === "ready" ? detail.proposals.data : [];
  const actionsRead = detail?.kind === "paused" || detail?.kind === "open" ? detail.actions : null;
  const actions = actionsRead?.status === "ready" ? actionsRead.data : null;
  const unresolved = actions === null ? [] : unresolvedRequestsOf(actions);
  const unblock = useNodeUnblock(node, missionVersion, proposalsRead, reload);
  const approve = useProposalApprove(node, missionVersion, reload);
  const override = useNodeOverride(node, missionVersion, actions, reload);
  const cause = item.kind === "paused" ? (item.pause?.cause ?? null) : null;
  const resume = useNodeResume(node, missionVersion, item.nodes, actions, cause, reload);
  const remove = useDependencyRemove(node, missionVersion, reload);
  const discard = useNodeDiscard(node, missionVersion, actions, reload);
  const itemId = item.id;
  const checkActed = useCallback(() => markActed(itemId), [markActed, itemId]);
  const check = useNodeCheck(node, missionVersion, actions, checkActed, reload);
  const newestExecution = newestExecutionOf(item, detail);
  const lastTraceCause = useLastTraceCause(newestExecution?.execution_id ?? null);
  const open =
    unblock.open ||
    approve.target !== null ||
    override.open ||
    resume.open ||
    remove.target !== null ||
    discard.open;

  useEffect(() => {
    if (!open) return undefined;
    setDialogOpen(itemId, node.id, true);
    return () => setDialogOpen(itemId, node.id, false);
  }, [itemId, node.id, open, setDialogOpen]);

  return {
    unblock,
    approve,
    override,
    resume,
    remove,
    discard,
    check,
    proposals: item.kind === "blocked" ? openProposalsOf(node, proposalsRead) : NO_PROPOSALS,
    unresolved:
      unresolved.length === 0
        ? null
        : unresolvedRequestsText(
            node.attempt,
            unresolved,
            item.kind === "paused",
            item.kind === "dependency_discarded" ? "Discard waits" : undefined,
          ),
    lastTraceId: newestExecution?.trace_id ?? null,
    lastTraceCause,
    ...readStateOf(item, detail),
  };
}
