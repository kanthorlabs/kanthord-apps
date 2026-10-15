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
import type { NodeOverrideState } from "@/hooks/use-node-override";

export function NodeOverrideDialog({
  name,
  override,
}: {
  name: string;
  override: NodeOverrideState;
}) {
  return (
    <AlertDialog open={override.open} onOpenChange={(open) => !open && override.cancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Override {name}?</AlertDialogTitle>
          <AlertDialogDescription>{override.consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">{override.saferPath}</p>
        <Field>
          <FieldLabel htmlFor="node-override-reason">Reason</FieldLabel>
          <Textarea
            id="node-override-reason"
            value={override.reason}
            required
            disabled={override.overriding}
            onChange={(event) => override.setReason(event.target.value)}
          />
          <FieldDescription>Required. The outcome records it.</FieldDescription>
        </Field>
        {override.missing !== null && (
          <p className="text-sm text-muted-foreground">{override.missing}</p>
        )}
        {override.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {override.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={override.overriding}>Keep the node</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={override.overriding || !override.available || override.missing !== null}
            onClick={override.confirm}
          >
            Override node
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
