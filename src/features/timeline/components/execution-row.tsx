import type { TimelineItem, TraceState } from "@/api/types";
import { DataListItem, type DataListField } from "@/components/data-list-item";
import { Badge } from "@/components/ui/badge";
import { durationText, utcDateTime } from "@/lib/format";
import { spanLabel } from "@/lib/span-labels";
import { executionKindOf, executionStateOf, executionStopReasonOf } from "@/lib/timeline-rows";

import { OpenTraceButton } from "./open-trace-button";

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

interface ExecutionRowProps {
  readonly item: TimelineItem;
  readonly nodeName: string | null;
}

function fieldsOf(item: TimelineItem, nodeName: string | null): readonly DataListField[] {
  const kind = executionKindOf(item);
  const fields: DataListField[] = [];
  if (nodeName !== null) fields.push({ label: "Node", value: nodeName });
  if (kind !== null) fields.push({ label: "Kind", value: kind });
  if (item.worker_name !== null) fields.push({ label: "Worker", value: item.worker_name });
  if (item.start_time !== null) {
    fields.push({ label: "Started", value: utcDateTime(item.start_time) });
  }
  fields.push({
    label: "Duration",
    value: item.duration_ms === null ? "running" : durationText(item.duration_ms),
  });
  return fields;
}

export function ExecutionRow({ item, nodeName }: ExecutionRowProps) {
  const badge = STATE_BADGES[executionStateOf(item)];
  const stopReason = executionStopReasonOf(item);
  const label = spanLabel(item);
  return (
    <DataListItem
      title={item.attempt === null ? label : `${label} attempt ${item.attempt}`}
      status={
        <>
          <Badge variant={badge.variant}>{badge.label}</Badge>
          {stopReason !== null && <Badge variant="outline">{stopReason}</Badge>}
        </>
      }
      fields={fieldsOf(item, nodeName)}
      actions={<OpenTraceButton traceId={item.trace_id} />}
    />
  );
}
