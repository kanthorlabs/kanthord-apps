import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";

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
      <div>
        <h2 className="text-lg font-semibold">Queue</h2>
        <p className="text-xs text-muted-foreground">
          Jobs in queue order: highest priority first, then the job identity. The order admits no
          claim. The Scheduler rechecks every admission condition at the claim.
        </p>
      </div>

      {queue.entries.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No jobs in the queue.</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}

      {queue.entries.length > 0 && (
        <ItemGroup aria-label="Queue" className="gap-2">
          {queue.entries.map(({ job, nodeName }) => (
            <Item key={job.jobId} role="listitem" variant="outline">
              <ItemContent className="min-w-0">
                <ItemTitle>
                  <Link
                    to={`/projects/${queue.projectId}`}
                    className="underline underline-offset-4"
                  >
                    {nodeName}
                  </Link>
                </ItemTitle>
                <ItemDescription className="break-all">
                  Priority {job.priority} · {job.jobId}
                </ItemDescription>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
    </div>
  );
}
