import { ArrowLeftIcon } from "lucide-react";

import type { TraceSpan, TraceState } from "@/api/types";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import { spanHeadline } from "@/lib/span-headline";
import { spanLabel } from "@/lib/span-labels";
import type { SpanUsage } from "@/lib/span-usage";
import { waterfallBar, type TraceAxis } from "@/lib/trace-waterfall";

interface SpanLevelHeaderProps {
  readonly span: TraceSpan;
  readonly usage: SpanUsage | undefined;
  readonly axis: TraceAxis | null;
  readonly traceState: TraceState;
  readonly onBack: (() => void) | null;
}

function SpanBar({
  span,
  axis,
  traceState,
}: {
  readonly span: TraceSpan;
  readonly axis: TraceAxis;
  readonly traceState: TraceState;
}) {
  const bar = waterfallBar(span, axis, traceState);
  return (
    <div
      role="img"
      aria-label="Span against the trace extent"
      className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={`absolute inset-y-0 rounded-full ${span.status === "Error" ? "bg-destructive" : "bg-primary"}`}
        style={{ left: `${bar.offsetPercent}%`, width: `${bar.widthPercent}%` }}
      />
    </div>
  );
}

export function SpanLevelHeader({ span, usage, axis, traceState, onBack }: SpanLevelHeaderProps) {
  return (
    <header className="flex min-w-0 flex-col gap-2">
      {onBack !== null && (
        <TouchTarget>
          <Button variant="ghost" size="sm" className="self-start" onClick={onBack}>
            <ArrowLeftIcon aria-hidden="true" data-icon="inline-start" />
            Back to steps
          </Button>
        </TouchTarget>
      )}
      <h3 className="min-w-0 text-base font-semibold break-all">{spanLabel(span)}</h3>
      <p className="min-w-0 text-sm break-words text-muted-foreground">
        {spanHeadline(span, usage, traceState)}
      </p>
      {axis !== null && <SpanBar span={span} axis={axis} traceState={traceState} />}
    </header>
  );
}
