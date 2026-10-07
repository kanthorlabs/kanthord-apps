import { Link } from "react-router-dom";

import type { ClaimState, SchedulerExecutionRecord } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { utcDateTime } from "@/lib/format";

import { useExecutions } from "./use-executions";

export function ExecutionsScreen() {
  const exec = useExecutions();

  if (exec.loading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (exec.error !== null) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <p className="text-sm text-destructive">{exec.error.message}</p>
        <Button variant="outline" size="sm" onClick={exec.reload}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Executions</h2>
        <ToggleGroup
          variant="outline"
          aria-label="Execution scope"
          value={[exec.scope]}
          onValueChange={exec.selectScope}
        >
          <ToggleGroupItem value="live">Live</ToggleGroupItem>
          <ToggleGroupItem value="all">All</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {exec.views.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No executions found.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}

      {exec.views.length > 0 && (
        <ItemGroup aria-label="Executions" className="gap-2">
          {exec.views.map(({ execution, nodeName }) => (
            <Item key={execution.execution_id} role="listitem" variant="outline">
              <ItemContent className="min-w-0 basis-64">
                <ItemTitle className="flex-wrap">
                  <Link to={`/projects/${exec.projectId}`} className="underline underline-offset-4">
                    {nodeName}
                  </Link>
                </ItemTitle>
                <ItemDescription className="break-all">
                  Execution {execution.execution_id}
                </ItemDescription>
                <ClaimantLine claimant={execution.claimant} />
                <ItemDescription>
                  Attempt {execution.attempt} · pinned revision {execution.pinned_revision}
                </ItemDescription>
              </ItemContent>
              <ItemContent className="min-w-0 basis-56">
                <ClaimStateLines execution={execution} />
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}

function ClaimantLine({ claimant }: { claimant: SchedulerExecutionRecord["claimant"] }) {
  return (
    <ItemDescription className="break-all">
      Binding {claimant.worker_binding_id} · runtime {claimant.name ?? claimant.runtime_identity}
    </ItemDescription>
  );
}

const CLAIM_STATE_BADGE: Record<
  ClaimState,
  { readonly label: string; readonly variant: "secondary" | "destructive" | "outline" }
> = {
  running: { label: "Running", variant: "secondary" },
  lost: { label: "Lost", variant: "destructive" },
  finished: { label: "Finished", variant: "outline" },
};

function ClaimStateLines({ execution }: { execution: SchedulerExecutionRecord }) {
  const badge = CLAIM_STATE_BADGE[execution.claim_state];
  return (
    <>
      <Badge variant={badge.variant}>{badge.label}</Badge>
      <ItemDescription>Claimed {utcDateTime(execution.created_at)}</ItemDescription>
      {execution.ended_at !== null ? (
        <ItemDescription>Ended {utcDateTime(execution.ended_at)}</ItemDescription>
      ) : (
        <ItemDescription>Deadline {utcDateTime(execution.expired_at)}</ItemDescription>
      )}
      {execution.claim_state === "lost" && (
        <ItemDescription>Expiry is not proof that the runtime stopped.</ItemDescription>
      )}
    </>
  );
}
