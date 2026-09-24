import { Link } from "react-router-dom";

import type { BlockedNode, Execution, Overview, StateTally } from "@/api/types";
import type { ApiError } from "@/api/errors";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { meaningOf, stateClasses } from "@/lib/node-state";
import { useOverview } from "./use-overview";

function SectionSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-4 w-52" />
    </div>
  );
}

function ErrorMessage({ error, reload }: { error: ApiError; reload: () => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-destructive">{error.message}</p>
      <Button variant="outline" size="sm" onClick={reload}>
        Retry
      </Button>
    </div>
  );
}

function BlockedSection({
  data,
  loading,
  error,
  reload,
}: {
  data: readonly BlockedNode[] | null;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold leading-none">Needs a human</h2>
        <p className="text-sm text-muted-foreground">
          A blocked node is the only item on this dashboard that waits on a person.
        </p>
      </CardHeader>
      <CardContent>
        {loading && <SectionSkeleton />}
        {!loading && error !== null && <ErrorMessage error={error} reload={reload} />}
        {!loading && error === null && data !== null && (
          <>
            {data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No blocked nodes.</p>
            ) : (
              <ul className="space-y-3">
                {data.map((item) => (
                  <li key={item.node.id} className="space-y-0.5">
                    <Link
                      to={`/mission/${item.node.id}`}
                      className="text-sm font-medium underline-offset-4 hover:underline"
                    >
                      {item.node.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {item.closedAttempt.outcome?.stoppingReason ?? item.condition}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {data.length > 0 && (
              <div className="mt-4">
                <Link
                  to="/blocked"
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  View all blocked nodes ({data.length})
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function RunningSection({
  data,
  loading,
  error,
  reload,
}: {
  data: readonly Execution[] | null;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold leading-none">Running</h2>
      </CardHeader>
      <CardContent>
        {loading && <SectionSkeleton />}
        {!loading && error !== null && <ErrorMessage error={error} reload={reload} />}
        {!loading && error === null && data !== null && (
          <>
            {data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No live executions.</p>
            ) : (
              <ul className="space-y-2">
                {data.map((exec) => (
                  <li key={exec.id} className="flex flex-col gap-0.5 text-sm">
                    <span className="font-medium">{exec.nodeTitle}</span>
                    <span className="text-muted-foreground">{exec.claimantId}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4">
              <Link
                to="/executions"
                className="text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                View executions
              </Link>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TallySection({
  tallies,
  loading,
  error,
  reload,
}: {
  tallies: readonly StateTally[];
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <h2 className="font-semibold leading-none">Mission states</h2>
      </CardHeader>
      <CardContent>
        {loading && <SectionSkeleton />}
        {!loading && error !== null && <ErrorMessage error={error} reload={reload} />}
        {!loading && error === null && (
          <ul className="space-y-1.5">
            {tallies.map((tally) => (
              <li key={tally.state} className="flex items-center gap-3">
                <Link to="/mission" className="flex items-center gap-3 group">
                  <span
                    className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${stateClasses(tally.state)}`}
                    title={meaningOf(tally.state)}
                  >
                    {tally.state}
                  </span>
                  <span className="tabular-nums text-sm font-semibold">{tally.count}</span>
                </Link>
              </li>
            ))}
            {tallies.length === 0 && (
              <li>
                <p className="text-sm text-muted-foreground">No nodes.</p>
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CapacitySection({
  data,
  loading,
  error,
  reload,
}: {
  data: Overview | null;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardHeader>
          <h2 className="font-semibold leading-none">Instances</h2>
        </CardHeader>
        <CardContent>
          {loading && <Skeleton className="h-8 w-24" />}
          {!loading && error !== null && <ErrorMessage error={error} reload={reload} />}
          {!loading && error === null && data !== null && (
            <p className="text-2xl font-bold tabular-nums">
              {data.instancesHealthy}
              <span className="text-base font-normal text-muted-foreground">
                {" "}
                / {data.instanceCapacity}
              </span>
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="font-semibold leading-none">Inbox depth</h2>
        </CardHeader>
        <CardContent>
          {loading && <Skeleton className="h-8 w-16" />}
          {!loading && error !== null && <ErrorMessage error={error} reload={reload} />}
          {!loading && error === null && data !== null && (
            <p className="text-2xl font-bold tabular-nums">{data.inboxDepth}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function OverviewScreen() {
  const { overview, blocked, liveExecutions, orderedTallies } = useOverview();

  return (
    <div className="grid gap-4">
      <BlockedSection
        data={blocked.data}
        loading={blocked.loading}
        error={blocked.error}
        reload={blocked.reload}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <RunningSection
          data={liveExecutions.data}
          loading={liveExecutions.loading}
          error={liveExecutions.error}
          reload={liveExecutions.reload}
        />
        <TallySection
          tallies={orderedTallies}
          loading={overview.loading}
          error={overview.error}
          reload={overview.reload}
        />
      </div>
      <CapacitySection
        data={overview.data}
        loading={overview.loading}
        error={overview.error}
        reload={overview.reload}
      />
    </div>
  );
}
