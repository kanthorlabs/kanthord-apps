import { useId } from "react";

import type { WorkbenchActionOffer } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { ACTION_VERBS, type ActionCardItem, type ActionCardState } from "@/lib/workbench-chat";
import { InlineError } from "./inline-error";

interface ActionCardProps {
  readonly item: ActionCardItem;
  readonly canRun: boolean;
  readonly onRun: () => void;
}

const DANGER_OPERATIONS: readonly string[] = ["mission.node.discard", "mission.node.override"];
const FAILED_LINE = "The act failed.";
const STATE_LINES: Readonly<Partial<Record<ActionCardState, string>>> = {
  done: "Done by the owner",
  superseded: "Superseded by a later message",
  unknown: "This act has no card in this dashboard version.",
};

function verbOf(operationId: string): string | null {
  return Object.entries(ACTION_VERBS).find(([id]) => id === operationId)?.[1] ?? null;
}

function seenLineOf(seen: WorkbenchActionOffer["seen"]): string {
  if ("state" in seen) {
    return `Offered when the node was ${seen.state}, attempt ${seen.attempt}`;
  }
  return `Offered when the project was ${seen.paused ? "paused" : "active"}`;
}

export function ActionCard({ item, canRun, onRun }: ActionCardProps) {
  const errorId = useId();
  const { offer, state } = item;
  const verb = verbOf(offer.operation_id);
  const latest = item.results.at(-1);
  const failure = state === "live" && latest?.outcome === "failed" ? latest : null;
  const stateLine = STATE_LINES[state];
  const showButton = canRun && verb !== null && (state === "live" || state === "waiting");
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className={failure === null ? undefined : "rounded-xl border border-destructive"}>
        <Card
          size="sm"
          role="group"
          aria-label="Action"
          aria-describedby={failure === null ? undefined : errorId}
        >
          <CardHeader>
            <h3 className="font-semibold leading-none">Action</h3>
            <p className="min-w-0 font-mono text-sm break-all">{offer.operation_id}</p>
          </CardHeader>
          <CardContent className="grid min-w-0 gap-1 text-sm">
            <p className="text-muted-foreground">{seenLineOf(offer.seen)}</p>
            {stateLine !== undefined && <p>{stateLine}</p>}
          </CardContent>
          {showButton && (
            <CardFooter className="flex sm:justify-end [&>button]:max-sm:w-full">
              <Button
                variant={DANGER_OPERATIONS.includes(offer.operation_id) ? "destructive" : "default"}
                disabled={state === "waiting"}
                onClick={onRun}
              >
                {verb} {offer.target_id}
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
      {failure !== null && (
        <InlineError id={errorId} code={failure.error_code} message={FAILED_LINE} />
      )}
    </div>
  );
}
