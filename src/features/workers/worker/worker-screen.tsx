import { PlusIcon } from "lucide-react";
import { type ReactNode, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import type { ApiError } from "@/api/errors";
import type {
  WorkerBindingRecord,
  WorkerCatalogEntry,
  WorkerInstanceListItem,
  WorkerRegistrationRecord,
} from "@/api/types";
import { DataListItem } from "@/components/data-list-item";
import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { useCrumbLabel } from "@/components/crumb-labels";
import type { InstanceExecution } from "@/hooks/use-instance-executions";
import { durationText } from "@/lib/format";
import { effectiveInstanceCount } from "@/lib/instance-count";
import { shortFingerprint } from "@/lib/instance-host";
import { instancePagePath, workerPagePath } from "@/lib/worker-paths";
import { BindingRemoveAction } from "@/features/projects/view/components/binding-remove-action";
import { DetachInstanceDialog } from "../instance/components/detach-instance-dialog";
import { useInstanceDetach } from "../instance/use-instance-detach";
import { AddInstanceSheet } from "./components/add-instance-sheet";
import { InstanceRowActions } from "./components/instance-row-actions";
import { useInstanceCreate } from "./use-instance-create";
import { useWorkerPage } from "./use-worker-page";

function Section({
  id,
  title,
  loading,
  error,
  reload,
  action,
  stale = false,
  children,
}: {
  id: string;
  title: string;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
  action?: ReactNode;
  stale?: boolean;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {loading && <Skeleton className="h-20 w-full" />}
      {!loading && error !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-destructive">{error.message}</p>
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
        </div>
      )}
      {!loading && (error === null || stale) && children}
    </section>
  );
}

function EmptyList({ title, description }: { title: string; description?: string }) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        {description !== undefined && <EmptyDescription>{description}</EmptyDescription>}
      </EmptyHeader>
    </Empty>
  );
}

