import type { TraceSpan, TraceState, TraceSummary } from "@/api/types";
import { useLargeScreen } from "@/hooks/use-large-screen";

import { useNodeRevision } from "../use-node-revision";
import { useTimeline } from "../use-timeline";
import type { TraceSelection } from "../use-trace-selection";
import { SpanDetail } from "./span-detail";
import { SpanLevelHeader } from "./span-level-header";
import { SpanTree } from "./span-tree";
import { TimelineToolbar } from "./timeline-toolbar";

interface StepsTabProps {
  readonly traceId: string;
  readonly summary: TraceSummary;
  readonly spans: readonly TraceSpan[];
  readonly traceState: TraceState;
  readonly selection: TraceSelection;
}

export function StepsTab({ traceId, summary, spans, traceState, selection }: StepsTabProps) {
  const { taskNames } = useNodeRevision(summary);
  const timeline = useTimeline(spans, selection, taskNames);
  const large = useLargeScreen();
  const { selected } = timeline;
  const detail =
    selected === null ? null : (
      <div key={selected.span_id} className="flex min-w-0 flex-col gap-4">
        <SpanLevelHeader
          span={selected}
          usage={timeline.usage.get(selected.span_id)}
          axis={timeline.axis}
          traceState={traceState}
          onBack={large ? null : () => selection.selectSpan(null)}
        />
        <SpanDetail
          traceId={traceId}
          span={selected}
          spans={spans}
          onSelect={selection.selectSpan}
        />
      </div>
    );
  const stacked = !large && detail !== null;
  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
      <div hidden={stacked} className="flex min-w-0 flex-col gap-3">
        <TimelineToolbar timeline={timeline} />
        {timeline.rows.length === 0 ? (
          <p className="text-muted-foreground">
            {timeline.filtered ? "No spans match these filters." : "This trace has no spans."}
          </p>
        ) : (
          <SpanTree
            timeline={timeline}
            traceState={traceState}
            selectedSpanId={selection.span}
            onSelect={selection.selectSpan}
          />
        )}
      </div>
      {large && (
        <aside
          aria-label="Span detail"
          className="sticky top-[calc(var(--app-header-height,3.5rem)+var(--trace-sticky-height,0px)+1rem)] max-h-[calc(100svh-var(--app-header-height,3.5rem)-var(--trace-sticky-height,0px)-2rem)] min-w-0 self-start overflow-y-auto rounded-lg border p-3"
        >
          {detail ?? <p className="text-muted-foreground">Select a span to see its detail.</p>}
        </aside>
      )}
      {stacked && (
        <section aria-label="Span detail" className="flex min-w-0 flex-col gap-3">
          {detail}
        </section>
      )}
    </div>
  );
}
