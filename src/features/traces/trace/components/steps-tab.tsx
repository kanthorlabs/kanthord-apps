import { ArrowLeftIcon } from "lucide-react";

import type { TraceSpan, TraceState } from "@/api/types";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";

import { useLargeScreen } from "../use-large-screen";
import { useTimeline } from "../use-timeline";
import type { TraceSelection } from "../use-trace-selection";
import { SpanDetail } from "./span-detail";
import { SpanTree } from "./span-tree";
import { TimelineToolbar } from "./timeline-toolbar";

interface StepsTabProps {
  readonly traceId: string;
  readonly spans: readonly TraceSpan[];
  readonly traceState: TraceState;
  readonly selection: TraceSelection;
}

export function StepsTab({ traceId, spans, traceState, selection }: StepsTabProps) {
  const timeline = useTimeline(spans, selection);
  const large = useLargeScreen();
  const { selected } = timeline;
  const detail =
    selected === null ? null : (
      <SpanDetail
        key={selected.span_id}
        traceId={traceId}
        span={selected}
        spans={spans}
        onSelect={selection.selectSpan}
      />
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
          <TouchTarget>
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => selection.selectSpan(null)}
            >
              <ArrowLeftIcon aria-hidden="true" data-icon="inline-start" />
              Back to steps
            </Button>
          </TouchTarget>
          {detail}
        </section>
      )}
    </div>
  );
}
