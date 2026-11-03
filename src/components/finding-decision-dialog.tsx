import { useRef } from "react";

import { RecordName } from "@/components/record-name";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { FindingDecisionState } from "@/hooks/use-finding-decision";
import { decisionMeaning } from "@/lib/review-findings";

const ACTION_LABEL = { accepted: "Accept", dismissed: "Dismiss" } as const;

export function FindingDecisionDialog({ decision }: { decision: FindingDecisionState }) {
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const action = ACTION_LABEL[decision.decision];
  const label = decision.finding === null ? "" : decision.finding.label;
  const name = decision.finding === null ? "" : decision.finding.name;

  return (
    <AlertDialog open={decision.open} onOpenChange={(open) => !open && decision.cancel()}>
      <AlertDialogContent initialFocus={reasonRef} className="max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle className="break-words">
            {action} the finding {label}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            <RecordName>{name}</RecordName>: {decisionMeaning(decision.decision)} Neither decision
            changes the node. A decision cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Field>
          <FieldLabel htmlFor="finding-decision-reason">Reason</FieldLabel>
          <Textarea
            id="finding-decision-reason"
            ref={reasonRef}
            value={decision.reason}
            disabled={decision.deciding}
            onChange={(event) => decision.setReason(event.target.value)}
          />
          <FieldDescription>Required. The finding records it with the decision.</FieldDescription>
        </Field>
        {decision.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {decision.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={decision.deciding}>Keep it undecided</AlertDialogCancel>
          <AlertDialogAction
            disabled={decision.deciding || decision.reasonMissing}
            onClick={decision.confirm}
          >
            {action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
