import { useEffect } from "react";

import type { SchedulerExecutionRecord } from "@/api/types";
import { type FollowupDecisionState, useFollowupDecision } from "@/hooks/use-followup-decision";
import type { AttentionDetail, FollowupItem } from "@/lib/attention";
import { type ActedAct, DONE_ACT } from "@/lib/board-done";

export interface FollowupActs {
  readonly decision: FollowupDecisionState;
  readonly lastTraceId: string | null;
}

interface FollowupContext {
  readonly reload: () => void;
  readonly setDialogOpen: (itemId: string, nodeId: string, open: boolean, act?: ActedAct) => void;
  readonly registerDialogCloser: (close: (() => void) | null) => void;
}

const DECIDE_FOLLOWUP: ActedAct = { id: DONE_ACT.Decide };

function lastTraceIdOf(detail: AttentionDetail | null): string | null {
  if (detail?.kind !== "followup" || detail.executions.status !== "ready") return null;
  const newest = detail.executions.data.reduce<SchedulerExecutionRecord | null>(
    (latest, execution) =>
      latest === null || execution.created_at > latest.created_at ? execution : latest,
    null,
  );
  return newest?.trace_id ?? null;
}

export function useFollowupActs(
  item: FollowupItem,
  detail: AttentionDetail | null,
  { reload, setDialogOpen, registerDialogCloser }: FollowupContext,
): FollowupActs {
  const decision = useFollowupDecision(item.node, item.proposals, item.missionVersion, reload);
  const itemId = item.id;
  const nodeId = item.node.id;
  const { open } = decision;

  useEffect(() => {
    if (!open) return undefined;
    setDialogOpen(itemId, nodeId, true);
    return () => setDialogOpen(itemId, nodeId, false, DECIDE_FOLLOWUP);
  }, [itemId, nodeId, open, setDialogOpen]);

  useEffect(() => {
    registerDialogCloser(() => {
      if (decision.open) decision.cancel();
    });
    return () => registerDialogCloser(null);
  });

  return { decision, lastTraceId: lastTraceIdOf(detail) };
}
