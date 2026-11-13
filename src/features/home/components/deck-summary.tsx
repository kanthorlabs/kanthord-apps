import { Link } from "react-router-dom";

import { RecordName } from "@/components/record-name";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import { summaryPartsOf } from "@/lib/board-summary-parts";
import type { BoardSummary } from "@/lib/board-text";
import { utcDateTime } from "@/lib/format";
import type { CoolingFact } from "@/lib/overview-summary";
import { agentPath } from "@/lib/workbench-sessions";

interface DeckSummaryProps {
  readonly summary: BoardSummary;
  readonly startSubject: string | null;
  readonly workforce: string;
  readonly cooling: readonly CoolingFact[];
  readonly onStart: () => void;
}

export function DeckSummary({
  summary,
  startSubject,
  workforce,
  cooling,
  onStart,
}: DeckSummaryProps) {
  const parts = summaryPartsOf(summary.long, startSubject);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="text-sm break-words">
        {parts === null || startSubject === null ? (
          summary.long
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
          in <RecordName>{fact.binding}</RecordName> of <RecordName>{fact.project.name}</RecordName>
          : every model cools down until {utcDateTime(fact.availableAt)}.
        </p>
      ))}
    </div>
  );
}
