import { Link } from "react-router-dom";

import { RecordName } from "@/components/record-name";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import type { BoardSummary as Summary } from "@/lib/board-text";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";
import { utcDateTime } from "@/lib/format";
import type { CoolingFact } from "@/lib/overview-summary";

interface BoardSummaryProps {
  readonly summary: Summary;
  readonly widthClass: BoardWidth;
  readonly startSubject: string | null;
  readonly workforce: string;
  readonly cooling: readonly CoolingFact[];
  readonly showProject: boolean;
  readonly onStart: () => void;
}

interface SummaryParts {
  readonly before: string;
  readonly after: string;
}

function partsOf(text: string, subject: string | null): SummaryParts | null {
  if (subject === null) return null;
  const marker = `: ${subject}`;
  const at = text.lastIndexOf(marker);
  if (at < 0) return null;
  return {
    before: text.slice(0, at + 2),
    after: text.slice(at + marker.length),
  };
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
  const parts = partsOf(text, startSubject);

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
          <Link to={`/agents/${encodeURIComponent(fact.agent)}`} className="underline">
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
