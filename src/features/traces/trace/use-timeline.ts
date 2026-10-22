import { useMemo, useState, type KeyboardEvent } from "react";

import type { TraceSpan } from "@/api/types";
import { spanGroup } from "@/lib/span-labels";
import { usageBySpan, type SpanUsage } from "@/lib/span-usage";
import { traceAxis, type TraceAxis } from "@/lib/trace-waterfall";
import {
  ancestorIds,
  buildSpanTree,
  spanMatches,
  visibleRows,
  type SpanNode,
} from "@/lib/trace-tree";

import type { TraceSelection } from "./use-trace-selection";

export const TIMELINE_GROUPS = ["all", "agent", "tools", "checks", "git"] as const;

export type TimelineGroup = (typeof TIMELINE_GROUPS)[number];

const INITIAL_OPERATIONS: readonly string[] = ["worker.phase", "agent.session"];

const HANDLED_KEYS: readonly string[] = [
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
];

export interface Timeline {
  readonly rows: readonly SpanNode[];
  readonly selected: TraceSpan | null;
  readonly usage: ReadonlyMap<string, SpanUsage>;
  readonly axis: TraceAxis | null;
  readonly filtered: boolean;
  readonly search: string;
  readonly setSearch: (text: string) => void;
  readonly errorsOnly: boolean;
  readonly setErrorsOnly: (value: boolean) => void;
  readonly group: TimelineGroup;
  readonly setGroup: (group: TimelineGroup) => void;
  readonly isExpanded: (node: SpanNode) => boolean;
  readonly toggle: (spanId: string) => void;
  readonly expandAll: () => void;
  readonly collapseAll: () => void;
  readonly onKey: (event: KeyboardEvent<HTMLElement>) => void;
}

type Selection = Pick<TraceSelection, "span" | "selectSpan">;

function initialExpanded(spans: readonly TraceSpan[], selected: string | null): Set<string> {
  const expanded = new Set(buildSpanTree(spans).map((root) => root.span.span_id));
  for (const span of spans) {
    if (INITIAL_OPERATIONS.includes(span.operation)) expanded.add(span.span_id);
  }
  if (selected !== null) for (const id of ancestorIds(spans, selected)) expanded.add(id);
  return expanded;
}

function keepOf(
  search: string,
  errorsOnly: boolean,
  group: TimelineGroup,
): ((span: TraceSpan) => boolean) | null {
  const text = search.trim();
  if (text === "" && !errorsOnly && group === "all") return null;
  return (span) =>
    (text === "" || spanMatches(span, text)) &&
    (!errorsOnly || span.status === "Error") &&
    (group === "all" || spanGroup(span) === group);
}

export function useTimeline(spans: readonly TraceSpan[], selection: Selection): Timeline {
  const [expanded, setExpanded] = useState(() => initialExpanded(spans, selection.span));
  const [seenSpan, setSeenSpan] = useState(selection.span);
  const [search, setSearch] = useState("");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [group, setGroup] = useState<TimelineGroup>("all");

  if (seenSpan !== selection.span) {
    setSeenSpan(selection.span);
    if (selection.span !== null) {
      setExpanded(new Set([...expanded, ...ancestorIds(spans, selection.span)]));
    }
  }

  const roots = useMemo(() => buildSpanTree(spans), [spans]);
  const usage = useMemo(() => usageBySpan(spans), [spans]);
  const axis = useMemo(() => traceAxis(spans), [spans]);
  const keep = useMemo(() => keepOf(search, errorsOnly, group), [search, errorsOnly, group]);
  const rows = useMemo(() => visibleRows(roots, { expanded, keep }), [roots, expanded, keep]);

  const isExpanded = (node: SpanNode) => {
    if (keep === null) return expanded.has(node.span.span_id);
    return node.children.some((child) => rows.includes(child));
  };

  const setOpen = (spanId: string, open: boolean) => {
    const next = new Set(expanded);
    if (open) next.add(spanId);
    else next.delete(spanId);
    setExpanded(next);
  };

  const selectRow = (row: SpanNode | undefined) => {
    if (row !== undefined) selection.selectSpan(row.span.span_id);
  };

  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || !HANDLED_KEYS.includes(event.key)) return;
    const index = Math.max(
      rows.findIndex((row) => row.span.span_id === selection.span),
      0,
    );
    const current = rows[index];
    if (current === undefined) return;
    event.preventDefault();
    const open = isExpanded(current);
    const expandable = keep === null && current.children.length > 0;
    switch (event.key) {
      case "ArrowDown":
        selectRow(rows[index + 1]);
        break;
      case "ArrowUp":
        selectRow(rows[index - 1]);
        break;
      case "ArrowRight":
        if (expandable && !open) setOpen(current.span.span_id, true);
        break;
      case "ArrowLeft":
        if (expandable && open) setOpen(current.span.span_id, false);
        else selectRow(rows.find((row) => row.span.span_id === current.span.parent_span_id));
        break;
      default:
        selectRow(current);
    }
  };

  return {
    rows,
    selected: spans.find((span) => span.span_id === selection.span) ?? null,
    usage,
    axis,
    filtered: keep !== null,
    search,
    setSearch,
    errorsOnly,
    setErrorsOnly,
    group,
    setGroup,
    isExpanded,
    toggle: (spanId) => setOpen(spanId, !expanded.has(spanId)),
    expandAll: () => setExpanded(new Set(spans.map((span) => span.span_id))),
    collapseAll: () => setExpanded(new Set()),
    onKey,
  };
}
