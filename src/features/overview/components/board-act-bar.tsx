import { Link } from "react-router-dom";

import { DisabledAction } from "@/components/disabled-action";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";

import { type BoardAct, useBoardActs } from "./board-acts";
import { CheckBadge } from "./check-badge";
import { ResumeProjectAction } from "./resume-project-action";

function ActControl({ act }: { readonly act: BoardAct }) {
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
            reason={act.need}
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

export function BoardActBar() {
  const { acts, needs, read } = useBoardActs();
  if (acts.length === 0) return null;

  return (
    <div role="group" aria-label="Acts" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {acts.map((act) => (
          <ActControl key={act.id} act={act} />
        ))}
      </div>
      {needs.map((need) => (
        <p key={need} className="text-sm text-muted-foreground">
          {need}
        </p>
      ))}
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
