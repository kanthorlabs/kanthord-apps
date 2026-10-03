import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { relativeTime } from "@/lib/format";

import { EligibilityDialog } from "./eligibility-dialog";
import { useSchedulerQueue } from "./use-scheduler-queue";

export function SchedulerScreen() {
  const queue = useSchedulerQueue();

  if (queue.loading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (queue.error !== null) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <p className="text-sm text-destructive">{queue.error.message}</p>
        <Button variant="outline" size="sm" onClick={queue.reload}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Queue</h2>
          <p className="text-xs text-muted-foreground">
            Jobs in queue order: highest priority first, then the oldest job. The order admits no
            claim. The Scheduler rechecks every admission condition at the claim.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="held-out-filter"
            checked={queue.heldOutOnly}
            onCheckedChange={queue.setHeldOutOnly}
          />
          <Label htmlFor="held-out-filter">Held out only</Label>
        </div>
      </div>

      {queue.filtered.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No jobs match the current filter.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}

      {queue.filtered.length > 0 && (
        <ItemGroup aria-label="Queue" className="gap-2">
          {queue.filtered.map((entry) => (
            <Item key={entry.id} role="listitem" variant="outline">
              <ItemContent className="min-w-0 basis-64">
                <ItemTitle>
                  <Link to={`/mission/${entry.nodeId}`} className="underline underline-offset-4">
                    {entry.nodeTitle}
                  </Link>
                </ItemTitle>
                <ItemDescription>
                  Priority {entry.priority} · {entry.admittedClaimKind} claim · queued{" "}
                  {relativeTime(entry.createdAt)}
                </ItemDescription>
                {entry.heldOut && entry.waitFact !== null && (
                  <p className="text-sm">Waits for: {entry.waitFact}</p>
                )}
              </ItemContent>
              <ItemActions className="flex-wrap">
                {entry.heldOut ? (
                  <Badge variant="destructive">Held out</Badge>
                ) : (
                  <Badge variant="secondary">Claimable</Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queue.select(entry.id)}
                  aria-label={`Show admission conditions for ${entry.nodeTitle}`}
                >
                  Admission conditions
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}

      {queue.selectedEntry !== null && (
        <EligibilityDialog
          nodeId={queue.selectedEntry.nodeId}
          nodeTitle={queue.selectedEntry.nodeTitle}
          onClose={() => queue.select(null)}
        />
      )}
    </div>
  );
}
