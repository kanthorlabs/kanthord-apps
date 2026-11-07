import { ArchiveIcon, KeyRoundIcon, PlusIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import type { WorkerMachineDetail, WorkerMachineInstance } from "@/api/types";
import { DataListItem } from "@/components/data-list-item";
import { DisabledAction } from "@/components/disabled-action";
import { RecordName } from "@/components/record-name";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyModelsSheet } from "@/features/workers/instance/components/copy-models-sheet";
import { CredentialAddSheet } from "@/features/workers/instance/components/credential-add-sheet";
import { CredentialRotateSheet } from "@/features/workers/instance/components/credential-rotate-sheet";
import { CredentialRows } from "@/features/workers/instance/components/credential-rows";
import { SignInAgainSheet } from "@/features/workers/instance/components/sign-in-again-sheet";
import { useInstanceCopyModels } from "@/features/workers/instance/use-instance-copy-models";
import { useInstanceCredentialAdd } from "@/features/workers/instance/use-instance-credential-add";
import { useInstanceCredentialRotate } from "@/features/workers/instance/use-instance-credential-rotate";
import { useInstanceSignIn } from "@/features/workers/instance/use-instance-sign-in";
import { utcDateTime } from "@/lib/format";
import { shortFingerprint } from "@/lib/instance-host";
import type { CopyHolder } from "@/lib/instance-credential-draft";
import { instancePagePath } from "@/lib/worker-paths";
import { ArchiveMachineDialog } from "./components/archive-machine-dialog";
import { InstanceNames } from "./components/instance-names";
import { MachineReachNotice } from "./components/machine-reach-notice";
import { ResetKeyDialog } from "./components/reset-key-dialog";
import { type MachinePage, useMachinePage } from "./use-machine-page";
import { useMachineArchive } from "./use-machine-archive";
import { useMachineReset } from "./use-machine-reset";

