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
import type { WorkerInstanceDetail } from "@/api/types";
import { HostFields } from "../../components/host-fields";
import { InstanceConfiguration } from "../../components/instance-configuration";
import type { InstanceResetState } from "../use-instance-reset";

function BlastRadius({
  instance,
  projectNameOf,
}: {
  instance: WorkerInstanceDetail;
  projectNameOf: (projectId: string) => string;
}) {
  const executions = instance.registrations.flatMap((registration) =>
    registration.execution_id === undefined ? [] : [registration.execution_id],
  );
  const rows = [
    {
      label: "Bindings",
      value:
        instance.bindings.length === 0
          ? "none"
          : instance.bindings
              .map((binding) => `${binding.binding} of ${projectNameOf(binding.project_id)}`)
              .join(", "),
    },
    {
      label: "Connection",
      value:
        instance.connection === null
          ? "none"
          : `${instance.connection.connection_name}, which stops at its next request`,
    },
    { label: "Live registrations", value: String(instance.registrations.length) },
    { label: "Live executions", value: executions.length === 0 ? "none" : executions.join(", ") },
    {
      label: "Credential copies",
      value:
        instance.credentials.length === 0
          ? "none"
          : instance.credentials.map((copy) => copy.name).join(", "),
    },
  ];
  return (
    <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="min-w-0 break-words">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ResetKeyDialog({
  instance,
  reset,
  projectNameOf,
}: {
  instance: WorkerInstanceDetail;
  reset: InstanceResetState;
  projectNameOf: (projectId: string) => string;
}) {
  const result = reset.result;
  return (
    <AlertDialog open={reset.open} onOpenChange={(open) => !open && reset.cancel()}>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {result === null ? `Reset the key of ${instance.name}?` : `New key of ${instance.name}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {result === null ? (
              <>
                The server generates a new key pair for <RecordName>{instance.name}</RecordName> and
                ends revision {instance.revision}. Every token, connection and registration of the
                old revision ends. The bindings keep the instance.
              </>
            ) : (
              <>
                Revision {result.revision} of <RecordName>{result.name}</RecordName> is live.
                Replace the old configuration on the instance host.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {result === null ? (
          <div className="flex min-w-0 flex-col gap-4">
            <BlastRadius instance={instance} projectNameOf={projectNameOf} />
            <p className="text-sm">
              Rotate each listed credential with a new secret, and rotate the key at the provider.
              The old configuration still opens these credentials.
            </p>
            <FieldGroup>
              <HostFields host={reset.host} errors={reset.errors} />
            </FieldGroup>
            {reset.failure !== null && (
              <p role="alert" className="text-sm text-destructive">
                {reset.failure}
              </p>
            )}
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm">
              On a host with the instance file, run <code>kanthord worker join --force</code> with
              the new value. On a container, replace the value of KANTHORD_WORKER_CONFIG.
            </p>
            <InstanceConfiguration
              name={result.name}
              kind={result.kind}
              runtime={result.runtime}
              version={reset.host.version}
              versionError={reset.host.versionError}
              configuration={result.configuration}
            />
          </div>
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
