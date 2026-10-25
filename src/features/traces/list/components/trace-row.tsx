import { useNavigate } from "react-router-dom";

import type { TraceListItem, TraceState } from "@/api/types";
import { DataListItem } from "@/components/data-list-item";
import { Badge } from "@/components/ui/badge";
import { TraceFacts } from "./trace-facts";
import { rowCauseLineOf } from "@/lib/trace-cause";
import { traceFactsOf } from "@/lib/trace-facts";

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
      notice={<TraceFacts facts={traceFactsOf(trace)} />}
      select={{
        label: `Open trace ${title}`,
        disabled: false,
        onSelect: () => navigate(`/traces/${encodeURIComponent(trace.trace_id)}`),
      }}
    />
  );
}
