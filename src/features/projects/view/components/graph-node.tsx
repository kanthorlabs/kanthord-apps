import type { MissionRunnableNode, MissionTaskNode } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { ObjectiveProgress } from "@/lib/mission-graph";
import { badgeVariantOf } from "@/lib/node-state";
import { GRAPH_NODE_ATTRIBUTE } from "../use-edge-geometry";

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
  const width = node.kind === "initiative" ? "w-full sm:w-80" : "w-full sm:w-64";

  return (
    <div
      {...{ [GRAPH_NODE_ATTRIBUTE]: node.id }}
      className={`${width} rounded-xl ${selected ? "outline-2 outline-offset-2 outline-primary" : ""}`}
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
              Depends on: {dependsOn.join(", ")}
            </p>
          )}
          {progress !== null && (
            <p className="text-xs text-muted-foreground">
              Objectives: {progress.terminal} of {progress.total} terminal
            </p>
          )}
          {tasks.length > 0 && (
            <ul
              aria-label={`Tasks of ${node.content.name}`}
              className="flex flex-col gap-1 border-t pt-2"
            >
              {tasks.map((task) => (
                <li key={task.id} className="flex min-w-0">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="max-w-full justify-start"
                    aria-current={task.id === selectedId ? "true" : undefined}
                    onClick={() => onSelect(task.id)}
                  >
                    <span className="truncate">{task.content.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
