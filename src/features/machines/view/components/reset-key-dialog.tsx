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
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import type { WorkerMachineDetail, WorkerMachineInstance } from "@/api/types";
import {
  CopySteps,
  InstanceConfiguration,
} from "@/features/workers/components/instance-configuration";
import { MachineHostFields } from "../../components/machine-host-fields";
import type { MachineResetState } from "../use-machine-reset";
import { InstanceNames } from "./instance-names";

const RECOVERY =
  "Each instance of this machine then fails to open the machine credentials. Deliver the new configuration with the machine copy block of the host kind. Then sign in again for each machine credential, and rotate each API key at its provider.";

export function ResetKeyDialog({
  machine,
  instances,
  reset,
}: {
  machine: WorkerMachineDetail;
  instances: readonly WorkerMachineInstance[];
  reset: MachineResetState;
}) {
  const result = reset.result;
  return (
    <AlertDialog open={reset.open} onOpenChange={(open) => !open && reset.cancel()}>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {result === null ? `Reset the key of ${machine.name}?` : `New key of ${machine.name}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {result === null ? (
              <>
                The server generates a new key pair for <RecordName>{machine.name}</RecordName> and
                ends revision {machine.revision}.
              </>
            ) : (
              <>
                Revision {result.revision} of <RecordName>{result.name}</RecordName> is live.
                Replace the old configuration on the computer.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {result === null ? (
          <div className="flex min-w-0 flex-col gap-4">
            {instances.length === 0 ? (
              <p className="text-sm">No live instance names this machine.</p>
            ) : (
              <InstanceNames label="Instances of the machine" instances={instances} />
            )}
            <p className="text-sm">{RECOVERY}</p>
            <FieldGroup>
              <MachineHostFields host={reset.host} error={reset.error ?? undefined} />
            </FieldGroup>
            {reset.host.kind !== null && (
              <CopySteps
                target={{ subject: "machine", name: machine.name, stage: "reset" }}
                kind={reset.host.kind}
                runtime={reset.host.runtime}
                version={reset.host.version}
              />
            )}
            {reset.failure !== null && (
              <p role="alert" className="text-sm text-destructive">
                {reset.failure}
              </p>
            )}
          </div>
        ) : (
          <InstanceConfiguration
            target={{ subject: "machine", name: result.name, stage: "reset" }}
            kind={result.kind}
            runtime={result.runtime}
            version={reset.host.version}
            versionError={reset.host.versionError}
            configuration={result.configuration}
          />
        )}
        <AlertDialogFooter>
          {result === null ? (
            <>
              <AlertDialogCancel disabled={reset.resetting}>Keep the key</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={reset.resetting || reset.host.kind === null}
                onClick={reset.confirm}
              >
                Reset key
              </AlertDialogAction>
            </>
          ) : (
            <Button onClick={reset.done}>Done</Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
