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
import type { CredentialArchiveState } from "../use-credential-archive";

export function ArchiveDialog({
  name,
  archive,
}: {
  name: string;
  archive: CredentialArchiveState;
}) {
  return (
    <AlertDialog open={archive.open} onOpenChange={(open) => !open && archive.cancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {name}?</AlertDialogTitle>
          <AlertDialogDescription>{archive.consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">{archive.saferPath}</p>
        {archive.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {archive.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={archive.archiving}>Keep {name}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={archive.archiving}
            onClick={archive.confirm}
          >
            Archive {name}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
