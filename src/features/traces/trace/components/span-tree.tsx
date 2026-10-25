import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

import type { TraceSpan, TraceState } from "@/api/types";
import { TouchTarget } from "@/components/touch-target";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorRole } from "@/lib/causal-span";
import { durationText } from "@/lib/format";
import { INDENT_PX, MAX_INDENT_LEVEL, type SpanStepRow, type TurnGroupRow } from "@/lib/step-tree";
import { waterfallBar, type TraceAxis } from "@/lib/trace-waterfall";

import { useLargeScreen } from "../use-large-screen";
import { isSpanRow, type Timeline } from "../use-timeline";

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
    <div className="w-32 shrink-0" aria-hidden="true">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`absolute inset-y-0 rounded-full ${span.status === "Error" ? "bg-destructive" : "bg-primary"}`}
          style={{ left: `${bar.offsetPercent}%`, width: `${bar.widthPercent}%` }}
        />
      </div>
    </div>
  );
}

interface ChevronProps {
  readonly expanded: boolean;
  readonly label: string;
  readonly tabbable: boolean;
  readonly onToggle: () => void;
}

function Chevron({ expanded, label, tabbable, onToggle }: ChevronProps) {
  return (
    <TouchTarget>
      <Button
        variant="ghost"
        size="icon-xs"
        className="min-w-11 lg:min-w-0"
        tabIndex={tabbable ? 0 : -1}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${label}`}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        {expanded ? (
          <ChevronDownIcon aria-hidden="true" />
        ) : (
          <ChevronRightIcon aria-hidden="true" />
        )}
      </Button>
    </TouchTarget>
  );
}

function Lead({ depth, children }: { readonly depth: number; readonly children: ReactNode }) {
  return (
    <div
      className="flex min-w-0 flex-1 items-center gap-1"
      style={{ paddingLeft: Math.min(depth, MAX_INDENT_LEVEL) * INDENT_PX }}
    >
      {depth > MAX_INDENT_LEVEL && (
        <span className="shrink-0 text-xs text-muted-foreground" aria-label={`Depth ${depth}`}>
          {depth}
        </span>
      )}
      {children}
    </div>
  );
}

const ROW_CLASS =
  "flex min-h-11 min-w-0 items-center gap-2 rounded-md border border-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-selected:border-primary aria-selected:bg-muted lg:min-h-0 lg:py-1.5";

interface StatusProps {
  readonly span: TraceSpan;
  readonly role: ErrorRole | undefined;
}

function Status({ span, role }: StatusProps) {
  if (role === ErrorRole.Recovered) return <span className="text-muted-foreground">recovered</span>;
  return (
    <>
      {role === ErrorRole.Causal && <Badge variant="outline">Cause</Badge>}
      {span.status === "Error" && <Badge variant="destructive">Error</Badge>}
    </>
  );
}

interface SpanRowProps {
  readonly row: SpanStepRow;
  readonly timeline: Timeline;
  readonly traceState: TraceState;
  readonly large: boolean;
  readonly selected: boolean;
  readonly tabbable: boolean;
  readonly onSelect: (spanId: string) => void;
}

function SpanRow({ row, timeline, traceState, large, selected, tabbable, onSelect }: SpanRowProps) {
  const { span } = row;
  const element = useRef<HTMLDivElement>(null);
  const expanded = timeline.isExpanded(row);

  useEffect(() => {
    const item = element.current;
    if (!selected || item === null) return;
    item.scrollIntoView({ block: "nearest" });
    if (item.closest('[role="tree"]')?.contains(document.activeElement)) item.focus();
  }, [selected]);

  return (
    <div
      ref={element}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={selected}
      aria-expanded={row.hasChildren ? expanded : undefined}
      tabIndex={tabbable ? 0 : -1}
      onClick={() => onSelect(span.span_id)}
      onKeyDown={timeline.onKey}
      className={ROW_CLASS}
    >
      <Lead depth={row.depth}>
        {row.hasChildren ? (
          <Chevron
            expanded={expanded}
            label={row.label}
            tabbable={false}
            onToggle={() => timeline.toggle(span.span_id)}
          />
        ) : (
          <span className="w-11 shrink-0 lg:w-6" aria-hidden="true" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{row.label}</span>
      </Lead>
      <span className="shrink-0 text-muted-foreground">{durationOf(span, traceState)}</span>
      <Status span={span} role={timeline.roleOf(span.span_id)} />
      {large && timeline.axis !== null && (
        <Waterfall span={span} axis={timeline.axis} traceState={traceState} />
      )}
    </div>
  );
}

interface GroupRowProps {
  readonly row: TurnGroupRow;
  readonly timeline: Timeline;
}

function GroupRow({ row, timeline }: GroupRowProps) {
  const expanded = timeline.isExpanded(row);
  const label = `Turns ${row.first}-${row.last}`;
  return (
    <div
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={false}
      aria-expanded={expanded}
      tabIndex={-1}
      onClick={() => timeline.toggle(row.key)}
      onKeyDown={timeline.onKey}
      className={ROW_CLASS}
    >
      <Lead depth={row.depth}>
        <Chevron
          expanded={expanded}
          label={label}
          tabbable
          onToggle={() => timeline.toggle(row.key)}
        />
        <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      </Lead>
      <span className="shrink-0 text-muted-foreground">{`${row.turnCount} turns`}</span>
      <span className="shrink-0 text-muted-foreground">{durationText(row.durationMs)}</span>
      <span
        className={`shrink-0 ${row.toolErrorCount > 0 ? "text-destructive" : "text-muted-foreground"}`}
      >
        {`${row.toolErrorCount} tool ${row.toolErrorCount === 1 ? "error" : "errors"}`}
      </span>
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
  const large = useLargeScreen();
  const spanRows = timeline.rows.filter(isSpanRow);
  const selectedVisible = spanRows.some((row) => row.span.span_id === selectedSpanId);
  return (
    <div
      role="tree"
      aria-label="Spans"
      tabIndex={-1}
      onKeyDown={timeline.onKey}
      className="flex min-w-0 flex-col gap-1"
    >
      {timeline.rows.map((row) => {
        if (!isSpanRow(row)) return <GroupRow key={row.key} row={row} timeline={timeline} />;
        const selected = row.span.span_id === selectedSpanId;
        return (
          <SpanRow
            key={row.span.span_id}
            row={row}
            timeline={timeline}
            traceState={traceState}
            large={large}
            selected={selected}
            tabbable={selected || (!selectedVisible && row === spanRows[0])}
            onSelect={onSelect}
          />
        );
      })}
    </div>
  );
}
