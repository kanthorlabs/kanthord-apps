import { type Ref, useId } from "react";

import type { ApiError } from "@/api/errors";
import { Button } from "@/components/ui/button";
import { actionFactsOf, actionVerbOf, isDangerOperation } from "@/lib/workbench-action";
import type { ActionCardItem, ActionCardState } from "@/lib/workbench-chat";
import { InlineError } from "./inline-error";

interface ActionCardProps {
  readonly item: ActionCardItem;
  readonly canRun: boolean;
  readonly onRun: () => void;
  readonly reportFailure?: ApiError | null;
  readonly actLine?: string | null;
  readonly groupRef?: Ref<HTMLDivElement>;
}

interface CardError {
  readonly code: string | null;
  readonly message: string;
}

const FAILED_LINE = "The act failed.";
const NOT_RECORDED_LINE = "The result was not recorded.";
const STATE_LINES: Readonly<Partial<Record<ActionCardState, string>>> = {
  done: "Done by the owner",
  superseded: "Superseded by a later message",
  unknown: "This act has no card in this dashboard version.",
};
const BUTTON_LAYOUT = "h-auto min-h-9 py-1.5 text-left whitespace-normal break-all";
const DANGER_FILL = "bg-destructive text-destructive-foreground hover:bg-destructive/90";

export function ActionCard({
  item,
  canRun,
  onRun,
  reportFailure = null,
  actLine = null,
  groupRef,
}: ActionCardProps) {
  const errorId = useId();
  const { offer, state } = item;
  const verb = actionVerbOf(offer.operation_id);
  const danger = isDangerOperation(offer.operation_id);
  const latest = item.results.at(-1);
  const failed = state === "live" && latest?.outcome === "failed" ? latest : null;
  const failure: CardError | null =
    reportFailure !== null
      ? {
          code: reportFailure.detail === "" ? null : reportFailure.detail,
          message: NOT_RECORDED_LINE,
        }
      : actLine !== null
        ? { code: null, message: actLine }
        : failed === null
          ? null
          : { code: failed.error_code, message: FAILED_LINE };
  const stateLine = STATE_LINES[state];
  const showButton = canRun && verb !== null && (state === "live" || state === "waiting");
  const border = danger || failure !== null ? "border-destructive" : "border-primary";
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div
        ref={groupRef}
        role="group"
        aria-label="Action"
        tabIndex={-1}
        aria-describedby={failure === null ? undefined : errorId}
        className={`flex max-w-[92%] min-w-0 flex-col gap-1.5 rounded-md border outline-none bg-card px-3 py-2.5 text-card-foreground ${border}`}
      >
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded-full bg-primary/10 px-2 py-px text-[11.5px] text-primary">
            Action
          </span>
          <span className="min-w-0 font-mono text-[12.5px] font-medium break-all">
            {offer.operation_id}
          </span>
        </div>
        <ul className="list-disc pl-[18px] text-[12.5px]">
          {actionFactsOf(offer).map((fact) => (
            <li key={fact} className="break-all">
              {fact}
            </li>
          ))}
        </ul>
        {stateLine !== undefined && <p className="text-sm">{stateLine}</p>}
        {showButton && (
          <div className="flex justify-start">
            <Button
              disabled={state === "waiting"}
              onClick={onRun}
              className={danger ? `${BUTTON_LAYOUT} ${DANGER_FILL}` : BUTTON_LAYOUT}
            >
              {verb} {offer.target_id}
            </Button>
          </div>
        )}
      </div>
      {failure !== null && (
        <InlineError id={errorId} code={failure.code} message={failure.message} />
      )}
    </div>
  );
}
