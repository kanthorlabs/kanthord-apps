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
import type { NodeDiscardState } from "../use-node-discard";

export function NodeDiscardDialog({ name, discard }: { name: string; discard: NodeDiscardState }) {
  return (
    <AlertDialog open={discard.open} onOpenChange={(open) => !open && discard.cancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard {name}?</AlertDialogTitle>
          <AlertDialogDescription>{discard.consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">{discard.saferPath}</p>
        <Field>
          <FieldLabel htmlFor="node-discard-reason">Reason</FieldLabel>
          <Textarea
            id="node-discard-reason"
            value={discard.reason}
            required
            disabled={discard.discarding}
            onChange={(event) => discard.setReason(event.target.value)}
          />
          <FieldDescription>Required. The outcome records it.</FieldDescription>
        </Field>
        {discard.missing !== null && (
          <p className="text-sm text-muted-foreground">{discard.missing}</p>
        )}
        {discard.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {discard.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={discard.discarding}>Keep the node</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={discard.discarding || !discard.available || discard.missing !== null}
            onClick={discard.confirm}
          >
            Discard node
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
