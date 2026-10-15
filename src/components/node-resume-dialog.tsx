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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { NodeResumeState } from "@/hooks/use-node-resume";
import type { ResumeTarget } from "@/lib/resume-target";

function isTarget(value: string | undefined): value is ResumeTarget {
  return value === "Available" || value === "Waiting";
}

export function NodeResumeDialog({ name, resume }: { name: string; resume: NodeResumeState }) {
  return (
    <AlertDialog open={resume.open} onOpenChange={(open) => !open && resume.cancel()}>
      <AlertDialogContent>
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
              <ToggleGroup
                variant="outline"
                size="sm"
                spacing={0}
                aria-labelledby="node-resume-target"
                value={[resume.target]}
                disabled={resume.resuming}
                onValueChange={(value: string[]) => {
                  const next = value[0];
                  if (isTarget(next)) resume.setTarget(next);
                }}
              >
                <ToggleGroupItem
                  value="Available"
                  className="aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  Available
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="Waiting"
                  className="aria-pressed:bg-primary aria-pressed:text-primary-foreground"
                >
                  Waiting
                </ToggleGroupItem>
              </ToggleGroup>
            ) : (
              <FieldDescription>Available. Waiting needs: {resume.waitingNeeds}.</FieldDescription>
            )}
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="node-resume-reason">Reason</FieldLabel>
          <Textarea
            id="node-resume-reason"
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