function MachineHeader({ machine }: { machine: WorkerMachineDetail }) {
  return (
    <section aria-label="Machine" className="flex flex-col gap-2 border-b pb-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="min-w-0 font-mono text-lg font-semibold break-all">{machine.name}</h2>
        <span className="text-muted-foreground tabular-nums">(v{machine.revision})</span>
        {machine.ended_at !== null && <Badge variant="secondary">Archived</Badge>}
      </div>
      <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-muted-foreground">Fingerprint</dt>
        <dd className="min-w-0 font-mono break-all">{shortFingerprint(machine.fingerprint)}</dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd>{utcDateTime(machine.created_at)}</dd>
        {machine.ended_at !== null && (
          <>
            <dt className="text-muted-foreground">Archived</dt>
            <dd>{utcDateTime(machine.ended_at)}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

function InstanceRows({ instances }: { instances: readonly WorkerMachineInstance[] }) {
  if (instances.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No instance names this machine.</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ItemGroup aria-label="Instances" className="gap-2">
      {instances.map((instance) => (
        <DataListItem
          key={instance.name}
          title={<span className="font-mono break-all">{instance.name}</span>}
          status={
            instance.ended_at === null ? undefined : <Badge variant="secondary">Archived</Badge>
          }
          fields={[
            { label: "Worker", value: <span className="break-all">{instance.worker}</span> },
            {
              label: "Connection",
              value:
                instance.connection === null ? (
                  "Not connected"
                ) : (
                  <span className="break-all">
                    Connected · {instance.connection.connection_name}
                  </span>
                ),
            },
          ]}
          actions={
            <Button
              nativeButton={false}
              render={<Link to={instancePagePath(instance.worker, instance.name)} />}
              variant="outline"
              size="sm"
              aria-label={`Open ${instance.name}`}
            >
              Open
            </Button>
          }
        />
      ))}
    </ItemGroup>
  );
}

function ContextFailure({ page }: { page: MachinePage }) {
  if (page.contextError === null) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>
        The projects of the instances or the credential platforms were not read.
      </AlertTitle>
      <AlertDescription>
        <span>{page.contextError}</span>
        <Button type="button" size="sm" variant="outline" onClick={page.retryContext}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function MachineDetail({ machine, page }: { machine: WorkerMachineDetail; page: MachinePage }) {
  const reload = page.machine.reload;
  const archived = machine.ended_at !== null;
  const live = page.liveInstances;
  const reset = useMachineReset(machine, reload);
  const archive = useMachineArchive(machine, reload);
  const holder: CopyHolder = { name: machine.name, kind: "machine" };
  const add = useInstanceCredentialAdd(holder, null, reload);
  const rotate = useInstanceCredentialRotate(machine.name, reload);
  const models = useInstanceCopyModels(machine.name);
  const signIn = useInstanceSignIn(holder, reload);
  const archiveIcon = <ArchiveIcon aria-hidden="true" data-icon="inline-start" />;

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-0">
      <MachineHeader machine={machine} />
      <ContextFailure page={page} />
      <MachineReachNotice machine={machine.name} projects={page.servedProjects} />
      <section aria-labelledby="machine-instances" className="flex flex-col gap-3">
        <h3 id="machine-instances" className="font-semibold">
          Instances
        </h3>
        <InstanceRows instances={machine.instances} />
      </section>
      <section aria-labelledby="machine-credentials" className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h3 id="machine-credentials" className="font-semibold">
            Credentials
          </h3>
          {!archived && (
            <Button
              variant="outline"
              size="sm"
              className="self-start md:self-auto"
              onClick={add.start}
            >
              <PlusIcon aria-hidden="true" data-icon="inline-start" />
              Add credential
            </Button>
          )}
        </div>
        <CredentialRows
          rows={page.credentialRows}
          holder={holder}
          archived={archived}
          rotate={rotate}
          models={models}
          signIn={signIn}
        />
      </section>
      {!archived && (
        <section
          aria-labelledby="machine-danger"
          className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4"
        >
          <h3 id="machine-danger" className="font-semibold">
            Danger zone
          </h3>
          <p className="text-sm text-muted-foreground">
            Reset key replaces the key pair of <RecordName>{machine.name}</RecordName>. Archive ends
            the machine for good.
          </p>
          {live.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                Archive stays disabled while a live instance names this machine:
              </p>
              <InstanceNames label="Live instances" instances={live} />
            </div>
          )}
          <div className="flex flex-wrap gap-2 md:justify-end">
            <Button variant="outline" size="sm" onClick={reset.request}>
              <KeyRoundIcon aria-hidden="true" data-icon="inline-start" />
              Reset key
            </Button>
            {live.length > 0 ? (
              <DisabledAction
                label="Archive"
                reason="A live instance names this machine. Archive each instance first."
                icon={archiveIcon}
              />
            ) : (
              <Button variant="destructive" size="sm" onClick={archive.request}>
                {archiveIcon}
                Archive
              </Button>
            )}
          </div>
        </section>
      )}
      <ResetKeyDialog machine={machine} instances={live} reset={reset} />
      <ArchiveMachineDialog name={machine.name} archive={archive} />
      <CredentialAddSheet holder={holder} add={add} />
      <CredentialRotateSheet holder={machine.name} rotate={rotate} />
      <SignInAgainSheet holder={holder} signIn={signIn} />
      {models.target !== null && (
        <CopyModelsSheet key={models.target.key} target={models.target} reload={reload} />
      )}
    </div>
  );
}

export function MachineScreen() {
  const { machineName = "" } = useParams<{ machineName: string }>();
  const page = useMachinePage(machineName);
  const machine = page.machine.data;

  if (page.machine.loading) {
    return (
      <div className="flex flex-col gap-3 px-4 lg:px-0">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (machine === null) {
    return (
      <div className="flex flex-col items-start gap-2 px-4 lg:px-0">
        <p className="text-sm text-destructive">
          {page.machine.error?.message ?? "The machine could not be read."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={page.machine.reload}>
            Retry
          </Button>
          <Button nativeButton={false} variant="outline" size="sm" render={<Link to="/machines" />}>
            Open machines
          </Button>
        </div>
      </div>
    );
  }
  return <MachineDetail machine={machine} page={page} />;
}
