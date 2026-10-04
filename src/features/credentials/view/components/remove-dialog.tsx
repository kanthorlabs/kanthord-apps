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
import type { CredentialRemoveState } from "../use-credential-remove";

export function RemoveDialog({ name, remove }: { name: string; remove: CredentialRemoveState }) {
  return (
    <AlertDialog open={remove.open} onOpenChange={(open) => !open && remove.cancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {name}?</AlertDialogTitle>
          <AlertDialogDescription>{remove.consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">{remove.saferPath}</p>
        {remove.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {remove.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={remove.removing}>Keep {name}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.removing}
            onClick={remove.confirm}
          >
            Remove {name}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
