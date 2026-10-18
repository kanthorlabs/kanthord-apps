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
import type { NodePauseState } from "@/hooks/use-node-pause";

export function NodePauseDialog({ name, pause }: { name: string; pause: NodePauseState }) {
  return (
    <AlertDialog open={pause.open} onOpenChange={(open) => !open && pause.cancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pause {name}?</AlertDialogTitle>
          <AlertDialogDescription>{pause.consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">{pause.saferPath}</p>
        <Field>
          <FieldLabel htmlFor="node-pause-reason">Reason</FieldLabel>
          <Textarea
            id="node-pause-reason"
            value={pause.reason}
            required
            disabled={pause.pausing}
            onChange={(event) => pause.setReason(event.target.value)}
          />
          <FieldDescription>Required. The control records it.</FieldDescription>
        </Field>
        {pause.missing !== null && <p className="text-sm text-muted-foreground">{pause.missing}</p>}
        {pause.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {pause.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pause.pausing}>Keep the node</AlertDialogCancel>
          <AlertDialogAction
            disabled={pause.pausing || !pause.available || pause.missing !== null}
            onClick={pause.confirm}
          >
            Pause node
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
