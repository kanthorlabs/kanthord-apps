import { useEffect } from "react";

import { type FindingReportState, useFindingReport } from "@/hooks/use-finding-report";
import { type FindingDecisionState, useFindingDecision } from "@/hooks/use-finding-decision";
import type { FindingReviewItem } from "@/lib/attention";
import { type ActedAct, DONE_ACT } from "@/lib/board-done";

import { useCancelMark } from "./use-cancel-mark";

export interface FindingReviewActs {
  readonly decision: FindingDecisionState;
  readonly report: FindingReportState;
}

interface FindingReviewContext {
  readonly reload: () => void;
  readonly setDialogOpen: (itemId: string, nodeId: string, open: boolean, act?: ActedAct) => void;
  readonly registerDialogCloser: (close: (() => void) | null) => void;
}

const DECIDE_FINDING: ActedAct = { id: DONE_ACT.DecideFinding };

export function useFindingReviewActs(
  item: FindingReviewItem,
  { reload, setDialogOpen, registerDialogCloser }: FindingReviewContext,
): FindingReviewActs {
  const mark = useCancelMark();
  const decision = mark.track(useFindingDecision(reload));
  const report = useFindingReport(item.node.id, item.missionVersion, reload);
  const itemId = item.id;
  const nodeId = item.node.id;
  const open = decision.open || report.open;
  const deciding = decision.open;
  const { reset, take } = mark;

  useEffect(() => {
    if (!open) return undefined;
    reset();
    setDialogOpen(itemId, nodeId, true);
    return () => {
      const cancelled = take();
      setDialogOpen(itemId, nodeId, false, deciding && !cancelled ? DECIDE_FINDING : undefined);
    };
  }, [itemId, nodeId, open, deciding, setDialogOpen, reset, take]);

  useEffect(() => {
    registerDialogCloser(() => {
      if (decision.open) decision.cancel();
      if (report.open) report.cancel();
    });
    return () => registerDialogCloser(null);
  });

  return { decision, report };
}
