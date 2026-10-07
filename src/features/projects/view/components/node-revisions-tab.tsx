import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { utcDateTime } from "@/lib/format";
import { actorText } from "@/lib/mission-labels";
import { useNodeRevisions } from "../use-node-revisions";

interface NodeRevisionsTabProps {
  readonly nodeId: string;
  readonly currentRevision: number;
}

export function NodeRevisionsTab({ nodeId, currentRevision }: NodeRevisionsTabProps) {
  const revisions = useNodeRevisions(nodeId);

  if (revisions.loading) return <Skeleton className="h-32 w-full" />;
  if (revisions.data === null) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-col items-start gap-2">
          {revisions.error?.message}
          <Button variant="outline" size="sm" onClick={revisions.reload}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <ItemGroup aria-label="Revisions">
      {revisions.data.map((revision) => (
        <Item key={revision.revision} variant="outline" size="sm" role="listitem">
          <ItemContent className="min-w-0">
            <ItemTitle className="w-full flex-wrap">
              Revision {revision.revision}
              <Badge variant="outline">{revision.change.write}</Badge>
              {revision.revision === currentRevision && <Badge variant="secondary">current</Badge>}
            </ItemTitle>
            <ItemDescription className="flex flex-col gap-0.5">
              <span className="break-words text-foreground">{revision.reason}</span>
              <span className="break-all">
                {actorText(revision.actor)}, {utcDateTime(revision.created_at)}
              </span>
              {revision.change.changed_fields.length > 0 && (
                <span className="break-words">
                  Changed: {revision.change.changed_fields.join(", ")}
                </span>
              )}
              {revision.change.tasks?.map((task) => (
                <span key={task.id} className="break-all">
                  Task {task.id}: {task.change}
                </span>
              ))}
              <span>
                {revision.pinned_by_attempts.length === 0
                  ? "No attempt pins this revision."
                  : `Pinned by ${revision.pinned_by_attempts.map((attempt) => `attempt ${attempt}`).join(", ")}.`}
              </span>
            </ItemDescription>
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}
