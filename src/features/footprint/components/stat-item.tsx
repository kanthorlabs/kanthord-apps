import { TriangleAlertIcon } from "lucide-react";

import type { FootprintStat } from "@/api/types";
import { DataListItem, type DataListSelect } from "@/components/data-list-item";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ALERT_STATE_LABELS } from "@/lib/footprint";
import { measureErrorText, staleText, statFacts, statTitle } from "../stat-facts";

interface StatItemProps {
  readonly stat: FootprintStat;
  readonly now: number;
  readonly select?: DataListSelect;
}

export function StatItem({ stat, now, select }: StatItemProps) {
  const label = ALERT_STATE_LABELS[stat.alert.state];
  const notices = [staleText(stat, now), measureErrorText(stat)].filter(
    (text): text is string => text !== null,
  );
  return (
    <DataListItem
      title={statTitle(stat)}
      status={
        label === null ? undefined : (
          <Badge variant={stat.alert.state === "firing" ? "destructive" : "secondary"}>
            {label}
          </Badge>
        )
      }
      fields={statFacts(stat, now)}
      notice={
        notices.length === 0 ? undefined : (
          <div className="flex flex-col gap-2">
            {notices.map((text) => (
              <Alert key={text}>
                <TriangleAlertIcon aria-hidden="true" />
                <AlertDescription>{text}</AlertDescription>
              </Alert>
            ))}
          </div>
        )
      }
      select={select}
    />
  );
}
