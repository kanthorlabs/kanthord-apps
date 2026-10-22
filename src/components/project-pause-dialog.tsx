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
import type { ProjectPause } from "@/hooks/use-project-pause";

export function ProjectPauseDialog({ name, pause }: { name: string; pause: ProjectPause }) {
  return (
    <AlertDialog open={pause.confirming} onOpenChange={(open) => !open && pause.cancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Pause {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            No worker claims a node of <RecordName>{name}</RecordName> until a resume. Each running
            execution continues to its end. The pause changes no node state, no job, no binding and
            no registration.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">
          To keep the project active, cancel. Workers keep claiming its nodes.
        </p>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pause.busy}>Keep the project active</AlertDialogCancel>
          <AlertDialogAction disabled={pause.busy} onClick={pause.confirm}>
            Pause project
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
