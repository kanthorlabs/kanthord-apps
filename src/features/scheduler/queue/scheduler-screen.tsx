import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
          <h2 className="text-lg font-semibold">Work queue</h2>
          <p className="text-xs text-muted-foreground">
            Ordered by priority, highest first. Within one priority, older work runs first — newer
            work never overtakes it.
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
        <p className="text-sm text-muted-foreground">No entries match the current filter.</p>
      )}

      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Node</TableHead>
              <TableHead>Claim kind</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue.filtered.map((entry) => (
              <TableRow
                key={entry.id}
                className="cursor-pointer"
                onClick={() => queue.select(entry.id)}
              >
                <TableCell>
                  <Link
                    to={`/mission/${entry.nodeId}`}
                    className="text-primary hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {entry.nodeTitle}
                  </Link>
                </TableCell>
                <TableCell>{entry.admittedClaimKind}</TableCell>
                <TableCell>{entry.priority}</TableCell>
                <TableCell>{relativeTime(entry.createdAt)}</TableCell>
                <TableCell>
                  {entry.heldOut ? (
                    <div className="space-y-1">
                      <Badge variant="destructive">Held out</Badge>
                      {entry.waitFact !== null && (
                        <p className="text-xs text-muted-foreground">Waits for: {entry.waitFact}</p>
                      )}
                    </div>
                  ) : (
                    <Badge variant="secondary">Eligible</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {queue.filtered.map((entry) => (
          <Card key={entry.id}>
            <CardContent className="flex flex-col gap-2 py-4">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to={`/mission/${entry.nodeId}`}
                  className="font-medium text-primary hover:underline"
                >
                  {entry.nodeTitle}
                </Link>
                {entry.heldOut ? (
                  <Badge variant="destructive">Held out</Badge>
                ) : (
                  <Badge variant="secondary">Eligible</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>{entry.admittedClaimKind}</span>
                <span>Priority {entry.priority}</span>
                <span>{relativeTime(entry.createdAt)}</span>
              </div>
              {entry.heldOut && entry.waitFact !== null && (
                <p className="text-sm font-medium text-destructive">Waits for: {entry.waitFact}</p>
              )}
              <button
                type="button"
                className="mt-1 self-start text-xs text-primary underline-offset-2 hover:underline"
                onClick={() => queue.select(entry.id)}
                aria-label={`Show eligibility for ${entry.nodeTitle}`}
              >
                Why is this not running?
              </button>
            </CardContent>
          </Card>
        ))}
      </div>

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
