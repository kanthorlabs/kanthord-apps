import { Link, useParams } from "react-router-dom";

import type { ApiError } from "@/api/errors";
import type { TraceSpan, TraceState } from "@/api/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Conversation } from "./components/conversation";
import { SpanDetail } from "./components/span-detail";
import { SpanTree } from "./components/span-tree";
import { TimelineToolbar } from "./components/timeline-toolbar";
import { TraceHeader } from "./components/trace-header";
import { useLargeScreen } from "./use-large-screen";
import { useTimeline } from "./use-timeline";
import { useTrace } from "./use-trace";
import { useTraceSelection, type TraceSelection } from "./use-trace-selection";

function ExpiredNotice() {
  return (
    <p>
      This trace is expired or unknown.{" "}
      <Link className="underline underline-offset-4" to="/traces">
        Back to traces
      </Link>
    </p>
  );
}

function ReadFailure({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  return (
    <Alert variant="destructive" className="flex flex-wrap items-center gap-2">
      <AlertDescription>{error.message}</AlertDescription>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </Alert>
  );
}

interface TimelineTabProps {
  readonly traceId: string;
  readonly spans: readonly TraceSpan[];
  readonly traceState: TraceState;
  readonly selection: TraceSelection;
}

function TimelineTab({ traceId, spans, traceState, selection }: TimelineTabProps) {
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
  return (
    <div className="grid min-w-0 gap-3 lg:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-3">
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
          className="sticky top-4 max-h-[calc(100svh-2rem)] min-w-0 self-start overflow-y-auto rounded-lg border p-3"
        >
          {detail ?? <p className="text-muted-foreground">Select a span to see its detail.</p>}
        </aside>
      )}
      <Sheet
        open={!large && detail !== null}
        onOpenChange={(open) => !open && selection.selectSpan(null)}
      >
        <SheetContent side="bottom" className="data-[side=bottom]:h-full">
          <SheetHeader>
            <SheetTitle>Span detail</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{detail}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function TraceScreen() {
  const { traceId = "" } = useParams();
  const trace = useTrace(traceId);
  const selection = useTraceSelection(trace.spans);
  const { summary } = trace;

  if (trace.expired) return <ExpiredNotice />;
  if (summary === null) {
    if (trace.error === null) return <Skeleton className="h-40 w-full" />;
    return <ReadFailure error={trace.error} onRetry={trace.retry} />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {trace.error !== null && <ReadFailure error={trace.error} onRetry={trace.retry} />}
      <TraceHeader
        summary={summary}
        nodeName={trace.nodeName}
        projectName={trace.projectName}
        live={trace.live}
        paused={trace.paused}
        onTogglePaused={trace.togglePaused}
        onJumpToError={selection.selectSpan}
      />
      <Tabs value={selection.tab} onValueChange={(value) => selection.selectTab(String(value))}>
        <TabsList>
          <TabsTrigger value="span_tree">Span tree</TabsTrigger>
          <TabsTrigger value="conversation">Conversation</TabsTrigger>
        </TabsList>
        <TabsContent value="span_tree">
          <TimelineTab
            traceId={summary.trace_id}
            spans={trace.spans}
            traceState={summary.state}
            selection={selection}
          />
        </TabsContent>
        <TabsContent value="conversation">
          <Conversation
            traceId={summary.trace_id}
            spans={trace.spans}
            live={trace.live}
            selection={selection}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
