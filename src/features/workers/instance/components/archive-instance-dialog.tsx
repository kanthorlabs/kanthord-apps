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
import type { InstanceArchiveState } from "../use-instance-archive";

export function ArchiveInstanceDialog({
  name,
  archive,
  projectNameOf,
}: {
  name: string;
  archive: InstanceArchiveState;
  projectNameOf: (projectId: string) => string;
}) {
  const refusal = archive.refusal;
  return (
    <AlertDialog open={archive.open} onOpenChange={(open) => !open && archive.cancel()}>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The live revision of <RecordName>{name}</RecordName> ends for good. Its registrations
            end, and its credential copies are archived. The name stays taken.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">
          Keep <RecordName>{name}</RecordName> and use Reset key instead when only the key leaked.
        </p>
        {archive.error !== null && (
          <div role="alert" className="flex flex-col gap-1 text-sm text-destructive">
            <p>{archive.error}</p>
            {refusal !== null &&
              refusal.bindings.map((binding) => (
                <p key={`${binding.project_id}/${binding.binding}`} className="break-words">
                  Binding {binding.binding} of {projectNameOf(binding.project_id)}
                </p>
              ))}
            {refusal !== null &&
              refusal.executions.map((execution) => (
                <p key={execution} className="font-mono break-all">
                  Execution {execution}
                </p>
              ))}
          </div>
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
