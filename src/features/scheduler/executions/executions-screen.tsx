import { AlertTriangleIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { duration, relativeTime } from "@/lib/format";

import { type ClaimState, useExecutions } from "./use-executions";

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
          type="single"
          variant="outline"
          aria-label="Execution scope"
          value={exec.scope}
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
          {exec.views.map((view) => (
            <Item key={view.execution.id} role="listitem" variant="outline">
              <ItemContent className="min-w-0 basis-64">
                <ItemTitle className="flex-wrap">
                  <Link
                    to={`/mission/${view.execution.nodeId}`}
                    className="underline underline-offset-4"
                  >
                    {view.execution.nodeTitle}
                  </Link>
                  {view.overBudget && (
                    <Badge variant="outline">
                      <AlertTriangleIcon aria-hidden="true" />
                      Over budget
                    </Badge>
                  )}
                </ItemTitle>
                <ItemDescription>Execution {view.execution.id}</ItemDescription>
                <ClaimantLine
                  kind={view.execution.claimantKind}
                  claimantId={view.execution.claimantId}
                  instanceRuntimeId={view.execution.instanceRuntimeId}
                />
                <ItemDescription>
                  {view.execution.claimKind} claim · attempt {view.execution.attemptId} · pinned
                  revision {view.execution.pinnedRevisionId}
                </ItemDescription>
              </ItemContent>
              <ItemContent className="min-w-0 basis-56">
                <ClaimStateLines claimState={view.claimState} deadline={view.deadline} />
                <ItemDescription>
                  Claimed {relativeTime(view.execution.startedAt)}
                  {view.execution.endedAt !== null &&
                    ` · ended ${relativeTime(view.execution.endedAt)}`}
                </ItemDescription>
                <BudgetLine
                  label="Turns"
                  used={String(view.execution.turnsUsed)}
                  budget={String(view.execution.turnBudget)}
                  pct={view.turnPct}
                  overBudget={view.turnOverBudget}
                />
                <BudgetLine
                  label="Wall time"
                  used={duration(view.execution.wallTimeUsedSeconds)}
                  budget={duration(view.execution.wallTimeBudgetSeconds)}
                  pct={view.wallTimePct}
                  overBudget={view.wallTimeOverBudget}
                />
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}

interface ClaimantLineProps {
  readonly kind: "worker binding" | "client identity";
  readonly claimantId: string;
  readonly instanceRuntimeId: string | null;
}

function ClaimantLine({ kind, claimantId, instanceRuntimeId }: ClaimantLineProps) {
  const claimant = kind === "worker binding" ? "Binding" : "Client identity";
  return (
    <ItemDescription>
      {claimant} {claimantId}
      {instanceRuntimeId !== null && ` · runtime ${instanceRuntimeId}`}
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

interface ClaimStateLinesProps {
  readonly claimState: ClaimState | null;
  readonly deadline: string | null;
}

function ClaimStateLines({ claimState, deadline }: ClaimStateLinesProps) {
  const badge = claimState === null ? null : CLAIM_STATE_BADGE[claimState];
  return (
    <>
      {badge !== null && <Badge variant={badge.variant}>{badge.label}</Badge>}
      {deadline !== null && <ItemDescription>Deadline {relativeTime(deadline)}</ItemDescription>}
      {claimState === "lost" && (
        <ItemDescription>Expiry is not proof that the runtime stopped.</ItemDescription>
      )}
    </>
  );
}

interface BudgetLineProps {
  readonly label: string;
  readonly used: string;
  readonly budget: string;
  readonly pct: number;
  readonly overBudget: boolean;
}

function BudgetLine({ label, used, budget, pct, overBudget }: BudgetLineProps) {
  return (
    <ItemDescription>
      {label} {used} / {budget} ({pct}%{overBudget && ", over budget"})
    </ItemDescription>
  );
}
