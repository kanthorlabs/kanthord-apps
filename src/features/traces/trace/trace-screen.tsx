import { Link, useParams } from "react-router-dom";

import type { ApiError } from "@/api/errors";
import type { TraceSpan, TraceState } from "@/api/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { SpanTree } from "./components/span-tree";
import { TimelineToolbar } from "./components/timeline-toolbar";
import { TraceHeader } from "./components/trace-header";
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
  readonly spans: readonly TraceSpan[];
  readonly traceState: TraceState;
  readonly selection: TraceSelection;
}

function TimelineTab({ spans, traceState, selection }: TimelineTabProps) {
  const timeline = useTimeline(spans, selection);
  return (
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
  );
}

export function TraceScreen() {
  const { traceId = "" } = useParams();
  const trace = useTrace(traceId);
  const selection = useTraceSelection();
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
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        <TabsContent value="timeline">
          <TimelineTab spans={trace.spans} traceState={summary.state} selection={selection} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
