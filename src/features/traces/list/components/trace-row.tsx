import { useNavigate } from "react-router-dom";

import type { TraceListItem, TraceState } from "@/api/types";
import { DataListItem, type DataListField } from "@/components/data-list-item";
import { Badge } from "@/components/ui/badge";
import { durationText, utcDateTime } from "@/lib/format";
import { rowCauseLineOf } from "@/lib/trace-cause";
import { costText } from "@/lib/trace-format";

const STATE_BADGES: Readonly<
  Record<
    TraceState,
    { readonly label: string; readonly variant: "secondary" | "outline" | "destructive" }
  >
> = {
  open: { label: "Open", variant: "secondary" },
  ok: { label: "OK", variant: "outline" },
  error: { label: "Error", variant: "destructive" },
};

function fieldsOf(trace: TraceListItem): readonly DataListField[] {
  const fields: DataListField[] = [];
  if (trace.worker_name !== null) fields.push({ label: "Worker", value: trace.worker_name });
  if (trace.attempt !== null) fields.push({ label: "Attempt", value: trace.attempt });
  fields.push(
    {
      label: "Duration",
      value: trace.duration_ms === null ? "running" : durationText(trace.duration_ms),
    },
    { label: "Est. cost", value: costText(trace.cost_usd) },
  );
  if (trace.started_at !== null) {
    fields.push({ label: "Started", value: utcDateTime(trace.started_at) });
  }
  fields.push(
    { label: "Turns", value: trace.turn_count },
    { label: "Errors (incl. recovered)", value: trace.error_count },
  );
  return fields;
}

interface TraceRowProps {
  readonly trace: TraceListItem;
  readonly title: string;
  readonly now: number;
}

export function TraceRow({ trace, title, now }: TraceRowProps) {
  const navigate = useNavigate();
  const badge = STATE_BADGES[trace.state];
  return (
    <DataListItem
      title={title}
      status={<Badge variant={badge.variant}>{badge.label}</Badge>}
      description={rowCauseLineOf(trace, now) ?? undefined}
      fields={fieldsOf(trace)}
      select={{
        label: `Open trace ${title}`,
        disabled: false,
        onSelect: () => navigate(`/traces/${encodeURIComponent(trace.trace_id)}`),
      }}
    />
  );
}
