import { Link, useParams } from "react-router-dom";

import type { ApiError } from "@/api/errors";
import { useCrumbLabel } from "@/components/crumb-labels";
import { TouchTarget } from "@/components/touch-target";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Conversation } from "./components/conversation";
import { StepsTab } from "./components/steps-tab";
import { TraceHeader } from "./components/trace-header";
import { useStickyOffset } from "./use-sticky-offset";
import { useTrace } from "./use-trace";
import { useTraceSelection } from "./use-trace-selection";

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
      <TouchTarget>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </TouchTarget>
    </Alert>
  );
}

export function TraceScreen() {
  const { traceId = "" } = useParams();
  const trace = useTrace(traceId);
  const selection = useTraceSelection(trace.spans);
  const { summary } = trace;
  const stickyRef = useStickyOffset();
  useCrumbLabel(`/traces/${encodeURIComponent(traceId)}`, trace.title ?? undefined);

  if (trace.expired) return <ExpiredNotice />;
  if (summary === null) {
    if (trace.error === null) return <Skeleton className="h-40 w-full" />;
    return <ReadFailure error={trace.error} onRetry={trace.retry} />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {trace.error !== null && <ReadFailure error={trace.error} onRetry={trace.retry} />}
      <Tabs
        value={selection.tab}
        onValueChange={(value) => selection.selectTab(String(value))}
        className="flex min-w-0 flex-col gap-3"
      >
        <div
          ref={stickyRef}
          className="sticky top-[var(--app-header-height,3.5rem)] z-10 flex min-w-0 flex-col gap-3 bg-background"
        >
          <TraceHeader
            summary={summary}
            title={trace.title ?? summary.trace_id}
            nodeName={trace.nodeName}
            projectName={trace.projectName}
            live={trace.live}
            paused={trace.paused}
            onTogglePaused={trace.togglePaused}
          />
          <TouchTarget>
            <TabsList>
              <TouchTarget>
                <TabsTrigger value="steps">Steps</TabsTrigger>
              </TouchTarget>
              <TouchTarget>
                <TabsTrigger value="conversation">Conversation</TabsTrigger>
              </TouchTarget>
            </TabsList>
          </TouchTarget>
        </div>
        <TabsContent value="steps">
          <StepsTab
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
