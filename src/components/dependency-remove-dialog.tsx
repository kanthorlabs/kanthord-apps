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
import type { DependencyRemoveState } from "@/hooks/use-dependency-remove";

export function DependencyRemoveDialog({
  name,
  remove,
}: {
  name: string;
  remove: DependencyRemoveState;
}) {
  return (
    <AlertDialog open={remove.target !== null} onOpenChange={(open) => !open && remove.cancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Remove the dependency of {name} on {remove.target?.name}?
          </AlertDialogTitle>
          <AlertDialogDescription>{remove.consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">{remove.saferPath}</p>
        <Field>
          <FieldLabel htmlFor="dependency-remove-reason">Reason</FieldLabel>
          <Textarea
            id="dependency-remove-reason"
            value={remove.reason}
            required
            disabled={remove.removing}
            onChange={(event) => remove.setReason(event.target.value)}
          />
          <FieldDescription>Required. The edit records it.</FieldDescription>
        </Field>
        {remove.missing !== null && (
          <p className="text-sm text-muted-foreground">{remove.missing}</p>
        )}
        {remove.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {remove.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.removing}>Keep the dependency</AlertDialogCancel>
          <AlertDialogAction
            disabled={remove.removing || !remove.available || remove.missing !== null}
            onClick={remove.confirm}
          >
            Remove dependency
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
