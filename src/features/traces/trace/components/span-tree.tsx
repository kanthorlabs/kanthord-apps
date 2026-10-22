import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef } from "react";

import type { TraceSpan, TraceState } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { durationText } from "@/lib/format";
import { spanLabel } from "@/lib/span-labels";
import { costText, tokenText } from "@/lib/trace-format";
import type { SpanNode } from "@/lib/trace-tree";
import { waterfallBar, type TraceAxis } from "@/lib/trace-waterfall";

import type { Timeline } from "../use-timeline";

const INDENT_PX = 16;

function durationOf(span: TraceSpan, traceState: TraceState): string {
  if (span.start_time === null) return "No start recorded";
  if (span.end_time !== null) return durationText(span.end_time - span.start_time);
  return traceState === "open" ? "Running" : "No end recorded";
}

interface WaterfallProps {
  readonly span: TraceSpan;
  readonly axis: TraceAxis;
  readonly traceState: TraceState;
}

function Waterfall({ span, axis, traceState }: WaterfallProps) {
  const bar = waterfallBar(span, axis, traceState);
  return (
    <div className="w-full md:w-1/2" aria-hidden="true">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`absolute inset-y-0 rounded-full ${span.status === "Error" ? "bg-destructive" : "bg-primary"}`}
          style={{ left: `${bar.offsetPercent}%`, width: `${bar.widthPercent}%` }}
        />
      </div>
    </div>
  );
}

interface SpanRowProps {
  readonly node: SpanNode;
  readonly timeline: Timeline;
  readonly traceState: TraceState;
  readonly selected: boolean;
  readonly tabbable: boolean;
  readonly onSelect: (spanId: string) => void;
}

function SpanRow({ node, timeline, traceState, selected, tabbable, onSelect }: SpanRowProps) {
  const { span } = node;
  const element = useRef<HTMLDivElement>(null);
  const label = spanLabel(span);
  const hasChildren = node.children.length > 0;
  const expanded = timeline.isExpanded(node);
  const usage = timeline.usage.get(span.span_id);

  useEffect(() => {
    const row = element.current;
    if (!selected || row === null) return;
    row.scrollIntoView({ block: "nearest" });
    if (row.closest('[role="tree"]')?.contains(document.activeElement)) row.focus();
  }, [selected]);

  return (
    <div
      ref={element}
      role="treeitem"
      aria-level={node.depth + 1}
      aria-selected={selected}
      aria-expanded={hasChildren ? expanded : undefined}
      tabIndex={tabbable ? 0 : -1}
      onClick={() => onSelect(span.span_id)}
      onKeyDown={timeline.onKey}
      className="flex min-w-0 flex-col gap-1 rounded-md border border-transparent px-2 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-selected:border-primary aria-selected:bg-muted md:flex-row md:items-center md:gap-3"
    >
      <div
        className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 md:w-1/2"
        style={{ paddingLeft: node.depth * INDENT_PX }}
      >
        {hasChildren ? (
          <Button
            variant="ghost"
            size="icon-xs"
            tabIndex={-1}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
            onClick={() => timeline.toggle(span.span_id)}
          >
            {expanded ? (
              <ChevronDownIcon aria-hidden="true" />
            ) : (
              <ChevronRightIcon aria-hidden="true" />
            )}
          </Button>
        ) : (
          <span className="size-6 shrink-0" aria-hidden="true" />
        )}
        <span className="font-medium break-all">{label}</span>
        <span className="text-muted-foreground">{durationOf(span, traceState)}</span>
        {usage !== undefined && (
          <span className="text-muted-foreground">
            {`${tokenText(usage.tokens)} tokens · Est. cost ${costText(usage.costUsd)}`}
          </span>
        )}
        {span.status === "Error" && <Badge variant="destructive">Error</Badge>}
        {node.parentMissing && <span className="text-muted-foreground">parent not stored</span>}
      </div>
      {timeline.axis !== null && (
        <Waterfall span={span} axis={timeline.axis} traceState={traceState} />
      )}
    </div>
  );
}

interface SpanTreeProps {
  readonly timeline: Timeline;
  readonly traceState: TraceState;
  readonly selectedSpanId: string | null;
  readonly onSelect: (spanId: string) => void;
}

export function SpanTree({ timeline, traceState, selectedSpanId, onSelect }: SpanTreeProps) {
  const selectedVisible = timeline.rows.some((row) => row.span.span_id === selectedSpanId);
  return (
    <div
      role="tree"
      aria-label="Spans"
      tabIndex={-1}
      onKeyDown={timeline.onKey}
      className="flex min-w-0 flex-col gap-1"
    >
      {timeline.rows.map((node, index) => {
        const selected = node.span.span_id === selectedSpanId;
        return (
          <SpanRow
            key={node.span.span_id}
            node={node}
            timeline={timeline}
            traceState={traceState}
            selected={selected}
            tabbable={selected || (!selectedVisible && index === 0)}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
