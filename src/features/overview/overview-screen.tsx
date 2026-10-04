import { Link } from "react-router-dom";

import type { BlockedNode, Execution, Overview, StateTally } from "@/api/types";
import type { ApiError } from "@/api/errors";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { badgeVariantOf } from "@/lib/node-state";
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
  projectId,
  data,
  loading,
  error,
  reload,
}: {
  projectId: string;
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
              <ItemGroup aria-label="Blocked nodes" className="gap-2">
                {data.map((item) => (
                  <Item key={item.node.id} role="listitem" variant="outline" size="sm">
                    <ItemContent className="min-w-0">
                      <ItemTitle>
                        <Link
                          to={`/projects/${projectId}`}
                          className="break-words underline-offset-4 hover:underline"
                        >
                          {item.node.title}
                        </Link>
                      </ItemTitle>
                      <p className="text-sm break-words text-muted-foreground">
                        {item.closedAttempt.outcome?.stoppingReason ?? item.condition}
                      </p>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
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
              <ItemGroup aria-label="Live executions" className="gap-2">
                {data.map((exec) => (
                  <Item key={exec.id} role="listitem" variant="outline" size="sm">
                    <ItemContent className="min-w-0">
                      <ItemTitle>{exec.nodeTitle}</ItemTitle>
                      <p className="text-sm break-all text-muted-foreground">{exec.claimantId}</p>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            )}
            <Button
              nativeButton={false}
              render={<Link to="/executions" />}
              variant="outline"
              size="sm"
              className="mt-4"
            >
              View executions
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TallySection({
  projectId,
  tallies,
  loading,
  error,
  reload,
}: {
  projectId: string;
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
          <>
            {tallies.length === 0 ? (
              <p className="text-sm text-muted-foreground">No nodes.</p>
            ) : (
              <ItemGroup aria-label="Node states" className="gap-1">
                {tallies.map((tally) => (
                  <div key={tally.state} role="listitem">
                    <Item render={<Link to={`/projects/${projectId}`} />} size="sm">
                      <ItemMedia>
                        <Badge variant={badgeVariantOf(tally.state)}>{tally.state}</Badge>
                      </ItemMedia>
                      <ItemContent>
                        <span className="tabular-nums">{tally.count}</span>
                      </ItemContent>
                    </Item>
                  </div>
                ))}
              </ItemGroup>
            )}
          </>
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
  const { projectId, overview, blocked, liveExecutions, orderedTallies } = useOverview();

  return (
    <div className="grid gap-4">
      <BlockedSection
        projectId={projectId}
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
          projectId={projectId}
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
