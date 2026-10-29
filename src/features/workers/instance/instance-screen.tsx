import {
  ArchiveIcon,
  KeyRoundIcon,
  ListPlusIcon,
  PlusIcon,
  RefreshCwIcon,
  UnlinkIcon,
} from "lucide-react";
import { type ReactNode, type RefObject, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { WorkerInstanceDetail } from "@/api/types";
import { DataListItem } from "@/components/data-list-item";
import { DisabledAction } from "@/components/disabled-action";
import { InstanceReachNotice } from "@/components/instance-reach-notice";
import { RecordName } from "@/components/record-name";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { utcDateTime } from "@/lib/format";
import { nodePath } from "@/lib/node-path";
import { workerPagePath } from "@/lib/worker-paths";
import { ArchiveInstanceDialog } from "./components/archive-instance-dialog";
import { CopyModelsSheet } from "./components/copy-models-sheet";
import { CredentialAddSheet } from "./components/credential-add-sheet";
import { CredentialRotateSheet } from "./components/credential-rotate-sheet";
import { DetachInstanceDialog } from "./components/detach-instance-dialog";
import { ResetKeyDialog } from "./components/reset-key-dialog";
import { SignInAgainSheet } from "./components/sign-in-again-sheet";
import { type InstanceArchiveState, useInstanceArchive } from "./use-instance-archive";
import { type InstanceCopyModelsState, useInstanceCopyModels } from "./use-instance-copy-models";
import { useInstanceCredentialAdd } from "./use-instance-credential-add";
import { type InstanceDetachState, useInstanceDetach } from "./use-instance-detach";
import {
  type InstanceCredentialRotateState,
  useInstanceCredentialRotate,
} from "./use-instance-credential-rotate";
import {
  type InstanceBindingRow,
  type InstanceCopyHealthLine,
  type InstanceCredentialRow,
  type InstancePage,
  type InstanceRegistrationRow,
  useInstancePage,
} from "./use-instance-page";
import { useInstanceReset } from "./use-instance-reset";
import { type InstanceSignInState, useInstanceSignIn } from "./use-instance-sign-in";

const SIGN_IN_AGAIN_LIVE =
  "The copy is live. The server refuses a new sign-in while the copy is sealed to the current key of the instance.";

function SectionHeading({ id, title, action }: { id: string; title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <h3 id={id} className="font-semibold">
        {title}
      </h3>
      {action}
    </div>
  );
}

function EmptyLine({ title }: { title: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
      </EmptyHeader>
    </Empty>
  );
}

function InstanceHeader({
  instance,
  keyed,
  projectId,
}: {
  instance: WorkerInstanceDetail;
  keyed: boolean;
  projectId: string;
}) {
  const connection = instance.connection;
  return (
    <section aria-label="Instance" className="flex flex-col gap-2 border-b pb-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="min-w-0 font-mono text-lg font-semibold break-all">{instance.name}</h2>
        <span className="text-muted-foreground tabular-nums">(v{instance.revision})</span>
        {instance.ended_at !== null && <Badge variant="secondary">Archived</Badge>}
        <Badge variant="outline">{instance.placement}</Badge>
        {keyed && (
          <Badge variant={connection === null ? "outline" : "secondary"}>
            {connection === null ? "Not connected" : "Connected"}
          </Badge>
        )}
      </div>
      <dl className="grid grid-cols-1 gap-x-3 gap-y-1 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
        <dt className="text-muted-foreground">Worker</dt>
        <dd className="min-w-0 break-all">
          <Link
            to={workerPagePath(instance.worker, projectId)}
            className="underline underline-offset-4"
          >
            {instance.worker}
          </Link>
        </dd>
        {keyed && (
          <>
            <dt className="text-muted-foreground">Fingerprint</dt>
            <dd className="min-w-0 font-mono break-all">{instance.fingerprint}</dd>
            <dt className="text-muted-foreground">Connection</dt>
            <dd className="min-w-0 break-all">
              {connection === null
                ? "Not connected"
                : `Connected · ${connection.connection_name} · last heartbeat ${utcDateTime(connection.last_heartbeat_at)}`}
            </dd>
          </>
        )}
        {instance.ended_at !== null && (
          <>
            <dt className="text-muted-foreground">Archived</dt>
            <dd>{utcDateTime(instance.ended_at)}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

function DetachAction({
  row,
  instanceName,
  detach,
}: {
  row: InstanceBindingRow;
  instanceName: string;
  detach: InstanceDetachState;
}) {
  const icon = <UnlinkIcon aria-hidden="true" data-icon="inline-start" />;
  const label = `Detach ${instanceName} from ${row.binding} of ${row.projectName}`;
  if (row.state === "draining") {
    return (
      <DisabledAction
        label="Detach"
        ariaLabel={label}
        reason={`${row.binding} no longer lists ${instanceName}. Its registration drains.`}
        icon={icon}
      />
    );
  }
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={label}
      onClick={() => detach.request(instanceName, row)}
    >
      {icon}
      Detach
    </Button>
  );
}

function BindingRows({
  rows,
  instanceName,
  archived,
  unlisted,
  detach,
}: {
  rows: readonly InstanceBindingRow[];
  instanceName: string;
  archived: boolean;
  unlisted: boolean;
  detach: InstanceDetachState;
}) {
  if (rows.length === 0) {
    return (
      <EmptyLine
        title={
          unlisted
            ? "Runs with no binding. Archive it to stop it."
            : "No binding lists this instance."
        }
      />
    );
  }
  return (
    <ItemGroup aria-label="Bindings" className="gap-2">
      {rows.map((row) => (
        <DataListItem
          key={`${row.projectId}/${row.binding}`}
          title={<span className="font-mono break-all">{row.binding}</span>}
          status={
            <Badge variant={row.state === "serving" ? "secondary" : "outline"}>{row.state}</Badge>
          }
          fields={[
            { label: "Project", value: <span className="break-all">{row.projectName}</span> },
          ]}
          actions={
            <>
              {!archived && <DetachAction row={row} instanceName={instanceName} detach={detach} />}
              <Button
                variant="outline"
                size="sm"
                render={<Link to={`/projects/${encodeURIComponent(row.projectId)}?tab=bindings`} />}
              >
                Open binding
              </Button>
            </>
          }
        />
      ))}
    </ItemGroup>
  );
}

function RegistrationRows({
  rows,
  projectNameOf,
}: {
  rows: readonly InstanceRegistrationRow[];
  projectNameOf: (projectId: string) => string;
}) {
  if (rows.length === 0) return <EmptyLine title="No live registrations." />;
  return (
    <ItemGroup aria-label="Registrations" className="gap-2">
      {rows.map(({ registration, execution }) => {
        return (
          <DataListItem
            key={registration.runtime_identity}
            title={
              <span className="font-mono break-all">
                {registration.name ?? registration.runtime_identity}
              </span>
            }
            status={
              <>
                <Badge variant={registration.activity === "idle" ? "secondary" : "default"}>
                  {registration.activity}
                </Badge>
                {registration.draining && <Badge variant="outline">Draining</Badge>}
              </>
            }
            fields={[
              {
                label: "Project",
                value: <span className="break-all">{projectNameOf(registration.project_id)}</span>,
              },
              ...(registration.execution_id === undefined
                ? []
                : [
                    {
                      label: "Execution",
                      value: (
                        <span className="font-mono break-all">{registration.execution_id}</span>
                      ),
                    },
                  ]),
            ]}
            actions={
              execution?.nodeId == null ? undefined : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    render={<Link to={nodePath(execution.projectId, execution.nodeId)} />}
                  >
                    Open execution
                  </Button>
                  {execution.traceId !== null && (
                    <Button
                      nativeButton={false}
                      render={<Link to={`/traces/${encodeURIComponent(execution.traceId)}`} />}
                      variant="outline"
                      size="sm"
                    >
                      Trace
                    </Button>
                  )}
                </>
              )
            }
          />
        );
      })}
    </ItemGroup>
  );
}

function CopyHealthLine({
  health,
  instanceName,
}: {
  health: InstanceCopyHealthLine;
  instanceName: string;
}) {
  if (health.reportedAt === null) {
    return (
      <p className="text-sm text-muted-foreground">
        No report from <RecordName>{instanceName}</RecordName> for this revision since the server
        start.
      </p>
    );
  }
  return (
    <p className="text-sm">
      {health.hint !== null && `${health.hint} `}Reported by <RecordName>{instanceName}</RecordName>{" "}
      at {utcDateTime(health.reportedAt)}.
    </p>
  );
}

function CopyAction({
  row,
  rotate,
  models,
  signIn,
}: {
  row: InstanceCredentialRow;
  rotate: InstanceCredentialRotateState;
  models: InstanceCopyModelsState;
  signIn: InstanceSignInState;
}) {
  if (row.shape === "oauth") {
    const icon = <KeyRoundIcon aria-hidden="true" data-icon="inline-start" />;
    if (row.copy.sealed_current) {
      return <DisabledAction label="Sign in again" reason={SIGN_IN_AGAIN_LIVE} icon={icon} />;
    }
    return (
      <Button variant="outline" size="sm" onClick={() => signIn.start(row)}>
        {icon}
        Sign in again
      </Button>
    );
  }
  if (row.shape !== "api_key") return null;
  return (
    <>
      {row.modelsEditable && (
        <Button variant="outline" size="sm" onClick={() => models.start(row)}>
          <ListPlusIcon aria-hidden="true" data-icon="inline-start" />
          Edit models
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => rotate.start(row.copy)}>
        <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
        Rotate
      </Button>
    </>
  );
}

function CredentialRows({
  rows,
  instanceName,
  archived,
  rotate,
  models,
  signIn,
}: {
  rows: readonly InstanceCredentialRow[];
  instanceName: string;
  archived: boolean;
  rotate: InstanceCredentialRotateState;
  models: InstanceCopyModelsState;
  signIn: InstanceSignInState;
}) {
  if (rows.length === 0) return <EmptyLine title="No credential copies." />;
  return (
    <ItemGroup aria-label="Credentials" className="gap-2">
      {rows.map((row) => {
        const copy = row.copy;
        return (
          <DataListItem
            key={copy.name}
            title={
              <>
                <span className="font-mono break-all">{copy.name}</span> · {copy.platform}{" "}
                <span className="text-muted-foreground tabular-nums">(v{copy.revision})</span>
              </>
            }
            status={
              row.health === null ? (
                <Badge variant="destructive">Re-enter</Badge>
              ) : (
                <Badge variant={row.health.variant}>{row.health.label}</Badge>
              )
            }
            notice={
              row.health === null ? (
                <p className="text-sm">Re-enter: sealed to an ended key.</p>
              ) : (
                <CopyHealthLine health={row.health} instanceName={instanceName} />
              )
            }
            actions={
              archived ? undefined : (
                <CopyAction row={row} rotate={rotate} models={models} signIn={signIn} />
              )
            }
          />
        );
      })}
    </ItemGroup>
  );
}

function ArchiveButton({
  archive,
  control,
}: {
  archive: InstanceArchiveState;
  control: RefObject<HTMLButtonElement | null>;
}) {
  const icon = <ArchiveIcon aria-hidden="true" data-icon="inline-start" />;
  return (
    <Button
      ref={control}
      variant="destructive"
      size="sm"
      aria-busy={archive.reading}
      disabled={archive.reading}
      focusableWhenDisabled
      onClick={archive.request}
    >
      {icon}
      Archive
    </Button>
  );
}

function ReadFailure({ page }: { page: InstancePage }) {
  if (page.instance.error === null) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>The instance was not read again. The page shows the last read.</AlertTitle>
      <AlertDescription>
        <span>{page.instance.error.message}</span>
        <Button type="button" size="sm" variant="outline" onClick={page.instance.reload}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function ContextFailure({ page }: { page: InstancePage }) {
  if (page.contextError === null) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>The projects, bindings or credential platforms were not read.</AlertTitle>
      <AlertDescription>
        <span>{page.contextError}</span>
        <Button type="button" size="sm" variant="outline" onClick={page.retryContext}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function InstanceDetail({
  instance,
  page,
}: {
  instance: WorkerInstanceDetail;
  page: InstancePage;
}) {
  const reload = page.instance.reload;
  const projectNameOf = page.projectNameOf;
  const archived = instance.ended_at !== null;
  const reset = useInstanceReset(instance, reload);
  const navigate = useNavigate();
  const archiveControl = useRef<HTMLButtonElement>(null);
  const archive = useInstanceArchive(
    { name: instance.name, revision: instance.revision },
    () => void navigate(workerPagePath(instance.worker, page.projectId)),
    reload,
    archiveControl,
  );
  const add = useInstanceCredentialAdd(instance.name, reload);
  const rotate = useInstanceCredentialRotate(instance.name, reload);
  const models = useInstanceCopyModels(instance.name);
  const signIn = useInstanceSignIn(instance.name, reload);
  const detach = useInstanceDetach(reload);

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-0">
      <ReadFailure page={page} />
      <InstanceHeader instance={instance} keyed={page.keyed} projectId={page.projectId} />
      <ContextFailure page={page} />
      <InstanceReachNotice instance={instance.name} projects={page.servedProjects} />
      <section aria-labelledby="instance-bindings" className="flex flex-col gap-3">
        <SectionHeading id="instance-bindings" title="Bindings" />
        <BindingRows
          rows={page.bindingRows}
          instanceName={instance.name}
          archived={archived}
          unlisted={page.unlisted}
          detach={detach}
        />
      </section>
      <section aria-labelledby="instance-registrations" className="flex flex-col gap-3">
        <SectionHeading id="instance-registrations" title="Registrations" />
        <RegistrationRows rows={page.registrationRows} projectNameOf={projectNameOf} />
      </section>
      {page.keyed && (
        <section aria-labelledby="instance-credentials" className="flex flex-col gap-3">
          <SectionHeading
            id="instance-credentials"
            title="Credentials"
            action={
              archived ? undefined : (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-start md:self-auto"
                  onClick={add.start}
                >
                  <PlusIcon aria-hidden="true" data-icon="inline-start" />
                  Add credential
                </Button>
              )
            }
          />
          <CredentialRows
            rows={page.credentialRows}
            instanceName={instance.name}
            archived={archived}
            rotate={rotate}
            models={models}
            signIn={signIn}
          />
        </section>
      )}
      {!archived && (
        <section
          aria-labelledby="instance-danger"
          className="flex flex-col gap-3 rounded-lg border border-destructive/40 p-4"
        >
          <h3 id="instance-danger" className="font-semibold">
            Danger zone
          </h3>
          <p className="text-sm text-muted-foreground">
            {page.keyed && (
              <>
                Reset key replaces the key pair of <RecordName>{instance.name}</RecordName>.{" "}
              </>
            )}
            Archive ends the instance for good.
          </p>
          <div className="flex flex-wrap gap-2 md:justify-end">
            {page.keyed && (
              <Button variant="outline" size="sm" onClick={reset.request}>
                <KeyRoundIcon aria-hidden="true" data-icon="inline-start" />
                Reset key
              </Button>
            )}
            <ArchiveButton archive={archive} control={archiveControl} />
          </div>
        </section>
      )}
      {page.keyed && (
        <ResetKeyDialog instance={instance} reset={reset} projectNameOf={projectNameOf} />
      )}
      <ArchiveInstanceDialog name={instance.name} archive={archive} projectNameOf={projectNameOf} />
      <DetachInstanceDialog detach={detach} />
      {page.keyed && (
        <>
          <CredentialAddSheet instanceName={instance.name} add={add} />
          <CredentialRotateSheet instanceName={instance.name} rotate={rotate} />
          <SignInAgainSheet instanceName={instance.name} signIn={signIn} />
        </>
      )}
      {models.target !== null && (
        <CopyModelsSheet key={models.target.key} target={models.target} reload={reload} />
      )}
    </div>
  );
}

export function InstanceScreen() {
  const { workerName = "", instanceName = "" } = useParams<{
    workerName: string;
    instanceName: string;
  }>();
  const page = useInstancePage(instanceName);
  const instance = page.instance.data;

  if (page.instance.loading) {
    return (
      <div className="flex flex-col gap-3 px-4 lg:px-0">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (instance === null) {
    return (
      <div className="flex flex-col items-start gap-2 px-4 lg:px-0">
        <p className="text-sm text-destructive">
          {page.instance.error?.message ?? "The instance could not be read."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={page.instance.reload}>
            Retry
          </Button>
          <Button
            variant="outline"
            size="sm"
            render={<Link to={workerPagePath(workerName, page.projectId)} />}
          >
            Open {workerName}
          </Button>
        </div>
      </div>
    );
  }
  return <InstanceDetail instance={instance} page={page} />;
}
