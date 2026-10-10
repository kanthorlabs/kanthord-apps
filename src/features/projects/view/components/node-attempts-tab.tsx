import { ChevronDownIcon } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RevealPanel } from "@/components/reveal";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { utcDateTime } from "@/lib/format";
import type { GraphModel } from "@/lib/mission-graph";
import { useNodeAttempts } from "../use-node-attempts";
import { AttemptRecords } from "./attempt-records";
import { ActorLabel } from "./actor-label";

interface NodeAttemptsTabProps {
  readonly projectId: string;
  readonly model: GraphModel;
  readonly nodeId: string;
  readonly currentRevision: number;
}

export function NodeAttemptsTab({
  projectId,
  model,
  nodeId,
  currentRevision,
}: NodeAttemptsTabProps) {
  const attempts = useNodeAttempts(nodeId);

  if (attempts.loading) return <Skeleton className="h-32 w-full" />;
  if (attempts.data === null) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-col items-start gap-2">
          {attempts.error?.message}
          <Button variant="outline" size="sm" onClick={attempts.reload}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (attempts.data.length === 0) {
    return <p className="text-sm text-muted-foreground">No attempt of this node opened.</p>;
  }

  return (
    <ItemGroup aria-label="Attempts" className="gap-3">
      {attempts.data.map((attempt) => (
        <Collapsible key={attempt.attempt} role="listitem" className="flex flex-col">
          <Item variant="outline" size="sm">
            <ItemContent className="min-w-0">
              <ItemTitle className="w-full flex-wrap">
                Attempt {attempt.attempt}
                <Badge variant={attempt.closed_at === null ? "default" : "outline"}>
                  {attempt.closed_at === null ? "open" : "closed"}
                </Badge>
              </ItemTitle>
              <ItemDescription className="flex flex-col gap-0.5">
                <span>Pins revision {attempt.node_revision}</span>
                <span className="break-all">
                  Opened by <ActorLabel actor={attempt.opened_by} />,{" "}
                  {utcDateTime(attempt.opened_at)}
                </span>
                {attempt.closed_at !== null && <span>Closed {utcDateTime(attempt.closed_at)}</span>}
              </ItemDescription>
            </ItemContent>
            <CollapsibleTrigger
              render={<Button variant="outline" size="sm" />}
              aria-label={`Records of attempt ${attempt.attempt}`}
            >
              <ChevronDownIcon aria-hidden="true" data-icon="inline-start" />
              Records
            </CollapsibleTrigger>
          </Item>
          <RevealPanel>
            <div className="pt-3">
              <AttemptRecords
                projectId={projectId}
                model={model}
                attempt={attempt}
                currentRevision={currentRevision}
              />
            </div>
          </RevealPanel>
        </Collapsible>
      ))}
    </ItemGroup>
  );
}
