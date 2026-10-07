import { Link } from "react-router-dom";

import type { MissionRunnableNode } from "@/api/types";
import type { ApiError } from "@/api/errors";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { closingEventText } from "@/lib/mission-labels";
import { badgeVariantOf } from "@/lib/node-state";
import { useOverview, type LiveExecution, type StateTally } from "./use-overview";

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
  data: readonly MissionRunnableNode[];
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
        {!loading && error === null && (
          <>
            {data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No blocked nodes.</p>
            ) : (
              <ItemGroup aria-label="Blocked nodes" className="gap-2">
                {data.map((node) => (
                  <Item key={node.id} role="listitem" variant="outline" size="sm">
                    <ItemContent className="min-w-0">
                      <ItemTitle>
                        <Link
                          to={`/projects/${projectId}`}
                          className="break-words underline-offset-4 hover:underline"
                        >
                          {node.content.name}
                        </Link>
                      </ItemTitle>
                      {node.blocked_context !== undefined && (
                        <p className="text-sm break-words text-muted-foreground">
                          {closingEventText(node.blocked_context.outcome.closing_event)}
                        </p>
                      )}
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
  data: readonly LiveExecution[];
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
        {!loading && error === null && (
          <>
            {data.length === 0 ? (
              <p className="text-sm text-muted-foreground">No live executions.</p>
            ) : (
              <ItemGroup aria-label="Live executions" className="gap-2">
                {data.map(({ execution, nodeName }) => (
                  <Item key={execution.execution_id} role="listitem" variant="outline" size="sm">
                    <ItemContent className="min-w-0">
                      <ItemTitle>{nodeName}</ItemTitle>
                      <p className="text-sm break-all text-muted-foreground">
                        {execution.claimant.worker_binding_id}
                      </p>
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

export function OverviewScreen() {
  const { projectId, nodes, blocked, executions, liveExecutions, orderedTallies } = useOverview();

  return (
    <div className="grid gap-4">
      <BlockedSection
        projectId={projectId}
        data={blocked}
        loading={nodes.loading}
        error={nodes.error}
        reload={nodes.reload}
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <RunningSection
          data={liveExecutions}
          loading={executions.loading}
          error={executions.error}
          reload={executions.reload}
        />
        <TallySection
          projectId={projectId}
          tallies={orderedTallies}
          loading={nodes.loading}
          error={nodes.error}
          reload={nodes.reload}
        />
      </div>
    </div>
  );
}
