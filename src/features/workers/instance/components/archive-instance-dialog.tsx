import { Link } from "react-router-dom";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import type { InstanceArchiveState } from "../use-instance-archive";

function ListingBindings({
  archive,
  projectNameOf,
}: {
  archive: InstanceArchiveState;
  projectNameOf: (projectId: string) => string;
}) {
  if (archive.listing.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 text-sm">
      <ul aria-label="Listing bindings" className="flex flex-col gap-1">
        {archive.listing.map((binding) => (
          <li key={`${binding.project_id}/${binding.binding}`} className="break-words">
            <Link
              to={`/projects/${encodeURIComponent(binding.project_id)}?tab=bindings`}
              className="underline underline-offset-4"
            >
              {binding.binding}
            </Link>{" "}
            of {projectNameOf(binding.project_id)}
          </li>
        ))}
      </ul>
      <p>Remove the instance from these bindings first.</p>
    </div>
  );
}

function StopExecution({ archive }: { archive: InstanceArchiveState }) {
  if (archive.listing.length > 0 || archive.executions.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 text-sm">
      {archive.executions.map((execution) => (
        <p key={execution} className="font-mono break-all">
          Execution {execution}
        </p>
      ))}
      <Field orientation="horizontal">
        <Checkbox
          id="archive-stop-execution"
          checked={archive.stop}
          onCheckedChange={archive.setStop}
        />
        <FieldLabel htmlFor="archive-stop-execution">Stop the live execution</FieldLabel>
      </Field>
      <p className="text-muted-foreground">
        The node returns to Available or Waiting. It records no failure.
      </p>
    </div>
  );
}

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
        {archive.resettable && (
          <p className="text-sm text-muted-foreground">
            Keep <RecordName>{name}</RecordName> and use Reset key instead when only the key leaked.
          </p>
        )}
        <ListingBindings archive={archive} projectNameOf={projectNameOf} />
        <StopExecution archive={archive} />
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
            disabled={archive.archiving || !archive.confirmable}
            onClick={archive.confirm}
          >
            Archive {name}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
