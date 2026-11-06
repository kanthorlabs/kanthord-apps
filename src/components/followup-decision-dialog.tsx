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
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { FollowupDecisionState } from "@/hooks/use-followup-decision";
import { externalLinkOf } from "@/lib/external-link";
import { utcDateTime } from "@/lib/format";

export function FollowupDecisionDialog({
  name,
  decision,
}: {
  name: string;
  decision: FollowupDecisionState;
}) {
  const requirementRef = useRef<HTMLTextAreaElement>(null);
  const updates = decision.updates.data ?? [];

  return (
    <AlertDialog open={decision.open} onOpenChange={(open) => !open && decision.cancel()}>
      <AlertDialogContent initialFocus={requirementRef} className="max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Decide the follow-up proposal of {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Create follow-up node adds a node for the proposal. Reject closes the proposal. The
            finished node keeps its state. A decision cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul aria-label="Open follow-up proposals" className="flex flex-col gap-2">
          {decision.proposals.map((proposal) => (
            <li key={proposal.id} className="flex flex-col gap-0.5 text-sm break-words">
              <span className="font-medium">{proposal.content.name}</span>
              <span>Requirement: {proposal.content.requirement}</span>
              <span>Criterion: {proposal.content.criterion}</span>
            </li>
          ))}
        </ul>
        <section aria-label="Newest link updates" className="flex flex-col gap-1">
          <h4 className="text-sm font-medium">Newest link updates</h4>
          {decision.updates.error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {decision.updates.error.message}
            </p>
          )}
          {decision.updates.data !== null && updates.length === 0 && (
            <p className="text-sm text-muted-foreground">No update yet.</p>
          )}
          {updates.length > 0 && (
            <ul className="flex flex-col gap-1">
              {updates.map((update) => (
                <li key={update.id} className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="break-words">{externalLinkOf(update.external_link).text}</span>
                  <span className="text-muted-foreground">
                    {update.actor_id}, {utcDateTime(update.occurred_at)}
                  </span>
                  {update.new && <Badge variant="secondary">New</Badge>}
                </li>
              ))}
            </ul>
          )}
        </section>
        <Field>
          <FieldLabel htmlFor="followup-decision-requirement">Requirement</FieldLabel>
          <Textarea
            id="followup-decision-requirement"
            ref={requirementRef}
            value={decision.requirement}
            disabled={decision.deciding}
            onChange={(event) => decision.setRequirement(event.target.value)}
          />
          <FieldDescription>
            Optional. Create follow-up node uses it in place of the requirement of the proposal.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="followup-decision-criterion">Criterion</FieldLabel>
          <Textarea
            id="followup-decision-criterion"
            value={decision.criterion}
            disabled={decision.deciding}
            onChange={(event) => decision.setCriterion(event.target.value)}
          />
          <FieldDescription>
            Optional. Create follow-up node uses it in place of the criterion of the proposal.
          </FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="followup-decision-reason">Reason</FieldLabel>
          <Textarea
            id="followup-decision-reason"
            value={decision.reason}
            disabled={decision.deciding}
            onChange={(event) => decision.setReason(event.target.value)}
          />
          <FieldDescription>Optional. The record of the decision holds it.</FieldDescription>
        </Field>
        {decision.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {decision.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={decision.deciding}>Keep the proposal</AlertDialogCancel>
          <AlertDialogAction
            variant="outline"
            disabled={decision.deciding}
            onClick={decision.reject}
          >
            Reject
          </AlertDialogAction>
          <AlertDialogAction disabled={decision.deciding} onClick={decision.approve}>
            Create follow-up node
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
