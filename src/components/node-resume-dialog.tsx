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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import type { NodeResumeState } from "@/hooks/use-node-resume";
import type { ResumeTarget } from "@/lib/resume-target";

function isTarget(value: unknown): value is ResumeTarget {
  return value === "Available" || value === "Waiting";
}

export function NodeResumeDialog({ name, resume }: { name: string; resume: NodeResumeState }) {
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  return (
    <AlertDialog open={resume.open} onOpenChange={(open) => !open && resume.cancel()}>
      <AlertDialogContent initialFocus={reasonRef}>
        <AlertDialogHeader>
          <AlertDialogTitle>Resume {name}?</AlertDialogTitle>
          <AlertDialogDescription>{resume.consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        {resume.notes.map((note, index) => (
          <p key={index} className="text-sm">
            {note}
          </p>
        ))}
        <p className="text-sm text-muted-foreground">{resume.saferPath}</p>
        {resume.choice && (
          <Field>
            <FieldLabel id="node-resume-target">Resume to</FieldLabel>
            {resume.waitingNeeds === null ? (
              <RadioGroup
                aria-labelledby="node-resume-target"
                value={resume.target}
                disabled={resume.resuming}
                onValueChange={(value) => {
                  if (isTarget(value)) resume.setTarget(value);
                }}
              >
                <Field orientation="horizontal">
                  <RadioGroupItem id="node-resume-target-available" value="Available" />
                  <FieldLabel htmlFor="node-resume-target-available">Available</FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <RadioGroupItem id="node-resume-target-waiting" value="Waiting" />
                  <FieldLabel htmlFor="node-resume-target-waiting">Waiting</FieldLabel>
                </Field>
              </RadioGroup>
            ) : (
              <FieldDescription>Available. Waiting needs: {resume.waitingNeeds}.</FieldDescription>
            )}
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="node-resume-reason">Reason</FieldLabel>
          <Textarea
            id="node-resume-reason"
            ref={reasonRef}
            value={resume.reason}
            required
            disabled={resume.resuming}
            onChange={(event) => resume.setReason(event.target.value)}
          />
          <FieldDescription>Required. The control records it.</FieldDescription>
        </Field>
        {resume.missing !== null && (
          <p className="text-sm text-muted-foreground">{resume.missing}</p>
        )}
        {resume.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {resume.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={resume.resuming}>Keep it paused</AlertDialogCancel>
          <AlertDialogAction
            disabled={resume.resuming || !resume.available || resume.missing !== null}
            onClick={resume.confirm}
          >
            Resume node
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
