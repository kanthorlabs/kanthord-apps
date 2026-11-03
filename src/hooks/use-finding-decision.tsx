import { useCallback, useState } from "react";
import { toast } from "sonner";

import { decideFinding } from "@/api/resources/mission";
import type { MissionFinding, MissionFindingDecision } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { waitsForHuman } from "@/lib/review-findings";

export interface FindingDecisionState {
  readonly open: boolean;
  readonly finding: MissionFinding | null;
  readonly decision: MissionFindingDecision;
  readonly reason: string;
  readonly reasonMissing: boolean;
  readonly error: string | null;
  readonly deciding: boolean;
  readonly request: (finding: MissionFinding, decision: MissionFindingDecision) => void;
  readonly setReason: (reason: string) => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

const REFUSAL_MESSAGES: Readonly<Record<string, string>> = {
  "mission.finding.decided": "Another decision of this finding came first. The view now shows it.",
  "mission.finding.not_reported":
    "The finding no longer waits for a human decision. The view now shows its current route.",
  "mission.record.not_found":
    "The finding no longer exists. The view now shows the current findings.",
};

const DECISION_VERB: Readonly<Record<MissionFindingDecision, string>> = {
  accepted: "Accepted",
  dismissed: "Dismissed",
};

const DECIDING_VERB: Readonly<Record<MissionFindingDecision, string>> = {
  accepted: "Accepting",
  dismissed: "Dismissing",
};

export function useFindingDecision(reload: () => void): FindingDecisionState {
  const [open, setOpen] = useState(false);
  const [finding, setFinding] = useState<MissionFinding | null>(null);
  const [decision, setDecision] = useState<MissionFindingDecision>("accepted");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const reasonMissing = reason.trim().length === 0;

  const request = useCallback((target: MissionFinding, next: MissionFindingDecision) => {
    if (!waitsForHuman(target)) return;
    setFinding(target);
    setDecision(next);
    setReason("");
    setError(null);
    setOpen(true);
  }, []);

  const cancel = useCallback(() => {
    if (deciding) return;
    setOpen(false);
    setError(null);
  }, [deciding]);

  const confirm = useCallback(() => {
    if (deciding || !open || finding === null || reasonMissing) return;
    setDeciding(true);
    setError(null);
    decideFinding(finding.id, { decision, decision_reason: reason.trim() }).then(
      (decided) => {
        setDeciding(false);
        toast.success(`${DECISION_VERB[decision]} the finding ${decided.label}.`);
        setOpen(false);
        reload();
      },
      (cause: unknown) => {
        setDeciding(false);
        const failure = asApiError(cause);
        const message = REFUSAL_MESSAGES[failure.detail] ?? failure.message;
        setError(message);
        toast.error(`${DECIDING_VERB[decision]} the finding ${finding.label} failed.`, {
          description: message,
        });
        reload();
      },
    );
  }, [deciding, open, finding, reasonMissing, decision, reason, reload]);

  return {
    open,
    finding,
    decision,
    reason,
    reasonMissing,
    error,
    deciding,
    request,
    setReason,
    cancel,
    confirm,
  };
}
