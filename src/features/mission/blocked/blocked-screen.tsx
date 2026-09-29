import { Link } from "react-router-dom";

import { listNodes } from "@/api/resources/mission";
import type { BlockedNode, MissionNode } from "@/api/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectId } from "@/features/projects/project-context";
import { useResource } from "@/hooks/use-resource";
import { basisAssessment, basisKind } from "@/lib/outcome-basis";
import { NodeActions } from "./node-actions";
import { useBlocked } from "./use-blocked";

function dependentsOf(
  nodeId: string,
  allNodes: readonly MissionNode[],
): readonly { readonly id: string; readonly title: string }[] {
  return allNodes
    .filter((n) => n.dependsOn.includes(nodeId))
    .map((n) => ({ id: n.id, title: n.title }));
}

function BlockedNodeCard({
  entry,
  allNodes,
  projectId,
  onSuccess,
}: {
  entry: BlockedNode;
  allNodes: readonly MissionNode[];
  projectId: string;
  onSuccess: () => void;
}) {
  const { node, closedAttempt, condition } = entry;
  const { outcome, externalObjects } = closedAttempt;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <Link
              to={`/mission/${node.id}`}
              className="text-base font-semibold underline-offset-4 hover:underline"
            >
              {node.title}
            </Link>
            <p className="text-xs text-muted-foreground capitalize">{node.kind}</p>
          </div>
          <Badge variant="destructive">{condition}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {outcome !== null && (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-foreground">{outcome.stoppingReason}</p>
            </div>

            <dl className="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-2">
              <div className="flex flex-wrap gap-1">
                <dt className="text-muted-foreground">Closing event:</dt>
                <dd>{outcome.closingEvent}</dd>
              </div>
              <div className="flex flex-wrap gap-1">
                <dt className="text-muted-foreground">Asserted result:</dt>
                <dd>{outcome.assertedResult}</dd>
              </div>
              <div className="flex flex-wrap gap-1">
                <dt className="text-muted-foreground">Basis:</dt>
                <dd>{basisKind(basisAssessment(closedAttempt, outcome))}</dd>
              </div>
              <div className="flex flex-wrap gap-1">
                <dt className="text-muted-foreground">Assessment:</dt>
                <dd className="font-mono text-xs">{outcome.assessmentId}</dd>
              </div>
            </dl>
          </div>
        )}

        {externalObjects.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">External actions</p>
            <div className="space-y-2">
              {externalObjects.map((obj) => (
                <div key={obj.id} className="rounded-md border p-3 text-sm space-y-1">
                  <p className="font-medium">{obj.action}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Observed:{" "}
                      <span className="font-medium text-foreground">
                        {obj.observedState ?? "—"}
                      </span>
                    </span>
                    {obj.expectedEndState !== null && (
                      <span>
                        Expected:{" "}
                        <span className="font-medium text-foreground">{obj.expectedEndState}</span>
                      </span>
                    )}
                  </div>
                  {obj.address && (
                    <a
                      href={obj.address}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-primary underline-offset-4 hover:underline"
                    >
                      {obj.label}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <NodeActions
          node={node}
          projectId={projectId}
          dependents={dependentsOf(node.id, allNodes)}
          clearedAttemptId={closedAttempt.id}
          onSuccess={onSuccess}
        />
      </CardContent>
    </Card>
  );
}

export function BlockedScreen() {
  const projectId = useProjectId();
  const { data: blocked, error, loading, reload } = useBlocked();
  const { data: allNodes } = useResource(() => listNodes(projectId), [projectId]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error !== null) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <p className="text-sm text-destructive">{error.message}</p>
        <Button variant="outline" size="sm" onClick={reload}>
          Retry
        </Button>
      </div>
    );
  }

  if (blocked === null || blocked.length === 0) {
    return (
      <div className="p-4">
        <p className="text-sm text-muted-foreground">No blocked nodes.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Alert>
        <AlertDescription>
          Each blocked node closed its attempt on a condition. Unblock to authorize a new attempt,
          or discard if the work is no longer needed.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {blocked.map((entry) => (
          <BlockedNodeCard
            key={entry.node.id}
            entry={entry}
            allNodes={allNodes ?? []}
            projectId={projectId}
            onSuccess={reload}
          />
        ))}
      </div>
    </div>
  );
}
