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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function TemplateCard({ template }: { template: WorkerTemplate }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-mono text-sm">{template.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
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
          <p className="text-sm text-muted-foreground mb-1">Declared node states</p>
          <div className="flex flex-wrap gap-1">
            {template.declaredNodeStates.map((s) => (
              <Badge key={s} variant="outline" className="font-mono text-xs">
                {s}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Default configuration</p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm font-mono">
            {Object.entries(template.defaultConfiguration).map(([k, v]) => (
              <Fragment key={k}>
                <dt className="text-muted-foreground truncate">{k}</dt>
                <dd>{v}</dd>
              </Fragment>
            ))}
          </dl>
        </div>
        <div>
          <p className="text-sm text-muted-foreground mb-1">Overridable options</p>
          <div className="flex flex-wrap gap-1">
            {template.overridableOptions.map((o) => (
              <Badge key={o} variant="secondary" className="font-mono text-xs">
                {o}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EffectiveConfigTable({ entries }: { entries: readonly EffectiveEntry[] }) {
  return (
    <dl className="grid grid-cols-[auto_1fr_auto] gap-x-4 gap-y-1 text-sm font-mono">
      {entries.map((entry) => (
        <Fragment key={entry.key}>
          <dt className="text-muted-foreground truncate">{entry.key}</dt>
          <dd>{entry.value}</dd>
          <dd>
            {entry.inherited ? (
              <span className="text-xs text-muted-foreground">inherited</span>
            ) : (
              <span className="text-xs font-semibold text-foreground">overridden</span>
            )}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

function WorkerBindingCard({
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
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">
          <span className="font-mono">{view.binding.identity}</span>
          <span className="ml-2 text-muted-foreground font-normal">
            {view.binding.workerName} · rev {view.binding.revision}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            id={`avail-${view.binding.id}`}
            checked={available}
            onCheckedChange={(checked) => onSetAvailability(view.binding.id, checked)}
            aria-label={`Availability for ${view.binding.identity}`}
          />
          <Label htmlFor={`avail-${view.binding.id}`}>
            {available ? "Available" : "Unavailable"}
          </Label>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 max-w-[8rem]">
            <Label htmlFor={`count-${view.binding.id}`} className="mb-1 block text-sm">
              Instance count
            </Label>
            <Input
              id={`count-${view.binding.id}`}
              type="number"
              min={0}
              value={countInput}
              onChange={(e) => setCountInput(e.target.value)}
              aria-label={`Instance count for ${view.binding.identity}`}
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleApplyCount}>
            Apply
          </Button>
        </div>
        {view.effectiveEntries.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Effective configuration</p>
            <EffectiveConfigTable entries={view.effectiveEntries} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PoolSection({ views }: { views: readonly WorkerBindingView[] }) {
  return (
    <div className="space-y-4">
      {views.map((view) => (
        <div key={view.binding.id}>
          <p className="text-sm font-medium mb-2 font-mono">{view.binding.identity}</p>
          <div className="space-y-2">
            {view.instances.length === 0 && (
              <p className="text-sm text-muted-foreground">No instances.</p>
            )}
            {view.instances.map((inst) => (
              <Card key={inst.runtimeId}>
                <CardContent className="pt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{inst.runtimeId}</span>
                    <Badge variant={inst.busy ? "default" : "secondary"}>
                      {inst.busy ? "busy" : "idle"}
                    </Badge>
                  </div>
                  {inst.healthcheckPasses ? (
                    <p className="text-sm text-muted-foreground">Healthcheck passing</p>
                  ) : (
                    <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
                      <p className="text-sm font-medium text-destructive mb-1">
                        Healthcheck failing
                      </p>
                      <p className="text-sm text-destructive">{inst.healthcheckDetail}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
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
          <div className="grid gap-4 lg:grid-cols-2">
            {templates.map((t) => (
              <TemplateCard key={t.name} template={t} />
            ))}
          </div>
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
          <div className="grid gap-4 lg:grid-cols-2">
            {bindingViews.map((view) => (
              <WorkerBindingCard
                key={view.binding.id}
                view={view}
                onSetAvailability={handleSetAvailability}
                onSetInstanceCount={handleSetInstanceCount}
              />
            ))}
          </div>
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
