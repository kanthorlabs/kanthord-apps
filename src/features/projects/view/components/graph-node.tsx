import { ListChecksIcon } from "lucide-react";
import { Fragment } from "react";

import type { MissionNodeRecord } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { badgeVariantOf } from "@/lib/node-state";

interface GraphNodeProps {
  readonly node: MissionNodeRecord;
  readonly dependsOn: readonly string[];
  readonly selectedId: string | null;
  readonly onSelect: (nodeId: string) => void;
}

export function GraphNode({ node, dependsOn, selectedId, onSelect }: GraphNodeProps) {
  const selected = node.id === selectedId;
  const tasks = node.intent === "implement" ? node.tasks : [];

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
            <Badge variant="outline">{node.intent}</Badge>
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
                      onClick={() => onSelect(node.id)}
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
