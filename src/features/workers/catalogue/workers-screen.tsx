import { Fragment, useState } from "react";

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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import type { WorkerTemplate } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { duration } from "@/lib/format";
import { useSetAvailability } from "./use-set-availability";
import { useSetInstanceCount } from "./use-set-instance-count";
import type { EffectiveEntry, WorkerBindingView } from "./use-workers";
import { useWorkers } from "./use-workers";

function TemplateItem({ template }: { template: WorkerTemplate }) {
  return (
    <Item variant="outline" role="listitem">
      <ItemHeader>
        <ItemTitle>
          <span className="font-mono">{template.name}</span>
        </ItemTitle>
      </ItemHeader>
      <ItemContent className="min-w-0 gap-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Method</p>
            <p>{template.method}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Agent</p>
            <p>
              {template.agentName}{" "}
              <span className="text-muted-foreground">({template.agentKind})</span>
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Turn budget</p>
            <p>{template.turnBudget} turns</p>
          </div>
          <div>
            <p className="text-muted-foreground">Wall-time budget</p>
            <p>{duration(template.wallTimeBudgetSeconds)}</p>
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Declared node states</p>
          <div className="flex flex-wrap gap-1">
            {template.declaredNodeStates.map((s) => (
              <Badge key={s} variant="outline">
                {s}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Default configuration</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm">
            {Object.entries(template.defaultConfiguration).map(([k, v]) => (
              <Fragment key={k}>
                <dt className="truncate text-muted-foreground">{k}</dt>
                <dd className="break-all">{v}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
        <div>
          <p className="mb-1 text-sm text-muted-foreground">Overridable options</p>
          <div className="flex flex-wrap gap-1">
            {template.overridableOptions.map((o) => (
              <Badge key={o} variant="secondary">
                {o}
              </Badge>
            ))}
          </div>
        </div>
      </ItemContent>
    </Item>
  );
}

function EffectiveConfigList({ entries }: { entries: readonly EffectiveEntry[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 gap-y-1 font-mono text-sm">
      {entries.map((entry) => (
        <Fragment key={entry.key}>
          <dt className="truncate text-muted-foreground">{entry.key}</dt>
          <dd className="break-all">{entry.value}</dd>
          <dd>
            <Badge variant={entry.inherited ? "outline" : "secondary"}>
              {entry.inherited ? "inherited" : "overridden"}
            </Badge>
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

function WorkerBindingItem({
  view,
  onSetAvailability,
  onSetInstanceCount,
}: {
  view: WorkerBindingView;
  onSetAvailability: (bindingId: string, available: boolean) => void;
  onSetInstanceCount: (
    bindingId: string,
    newCount: number,
    currentCount: number,
    busyCount: number,
  ) => void;
}) {
  const [countInput, setCountInput] = useState(String(view.binding.instanceCount ?? 0));
  const currentCount = view.binding.instanceCount ?? 0;
  const available = view.binding.available ?? false;

  function handleApplyCount() {
    const n = parseInt(countInput, 10);
    if (!isNaN(n) && n >= 0) {
      onSetInstanceCount(view.binding.id, n, currentCount, view.busyCount);
    }
  }

  return (
    <Item variant="outline" role="listitem">
      <ItemHeader>
        <ItemTitle className="flex-wrap">
          <span className="font-mono">{view.binding.identity}</span>
          <span className="font-normal text-muted-foreground">
            {view.binding.workerName} · rev {view.binding.revision}
          </span>
        </ItemTitle>
      </ItemHeader>
      <ItemContent className="min-w-0 gap-4">
        <Field orientation="horizontal">
          <Switch
            id={`avail-${view.binding.id}`}
            checked={available}
            onCheckedChange={(checked) => onSetAvailability(view.binding.id, checked)}
            aria-label={`Availability for ${view.binding.identity}`}
          />
          <FieldLabel htmlFor={`avail-${view.binding.id}`}>
            {available ? "Available" : "Unavailable"}
          </FieldLabel>
        </Field>
        <div className="flex items-end gap-2">
          <Field className="max-w-32">
            <FieldLabel htmlFor={`count-${view.binding.id}`}>Instance count</FieldLabel>
            <Input
              id={`count-${view.binding.id}`}
              type="number"
              min={0}
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
              aria-label={`Instance count for ${view.binding.identity}`}
            />
          </Field>
          <Button variant="outline" size="sm" onClick={handleApplyCount}>
            Apply
          </Button>
        </div>
        {view.effectiveEntries.length > 0 && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Effective configuration</p>
            <EffectiveConfigList entries={view.effectiveEntries} />
          </div>
        )}
      </ItemContent>
    </Item>
  );
}

function PoolSection({ views }: { views: readonly WorkerBindingView[] }) {
  return (
    <div className="space-y-4">
      {views.map((view) => (
        <div key={view.binding.id}>
          <p className="mb-2 font-mono text-sm font-medium">{view.binding.identity}</p>
          {view.instances.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No instances.</EmptyTitle>
              </EmptyHeader>
            </Empty>
          ) : (
            <ItemGroup className="gap-2">
              {view.instances.map((inst) => (
                <Item key={inst.runtimeId} variant="outline" size="sm" role="listitem">
                  <ItemContent className="min-w-0">
                    <ItemTitle>
                      <span className="font-mono">{inst.runtimeId}</span>
                      <Badge variant={inst.busy ? "default" : "secondary"}>
                        {inst.busy ? "busy" : "idle"}
                      </Badge>
                    </ItemTitle>
                    {inst.healthcheckPasses ? (
                      <ItemDescription>Healthcheck passing</ItemDescription>
                    ) : (
                      <Alert variant="destructive">
                        <AlertTitle>Healthcheck failing</AlertTitle>
                        <AlertDescription>{inst.healthcheckDetail}</AlertDescription>
                      </Alert>
                    )}
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )}
        </div>
      ))}
    </div>
  );
}

export function WorkersScreen() {
  const projectId = useProjectId();
  const {
    templates,
    bindingViews,
    templatesLoading,
    templatesError,
    bindingsLoading,
    bindingsError,
    instancesLoading,
    instancesError,
    reloadTemplates,
    reloadBindings,
    reloadInstances,
  } = useWorkers();

  const availabilityState = useSetAvailability();
  const instanceCountState = useSetInstanceCount();

  function handleSetAvailability(bindingId: string, available: boolean) {
    availabilityState.toggle(projectId, bindingId, available, reloadBindings);
  }

  function handleSetInstanceCount(
    bindingId: string,
    newCount: number,
    currentCount: number,
    busyCount: number,
  ) {
    instanceCountState.request(projectId, bindingId, newCount, currentCount, busyCount, () => {
      reloadBindings();
      reloadInstances();
    });
  }

  return (
    <div className="space-y-8 px-4 lg:px-0">
      <section aria-labelledby="catalogue-heading">
        <h2 id="catalogue-heading" className="text-lg font-semibold mb-4">
          Worker catalogue
        </h2>
        {templatesLoading && (
          <div className="space-y-3">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}
        {templatesError !== null && !templatesLoading && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{templatesError.message}</p>
            <Button variant="outline" size="sm" onClick={reloadTemplates}>
              Retry
            </Button>
          </div>
        )}
        {!templatesLoading && templatesError === null && (
          <ItemGroup className="gap-4 lg:grid lg:grid-cols-2">
            {templates.map((t) => (
              <TemplateItem key={t.name} template={t} />
            ))}
          </ItemGroup>
        )}
      </section>

      <Separator />

      <section aria-labelledby="bindings-heading">
        <h2 id="bindings-heading" className="text-lg font-semibold mb-4">
          Worker bindings
        </h2>
        {(bindingsLoading || instancesLoading) && (
          <div className="space-y-3">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        )}
        {bindingsError !== null && !bindingsLoading && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{bindingsError.message}</p>
            <Button variant="outline" size="sm" onClick={reloadBindings}>
              Retry
            </Button>
          </div>
        )}
        {!bindingsLoading && !instancesLoading && bindingsError === null && (
          <ItemGroup className="gap-4 lg:grid lg:grid-cols-2">
            {bindingViews.map((view) => (
              <WorkerBindingItem
                key={view.binding.id}
                view={view}
                onSetAvailability={handleSetAvailability}
                onSetInstanceCount={handleSetInstanceCount}
              />
            ))}
          </ItemGroup>
        )}
      </section>

      <Separator />

      <section aria-labelledby="pool-heading">
        <h2 id="pool-heading" className="text-lg font-semibold mb-4">
          Instance pool
        </h2>
        {(instancesLoading || bindingsLoading) && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}
        {instancesError !== null && !instancesLoading && (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{instancesError.message}</p>
            <Button variant="outline" size="sm" onClick={reloadInstances}>
              Retry
            </Button>
          </div>
        )}
        {!instancesLoading && !bindingsLoading && instancesError === null && (
          <PoolSection views={bindingViews} />
        )}
      </section>

      <AlertDialog
        open={instanceCountState.pending !== null}
        onOpenChange={(open) => {
          if (!open) instanceCountState.cancel();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decrease instance count?</AlertDialogTitle>
            <AlertDialogDescription>
              {instanceCountState.pending !== null && (
                <>
                  The daemon retires idle instances first. A busy instance finishes its current
                  execution before it retires.{" "}
                  {instanceCountState.pending.busyCount > 0 ? (
                    <>
                      <strong>{instanceCountState.pending.busyCount}</strong> instance
                      {instanceCountState.pending.busyCount === 1 ? "" : "s"} of this binding{" "}
                      {instanceCountState.pending.busyCount === 1 ? "is" : "are"} currently busy and
                      will finish their current execution before retiring.
                    </>
                  ) : (
                    <>No instances of this binding are currently busy.</>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={instanceCountState.cancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                void instanceCountState.confirm(() => {
                  reloadBindings();
                  reloadInstances();
                });
              }}
            >
              Decrease
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
