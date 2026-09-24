import { AlertTriangleIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { duration, relativeTime } from "@/lib/format";

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
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              exec.scope === "live"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => exec.setScope("live")}
            aria-pressed={exec.scope === "live"}
          >
            Live
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${
              exec.scope === "all"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => exec.setScope("all")}
            aria-pressed={exec.scope === "all"}
          >
            All
          </button>
        </div>
      </div>

      {exec.views.length === 0 && (
        <p className="text-sm text-muted-foreground">No executions found.</p>
      )}

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Node</TableHead>
              <TableHead>Claimant</TableHead>
              <TableHead>Kind / Attempt</TableHead>
              <TableHead>Lease</TableHead>
              <TableHead>Budget</TableHead>
              <TableHead>Started / Ended</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exec.views.map((view) => (
              <TableRow
                key={view.execution.id}
                className={view.overBudget ? "bg-amber-500/10" : ""}
              >
                <TableCell>
                  <Link
                    to={`/mission/${view.execution.nodeId}`}
                    className="text-primary hover:underline"
                  >
                    {view.execution.nodeTitle}
                  </Link>
                </TableCell>
                <TableCell>
                  <ClaimantCell
                    kind={view.execution.claimantKind}
                    claimantId={view.execution.claimantId}
                    instanceRuntimeId={view.execution.instanceRuntimeId}
                  />
                </TableCell>
                <TableCell>
                  <div className="text-sm">{view.execution.claimKind}</div>
                  <div className="text-xs text-muted-foreground">
                    {view.execution.attemptId} · rev {view.execution.pinnedRevisionId}
                  </div>
                </TableCell>
                <TableCell>
                  <LeaseCell
                    lease={view.execution.lease}
                    live={view.execution.live}
                    leaseExpired={view.leaseExpired}
                  />
                </TableCell>
                <TableCell>
                  <BudgetCell
                    turnsUsed={view.execution.turnsUsed}
                    turnBudget={view.execution.turnBudget}
                    turnPct={view.turnPct}
                    turnOverBudget={view.turnOverBudget}
                    wallTimeUsedSeconds={view.execution.wallTimeUsedSeconds}
                    wallTimeBudgetSeconds={view.execution.wallTimeBudgetSeconds}
                    wallTimePct={view.wallTimePct}
                    wallTimeOverBudget={view.wallTimeOverBudget}
                  />
                </TableCell>
                <TableCell>
                  <div className="text-xs">
                    <span>{relativeTime(view.execution.startedAt)}</span>
                    {view.execution.endedAt !== null && (
                      <span className="block text-muted-foreground">
                        ended {relativeTime(view.execution.endedAt)}
                      </span>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {exec.views.map((view) => (
          <Card key={view.execution.id} className={view.overBudget ? "border-amber-500" : ""}>
            <CardContent className="flex flex-col gap-3 py-4">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to={`/mission/${view.execution.nodeId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {view.execution.nodeTitle}
                </Link>
                {view.overBudget && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    <AlertTriangleIcon className="size-3" aria-hidden="true" />
                    Over budget
                  </Badge>
                )}
              </div>
              <ClaimantCell
                kind={view.execution.claimantKind}
                claimantId={view.execution.claimantId}
                instanceRuntimeId={view.execution.instanceRuntimeId}
              />
              <div className="text-xs text-muted-foreground">
                {view.execution.claimKind} · {view.execution.attemptId} · rev{" "}
                {view.execution.pinnedRevisionId}
              </div>
              <div className="text-xs text-muted-foreground">
                Started {relativeTime(view.execution.startedAt)}
                {view.execution.endedAt !== null && (
                  <span> · ended {relativeTime(view.execution.endedAt)}</span>
                )}
              </div>
              <LeaseCell
                lease={view.execution.lease}
                live={view.execution.live}
                leaseExpired={view.leaseExpired}
              />
              <BudgetCell
                turnsUsed={view.execution.turnsUsed}
                turnBudget={view.execution.turnBudget}
                turnPct={view.turnPct}
                turnOverBudget={view.turnOverBudget}
                wallTimeUsedSeconds={view.execution.wallTimeUsedSeconds}
                wallTimeBudgetSeconds={view.execution.wallTimeBudgetSeconds}
                wallTimePct={view.wallTimePct}
                wallTimeOverBudget={view.wallTimeOverBudget}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

interface ClaimantCellProps {
  readonly kind: "worker binding" | "client identity";
  readonly claimantId: string;
  readonly instanceRuntimeId: string | null;
}

function ClaimantCell({ kind, claimantId, instanceRuntimeId }: ClaimantCellProps) {
  if (kind === "worker binding") {
    return (
      <div className="text-sm">
        <span>{claimantId}</span>
        {instanceRuntimeId !== null && (
          <span className="block text-xs text-muted-foreground">instance {instanceRuntimeId}</span>
        )}
      </div>
    );
  }

  return (
    <div className="text-sm">
      <span>{claimantId}</span>
      <span className="block text-xs text-muted-foreground">external harness</span>
    </div>
  );
}

interface LeaseCellProps {
  readonly lease: { readonly expiresAt: string; readonly renewedAt: string } | null;
  readonly live: boolean;
  readonly leaseExpired: boolean;
}

function LeaseCell({ lease, live, leaseExpired }: LeaseCellProps) {
  if (!live || lease === null) {
    return <span className="text-xs text-muted-foreground">Not live</span>;
  }

  if (leaseExpired) {
    return (
      <div className="flex flex-col gap-1">
        <Badge
          variant="destructive"
          aria-label="Lease expired, no renewal received — Scheduler may declare a loss"
        >
          <AlertTriangleIcon className="size-3" aria-hidden="true" />
          Lease expired — no renewal received
        </Badge>
        <span className="text-xs text-muted-foreground">
          Expired {relativeTime(lease.expiresAt)}
        </span>
        <span className="text-xs text-muted-foreground">
          Last renewal {relativeTime(lease.renewedAt)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs">Expires {relativeTime(lease.expiresAt)}</span>
      <span className="text-xs text-muted-foreground">Renewed {relativeTime(lease.renewedAt)}</span>
    </div>
  );
}

interface BudgetCellProps {
  readonly turnsUsed: number;
  readonly turnBudget: number;
  readonly turnPct: number;
  readonly turnOverBudget: boolean;
  readonly wallTimeUsedSeconds: number;
  readonly wallTimeBudgetSeconds: number;
  readonly wallTimePct: number;
  readonly wallTimeOverBudget: boolean;
}

function BudgetCell({
  turnsUsed,
  turnBudget,
  turnPct,
  turnOverBudget,
  wallTimeUsedSeconds,
  wallTimeBudgetSeconds,
  wallTimePct,
  wallTimeOverBudget,
}: BudgetCellProps) {
  return (
    <div className="flex flex-col gap-2 text-xs">
      <div>
        <div className="flex justify-between gap-2">
          <span className={turnOverBudget ? "font-medium text-amber-600" : "text-muted-foreground"}>
            Turns
          </span>
          <span className={turnOverBudget ? "font-medium text-amber-600" : ""}>
            {turnsUsed} / {turnBudget}
          </span>
        </div>
        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${turnOverBudget ? "bg-amber-500" : "bg-primary"}`}
            style={{ width: `${turnPct}%` }}
            role="progressbar"
            aria-valuenow={turnPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Turns used: ${turnsUsed} of ${turnBudget}`}
          />
        </div>
      </div>
      <div>
        <div className="flex justify-between gap-2">
          <span
            className={wallTimeOverBudget ? "font-medium text-amber-600" : "text-muted-foreground"}
          >
            Wall time
          </span>
          <span className={wallTimeOverBudget ? "font-medium text-amber-600" : ""}>
            {duration(wallTimeUsedSeconds)} / {duration(wallTimeBudgetSeconds)}
          </span>
        </div>
        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${wallTimeOverBudget ? "bg-amber-500" : "bg-primary"}`}
            style={{ width: `${wallTimePct}%` }}
            role="progressbar"
            aria-valuenow={wallTimePct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Wall time used: ${duration(wallTimeUsedSeconds)} of ${duration(wallTimeBudgetSeconds)}`}
          />
        </div>
      </div>
    </div>
  );
}
