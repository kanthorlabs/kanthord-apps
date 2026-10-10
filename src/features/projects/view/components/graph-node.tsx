import { ListChecksIcon } from "lucide-react";
import { Fragment } from "react";

import type { MissionRunnableNode, MissionTaskNode } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ObjectiveProgress } from "@/lib/mission-graph";
import { badgeVariantOf } from "@/lib/node-state";

interface GraphNodeProps {
  readonly node: MissionRunnableNode;
  readonly tasks: readonly MissionTaskNode[];
  readonly dependsOn: readonly string[];
  readonly progress: ObjectiveProgress | null;
  readonly selectedId: string | null;
  readonly onSelect: (nodeId: string) => void;
}

export function GraphNode({
  node,
  tasks,
  dependsOn,
  progress,
  selectedId,
  onSelect,
}: GraphNodeProps) {
  const selected = node.id === selectedId;

  return (
    <div
      className={`w-full rounded-xl ${selected ? "outline-2 outline-offset-2 outline-primary" : ""}`}
    >
      <Card size="sm" className="h-full">
        <CardContent className="gap-2">
          <Button
            variant="link"
            size="sm"
            className="max-w-full justify-start self-start"
            aria-current={selected ? "true" : undefined}
            onClick={() => onSelect(node.id)}
          >
            <span className="truncate">{node.content.name}</span>
          </Button>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Badge variant="outline">{node.kind}</Badge>
            <Badge variant={badgeVariantOf(node.state)}>{node.state}</Badge>
            {node.attempt > 0 && <span>attempt {node.attempt}</span>}
            {node.priority !== 0 && <span>priority {node.priority}</span>}
          </div>
          {dependsOn.length > 0 && (
            <p className="text-xs break-words text-muted-foreground">
              Depends on:{" "}
              {dependsOn.map((name, index) => (
                <Fragment key={name}>
                  {index > 0 && ", "}
                  <RecordName>{name}</RecordName>
                </Fragment>
              ))}
            </p>
          )}
          {progress !== null && (
            <p className="text-xs text-muted-foreground">
              Objectives: {progress.terminal} of {progress.total} terminal
            </p>
          )}
          {tasks.length > 0 && (
            <section className="flex flex-col gap-1 border-t pt-2">
              <h4 className="text-xs font-medium text-muted-foreground">
                Tasks <span className="tabular-nums">({tasks.length})</span>
              </h4>
              <ul aria-label={`Tasks of ${node.content.name}`} className="flex flex-col gap-1">
                {tasks.map((task) => (
                  <li key={task.id} className="flex min-w-0">
                    <Button
                      variant="ghost"
                      size="xs"
                      className="max-w-full justify-start"
                      aria-current={task.id === selectedId ? "true" : undefined}
                      onClick={() => onSelect(task.id)}
                    >
                      <ListChecksIcon aria-hidden="true" data-icon="inline-start" />
                      <span className="truncate">{task.content.name}</span>
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
