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
import type { RevisionRevokeState } from "../use-revision-revoke";

export function RevokeDialog({ revoke }: { revoke: RevisionRevokeState }) {
  const revision = revoke.target?.revision;

  return (
    <AlertDialog open={revoke.target !== null} onOpenChange={(open) => !open && revoke.cancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke revision {revision}?</AlertDialogTitle>
          <AlertDialogDescription>{revoke.consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">{revoke.saferPath}</p>
        {revoke.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {revoke.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={revoke.revoking}>Keep revision {revision}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={revoke.revoking}
            onClick={revoke.confirm}
          >
            Revoke revision {revision}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
