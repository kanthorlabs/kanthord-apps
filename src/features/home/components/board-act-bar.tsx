import { useId } from "react";
import { Link } from "react-router-dom";

import { DisabledAction } from "@/components/disabled-action";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import { type BoardAct, moreCountOf, moreNeedsOf, needIdOf, phoneActsOf } from "@/lib/board-acts";

import { useBoardActs, useBoardActsFrame } from "../use-board-acts";
import { BoardMoreSheet } from "./board-more-sheet";
import { CheckBadge } from "./check-badge";
import { ResumeProjectAction } from "./resume-project-action";

type NeedIds = (need: string) => string;

function NeedLine({ need, id }: { readonly need: string; readonly id: string }) {
  return (
    <p id={id} className="text-sm text-muted-foreground">
      {need}
    </p>
  );
}

function ActControl({ act, needIds }: { readonly act: BoardAct; readonly needIds: NeedIds }) {
  switch (act.type) {
    case "button":
      return (
        <TouchTarget>
          <Button
            variant={act.variant}
            size="sm"
            aria-label={act.ariaLabel ?? undefined}
            disabled={act.disabled}
            onClick={act.press}
          >
            {act.label}
          </Button>
        </TouchTarget>
      );
    case "gated":
      return (
        <TouchTarget>
          <DisabledAction
            label={act.label}
            ariaLabel={act.ariaLabel ?? undefined}
            reason={act.reason ?? act.need}
            describedBy={needIds(act.need)}
          />
        </TouchTarget>
      );
    case "link":
      return (
        <TouchTarget>
          <Button nativeButton={false} render={<Link to={act.to} />} variant="outline" size="sm">
            {act.label}
          </Button>
        </TouchTarget>
      );
    case "external":
      return (
        <TouchTarget>
          <Button
            nativeButton={false}
            render={
              <a href={act.href} target="_blank" rel="noreferrer">
                {act.label}
              </a>
            }
            variant="outline"
            size="sm"
          >
            {act.label}
          </Button>
        </TouchTarget>
      );
    case "resume_project":
      return (
        <TouchTarget>
          <ResumeProjectAction item={act.item} reload={act.reload} markActed={act.markActed} />
        </TouchTarget>
      );
    case "badge":
      return <CheckBadge label={act.label} />;
  }
}

function PhoneBar({
  acts,
  subject,
  needIds,
}: {
  readonly acts: readonly BoardAct[];
  readonly subject: string;
  readonly needIds: NeedIds;
}) {
  const phone = phoneActsOf(acts);
  const { lead, others, last, badges } = phone;
  const count = moreCountOf(phone);
  const control = (act: BoardAct) => <ActControl key={act.id} act={act} needIds={needIds} />;
  const sheetNeeds = moreNeedsOf(phone);

  return (
    <>
      <div className="flex items-center gap-2">
        {lead !== null && <div className="flex min-w-0 flex-1 flex-col">{control(lead)}</div>}
        {count > 0 && (
          <BoardMoreSheet subject={subject} count={count} last={last && control(last)}>
            {others.map(control)}
            {sheetNeeds.map((need) => (
              <NeedLine key={need} need={need} id={needIds(need)} />
            ))}
          </BoardMoreSheet>
        )}
        {badges.map(control)}
      </div>
      {lead?.type === "gated" && <NeedLine need={lead.need} id={needIds(lead.need)} />}
    </>
  );
}

export function BoardActBar() {
  const { acts, needs, read, failure, notice } = useBoardActs();
  const base = useId();
  const { subject } = useBoardActsFrame();
  if (acts.length === 0) return null;
  const needIds: NeedIds = (need) => needIdOf(base, needs, need);

  return (
    <div
      role="group"
      aria-label="Acts"
      className="flex flex-col gap-2 pb-[env(safe-area-inset-bottom)]"
    >
      <PhoneBar acts={acts} subject={subject} needIds={needIds} />
      {notice !== null && (
        <p role="status" className="text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      {failure !== null && (
        <div className="flex flex-wrap items-center gap-2">
          <p role="alert" className="text-sm break-words text-destructive">
            {failure.text}
          </p>
          <TouchTarget>
            <Button variant="outline" size="sm" onClick={failure.retry}>
              Retry
            </Button>
          </TouchTarget>
        </div>
      )}
      {read?.failed === true && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm break-words text-destructive">{read.text}</p>
          <TouchTarget>
            <Button variant="outline" size="sm" onClick={read.retry}>
              Retry
            </Button>
          </TouchTarget>
        </div>
      )}
    </div>
  );
}