function BadgeRow({ label, values }: { label: string; values: readonly string[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      <div className="flex flex-wrap gap-1">
        {values.map((value) => (
          <Badge key={value} variant="outline">
            {value}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function WorkerHeader({ entry }: { entry: WorkerCatalogEntry }) {
  const budget = entry.resource_budget;
  return (
    <section aria-label="Worker" className="flex flex-col gap-3 border-b pb-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 className="min-w-0 font-mono text-lg font-semibold break-all">{entry.name}</h2>
        <Badge variant="secondary">{entry.host}</Badge>
        <Button
          nativeButton={false}
          render={<Link to={`/traces?worker_name=${encodeURIComponent(entry.name)}`} />}
          variant="outline"
          size="sm"
        >
          Traces
        </Button>
      </div>
      <BadgeRow label="Declared node states" values={entry.declared_node_states} />
      <BadgeRow label="Declared intents" values={entry.declared_intents} />
      <p className="text-sm">
        <span className="text-muted-foreground">Resource budget </span>
        {budget.turns === undefined ? "" : `${budget.turns} turns · `}
        {durationText(budget.wall_time_ms)}
      </p>
    </section>
  );
}

function activityText(execution: InstanceExecution | null): ReactNode {
  if (execution === null) return "Idle";
  return (
    <>
      Executing <RecordName>{execution.projectName}</RecordName> ·{" "}
      {execution.nodeName === null ? (
        execution.executionId
      ) : (
        <RecordName>{execution.nodeName}</RecordName>
      )}
    </>
  );
}

function InstanceRow({
  instance,
  execution,
  unlisted,
  onOpen,
  actions,
}: {
  instance: WorkerInstanceListItem;
  execution: InstanceExecution | null;
  unlisted: boolean;
  onOpen: () => void;
  actions: ReactNode;
}) {
  const connection = instance.connection;
  const atWorker = instance.placement === "worker";
  return (
    <DataListItem
      title={
        <>
          <span className="font-mono break-all">{instance.name}</span>{" "}
          <span className="text-muted-foreground tabular-nums">(v{instance.revision})</span>
        </>
      }
      select={{ label: `Open ${instance.name}`, disabled: false, onSelect: onOpen }}
      status={
        <>
          <Badge variant="outline">{instance.placement}</Badge>
          {instance.holder_mismatch && <Badge variant="destructive">Credential copy missing</Badge>}
        </>
      }
      fields={[
        { label: "Activity", value: activityText(execution) },
        { label: "Bindings", value: instance.binding_count },
        ...(atWorker
          ? [
              {
                label: "Fingerprint",
                value: (
                  <span className="font-mono break-all">
                    {instance.fingerprint === null
                      ? "None"
                      : shortFingerprint(instance.fingerprint)}
                  </span>
                ),
              },
              {
                label: "Connection",
                value:
                  connection === null ? (
                    "Not connected"
                  ) : (
                    <span className="break-all">Connected · {connection.connection_name}</span>
                  ),
              },
            ]
          : []),
      ]}
      notice={
        unlisted ? (
          <p className="text-sm text-muted-foreground">
            Runs with no binding. Archive it to stop it.
          </p>
        ) : undefined
      }
      actions={actions}
    />
  );
}

function BindingRow({ binding, actions }: { binding: WorkerBindingRecord; actions: ReactNode }) {
  const config = binding.config;
  const listed = "worker_instances" in config ? config.worker_instances : null;
  return (
    <DataListItem
      title={<span className="font-mono break-all">{binding.name}</span>}
      fields={[
        listed === null
          ? { label: "Instance count", value: effectiveInstanceCount(config) }
          : {
              label: "Instances",
              value:
                listed.length === 0 ? (
                  "none"
                ) : (
                  <span className="break-all">{listed.join(", ")}</span>
                ),
            },
      ]}
      actions={actions}
    />
  );
}

function RegistrationRow({ registration }: { registration: WorkerRegistrationRecord }) {
  return (
    <DataListItem
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
          {registration.draining && <Badge variant="outline">draining</Badge>}
        </>
      }
      fields={[
        ...(registration.host === "kanthord"
          ? [{ label: "Placement", value: registration.placement }]
          : []),
        ...(registration.instance == null
          ? []
          : [
              {
                label: "Instance",
                value: <span className="break-all">{registration.instance}</span>,
              },
            ]),
        ...(registration.execution_id === undefined
          ? []
          : [
              {
                label: "Execution",
                value: <span className="font-mono break-all">{registration.execution_id}</span>,
              },
            ]),
      ]}
    />
  );
}

export function WorkerScreen() {
  const { workerName = "" } = useParams<{ workerName: string }>();
  const navigate = useNavigate();
  const page = useWorkerPage(workerName);
  const create = useInstanceCreate(workerName, page.instances.reload);
  const reloadInstances = page.instances.reload;
  const reloadBindings = page.bindings.reload;
  const reloadAll = useCallback(() => {
    reloadInstances();
    reloadBindings();
  }, [reloadInstances, reloadBindings]);
  const detach = useInstanceDetach(reloadAll);
  useCrumbLabel(workerPagePath(workerName), workerName);
  const entry = page.entry.data;

  if (page.entry.loading) {
    return (
      <div className="flex flex-col gap-3 px-4 lg:px-0">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (entry === null) {
    return (
      <div className="flex flex-col items-start gap-2 px-4 lg:px-0">
        <p className="text-sm text-destructive">
          {page.entry.error?.message ?? "The worker could not be read."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={page.entry.reload}>
            Retry
          </Button>
          <Button variant="outline" size="sm" render={<Link to="/workers" />}>
            Open workers
          </Button>
        </div>
      </div>
    );
  }

  const hosted = entry.host === "kanthord";
  const instances = page.instances.data ?? [];
  const bindings = page.bindings.data ?? [];

  return (
    <div className="flex flex-col gap-6 px-4 lg:px-0">
      <WorkerHeader entry={entry} />
      {hosted && (
        <Section
          id="worker-instances"
          title="Instances"
          loading={page.instances.loading}
          error={page.instances.error}
          reload={page.instances.reload}
          stale={page.instances.data !== null}
          action={
            <Button
              variant="outline"
              size="sm"
              className="self-start md:self-auto"
              onClick={create.start}
            >
              <PlusIcon aria-hidden="true" data-icon="inline-start" />
              Add instance
            </Button>
          }
        >
          {instances.length === 0 ? (
            <EmptyList title="No instances." description="Add one to give this worker capacity." />
          ) : (
            <ItemGroup aria-label="Instances" className="gap-2">
              {instances.map((instance) => (
                <InstanceRow
                  key={instance.id}
                  instance={instance}
                  execution={page.executionOf(instance.name)}
                  unlisted={page.runsUnlisted(instance)}
                  onOpen={() => void navigate(instancePagePath(workerName, instance.name))}
                  actions={
                    <InstanceRowActions
                      instance={instance}
                      detach={detach}
                      onChanged={reloadAll}
                      projectNameOf={page.projectNameOf}
                    />
                  }
                />
              ))}
            </ItemGroup>
          )}
        </Section>
      )}
      <Section
        id="worker-bindings"
        title="Bindings"
        loading={page.bindings.loading}
        error={page.bindings.error}
        reload={page.bindings.reload}
      >
        {bindings.length === 0 ? (
          <EmptyList
            title="No bindings."
            description="No worker binding of this project names this worker."
          />
        ) : (
          <ItemGroup aria-label="Bindings" className="gap-2">
            {bindings.map((binding) => (
              <BindingRow
                key={binding.id}
                binding={binding}
                actions={
                  <BindingRemoveAction
                    projectId={binding.project_id}
                    bindingName={binding.name}
                    removed={binding.removed_at !== null}
                    onChanged={reloadAll}
                  />
                }
              />
            ))}
          </ItemGroup>
        )}
      </Section>
      <Section
        id="worker-registrations"
        title="Live registrations"
        loading={page.registrations.loading}
        error={page.registrations.error}
        reload={page.registrations.reload}
      >
        {page.projectRegistrations.length === 0 ? (
          <EmptyList title="No registrations." />
        ) : (
          <ItemGroup aria-label="Live registrations" className="gap-2">
            {page.projectRegistrations.map((registration) => (
              <RegistrationRow key={registration.runtime_identity} registration={registration} />
            ))}
          </ItemGroup>
        )}
      </Section>
      {hosted && <AddInstanceSheet workerName={workerName} create={create} />}
      <DetachInstanceDialog detach={detach} />
    </div>
  );
}
