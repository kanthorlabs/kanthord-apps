import { useEffect } from "react";

import {
  type FindingReportState,
  useFindingReport,
} from "@/features/projects/view/use-finding-report";
import { type FindingDecisionState, useFindingDecision } from "@/hooks/use-finding-decision";
import type { FindingReviewItem } from "@/lib/attention";
import { type ActedAct, DONE_ACT } from "@/lib/board-done";

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
  const decision = useFindingDecision(reload);
  const report = useFindingReport(item.node.id, item.missionVersion, reload);
  const itemId = item.id;
  const nodeId = item.node.id;
  const open = decision.open || report.open;
  const deciding = decision.open;

  useEffect(() => {
    if (!open) return undefined;
    setDialogOpen(itemId, nodeId, true);
    return () => setDialogOpen(itemId, nodeId, false, deciding ? DECIDE_FINDING : undefined);
  }, [itemId, nodeId, open, deciding, setDialogOpen]);

  useEffect(() => {
    registerDialogCloser(() => {
      if (decision.open) decision.cancel();
      if (report.open) report.cancel();
    });
    return () => registerDialogCloser(null);
  });

  return { decision, report };
}
