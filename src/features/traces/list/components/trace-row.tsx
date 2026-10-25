import { useNavigate } from "react-router-dom";

import type { TraceState, TraceSummary } from "@/api/types";
import { DataListItem, type DataListField } from "@/components/data-list-item";
import { Badge } from "@/components/ui/badge";
import { durationText, utcDateTime } from "@/lib/format";
import { costText, tokenText } from "@/lib/trace-format";

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

function pathOf(trace: TraceSummary): string {
  const base = `/traces/${encodeURIComponent(trace.trace_id)}`;
  if (trace.first_error_span_id === null) return base;
  return `${base}?tab=span_tree&span=${encodeURIComponent(trace.first_error_span_id)}`;
}

function fieldsOf(trace: TraceSummary): readonly DataListField[] {
  const fields: DataListField[] = [];
  if (trace.worker_name !== null) fields.push({ label: "Worker", value: trace.worker_name });
  if (trace.agent_names.length > 0) {
    fields.push({ label: "Agent", value: trace.agent_names.join(", ") });
  }
  if (trace.models.length > 0) fields.push({ label: "Model", value: trace.models.join(", ") });
  if (trace.started_at !== null) {
    fields.push({ label: "Started", value: utcDateTime(trace.started_at) });
  }
  fields.push(
    {
      label: "Duration",
      value: trace.duration_ms === null ? "running" : durationText(trace.duration_ms),
    },
    { label: "Tokens", value: tokenText(trace.total_tokens) },
    { label: "Est. cost", value: costText(trace.cost_usd) },
    { label: "Turns", value: trace.turn_count },
    { label: "Tools", value: trace.tool_count },
    { label: "Errors", value: trace.error_count },
  );
  return fields;
}

interface TraceRowProps {
  readonly trace: TraceSummary;
  readonly title: string;
}

export function TraceRow({ trace, title }: TraceRowProps) {
  const navigate = useNavigate();
  const badge = STATE_BADGES[trace.state];
  return (
    <DataListItem
      title={title}
      status={
        <>
          <Badge variant={badge.variant}>{badge.label}</Badge>
          {trace.stop_reason !== null && <Badge variant="outline">{trace.stop_reason}</Badge>}
        </>
      }
      fields={fieldsOf(trace)}
      select={{
        label: `Open trace ${title}`,
        disabled: false,
        onSelect: () => navigate(pathOf(trace)),
      }}
    />
  );
}
