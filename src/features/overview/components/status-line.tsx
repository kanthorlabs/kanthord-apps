import { Link } from "react-router-dom";

import { RecordName } from "@/components/record-name";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription } from "@/components/ui/item";
import { utcDateTime } from "@/lib/format";
import { statusLineText, type CoolingFact } from "@/lib/overview-summary";

interface StatusLineProps {
  readonly running: number;
  readonly waiting: number;
  readonly schedulerPath: string;
  readonly cooling: readonly CoolingFact[];
  readonly showProject: boolean;
}

export function StatusLine({
  running,
  waiting,
  schedulerPath,
  cooling,
  showProject,
}: StatusLineProps) {
  return (
    <Item variant="muted" size="sm">
      <ItemContent>
        <ItemDescription>{statusLineText(running, waiting)}</ItemDescription>
        {cooling.map((fact) => (
          <ItemDescription key={fact.key} className="line-clamp-none">
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
          </ItemDescription>
        ))}
      </ItemContent>
      <ItemActions>
        <Button
          nativeButton={false}
          render={<Link to={schedulerPath} />}
          variant="outline"
          size="sm"
        >
          Open scheduler
        </Button>
      </ItemActions>
    </Item>
  );
}
