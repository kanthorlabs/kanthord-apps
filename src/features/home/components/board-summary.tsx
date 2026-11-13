import { Link } from "react-router-dom";

import { RecordName } from "@/components/record-name";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import { summaryPartsOf } from "@/lib/board-summary-parts";
import type { BoardSummary as Summary } from "@/lib/board-text";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";
import { utcDateTime } from "@/lib/format";
import type { CoolingFact } from "@/lib/overview-summary";
import { agentPath } from "@/lib/workbench-sessions";

interface BoardSummaryProps {
  readonly summary: Summary;
  readonly widthClass: BoardWidth;
  readonly startSubject: string | null;
  readonly workforce: string;
  readonly cooling: readonly CoolingFact[];
  readonly showProject: boolean;
  readonly onStart: () => void;
}

export function BoardSummary({
  summary,
  widthClass,
  startSubject,
  workforce,
  cooling,
  showProject,
  onStart,
}: BoardSummaryProps) {
  const text = widthClass === BOARD_WIDTH.Compact ? summary.short : summary.long;
  const parts = summaryPartsOf(text, startSubject);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="text-sm break-words">
        {parts === null || startSubject === null ? (
          text
        ) : (
          <>
            {parts.before}
            <TouchTarget>
              <Button variant="link" onClick={onStart}>
                {startSubject}
              </Button>
            </TouchTarget>
            {parts.after}
          </>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{workforce}</p>
      {cooling.map((fact) => (
        <p key={fact.key} className="text-sm break-words text-muted-foreground">
          <Link to={agentPath(fact.agent)} className="underline">
            <RecordName>{fact.agent}</RecordName>
          </Link>{" "}
          in <RecordName>{fact.binding}</RecordName>
          {showProject && (
            <>
              {" "}
              of <RecordName>{fact.project.name}</RecordName>
            </>
          )}
          : every model cools down until {utcDateTime(fact.availableAt)}.
        </p>
      ))}
    </div>
  );
}
