import { RecordName } from "@/components/record-name";
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
import type { MachineArchiveState } from "../use-machine-archive";

export function ArchiveMachineDialog({
  name,
  archive,
}: {
  name: string;
  archive: MachineArchiveState;
}) {
  return (
    <AlertDialog open={archive.open} onOpenChange={(open) => !open && archive.cancel()}>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The live revision of <RecordName>{name}</RecordName> ends for good. The name stays
            taken. No new instance can name it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">
          Keep <RecordName>{name}</RecordName> and use Reset key instead when only the key leaked.
        </p>
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
