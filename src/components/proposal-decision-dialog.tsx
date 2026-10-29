import { useRef } from "react";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { ProposalDecisionState } from "@/hooks/use-proposal-decision";

export function ProposalDecisionDialog({
  name,
  decision,
}: {
  name: string;
  decision: ProposalDecisionState;
}) {
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const nothingChecked = decision.checked.length === 0;

  return (
    <AlertDialog open={decision.open} onOpenChange={(open) => !open && decision.cancel()}>
      <AlertDialogContent initialFocus={reasonRef} className="max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Decide the proposals of {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Checked proposals become fix nodes. Unchecked proposals become rejected. A decision
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul aria-label="Open proposals" className="flex flex-col gap-2">
          {decision.openProposals.map((proposal) => {
            const id = `proposal-decision-${proposal.id}`;
            return (
              <li key={proposal.id}>
                <Field orientation="horizontal">
                  <Checkbox
                    id={id}
                    checked={decision.checked.includes(proposal.id)}
                    disabled={decision.deciding}
                    onCheckedChange={() => decision.toggle(proposal.id)}
                  />
                  <FieldLabel htmlFor={id} className="break-words">
                    {proposal.content.name}
                  </FieldLabel>
                </Field>
              </li>
            );
          })}
        </ul>
        {nothingChecked && (
          <p className="text-sm text-muted-foreground">
            Check one proposal or more. To reject every proposal, use Unblock or Discard.
          </p>
        )}
        <Field>
          <FieldLabel htmlFor="proposal-decision-reason">Reason</FieldLabel>
          <Textarea
            id="proposal-decision-reason"
            ref={reasonRef}
            value={decision.reason}
            disabled={decision.deciding}
            onChange={(event) => decision.setReason(event.target.value)}
          />
          <FieldDescription>Optional. The new revisions record it.</FieldDescription>
        </Field>
        {decision.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {decision.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={decision.deciding}>Keep the proposals</AlertDialogCancel>
          <AlertDialogAction
            disabled={decision.deciding || nothingChecked}
            onClick={decision.confirm}
          >
            Decide
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
