import { type KeyboardEvent, useMemo, useState } from "react";

import type { TraceSpan, TraceState } from "@/api/types";
import { type ErrorRole, errorRolesOf, errorSteps, pickCausalSpan } from "@/lib/causal-span";
import { type SpanUsage, usageBySpan } from "@/lib/span-usage";
import {
  pillFilter,
  type SpanStepRow,
  type StepPill,
  type StepRow,
  stepRows,
  type TurnGroupRow,
  turnGroups,
} from "@/lib/step-tree";
import { traceAxis, type TraceAxis } from "@/lib/trace-waterfall";
import { ancestorIds, buildSpanTree, spanMatches, type SpanNode } from "@/lib/trace-tree";

import type { TraceSelection } from "./use-trace-selection";

const OPERATION_TASK = "worker.task";
const OPERATION_TURN = "agent.turn";
const ATTRIBUTE_TASK_ID = "kanthord.task.id";
const TRACE_STATE_OPEN: TraceState = "open";

const INITIAL_OPERATIONS: readonly string[] = ["worker.phase", "agent.session"];

const HANDLED_KEYS: readonly string[] = [
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Enter",
];

export interface Timeline {
  readonly rows: readonly StepRow[];
  readonly selected: TraceSpan | null;
  readonly usage: ReadonlyMap<string, SpanUsage>;
  readonly axis: TraceAxis | null;
  readonly filtered: boolean;
  readonly search: string;
  readonly setSearch: (text: string) => void;
  readonly pill: StepPill | null;
  readonly setPill: (pill: StepPill | null) => void;
  readonly allErrors: boolean;
  readonly setAllErrors: (value: boolean) => void;
  readonly errorCount: number;
  readonly causalSpanId: string | null;
  readonly roleOf: (spanId: string) => ErrorRole | undefined;
  readonly isExpanded: (row: StepRow) => boolean;
  readonly toggle: (key: string) => void;
  readonly expandAll: () => void;
  readonly collapseAll: () => void;
  readonly onKey: (event: KeyboardEvent<HTMLElement>) => void;
}

type Selection = Pick<TraceSelection, "span" | "selectSpan">;

interface ErrorAnalysis {
  readonly causalSpanId: string | null;
  readonly roles: ReadonlyMap<string, ErrorRole>;
  readonly causeAndConsequenceIds: ReadonlySet<string>;
  readonly allErrorIds: ReadonlySet<string>;
}

export function isSpanRow(row: StepRow): row is SpanStepRow {
  return "span" in row;
}

function isGroupRow(row: StepRow): row is TurnGroupRow {
  return "key" in row;
}

function analyseErrors(spans: readonly TraceSpan[]): ErrorAnalysis {
  const root = spans.find((span) => span.parent_span_id === null);
  const picked = root === undefined ? null : pickCausalSpan(spans, root.span_id);
  const causal =
    picked !== null && picked.span_id === root?.span_id && picked.status !== "Error"
      ? null
      : picked;
  const roles = errorRolesOf(spans, causal);
  return {
    causalSpanId: causal?.span_id ?? null,
    roles,
    causeAndConsequenceIds: new Set(errorSteps(spans, roles)),
    allErrorIds: new Set(roles.keys()),
  };
}

function rootDurationMs(spans: readonly TraceSpan[]): number | null {
  const root = spans.find((span) => span.parent_span_id === null);
  if (root === undefined || root.start_time === null || root.end_time === null) return null;
  return root.end_time - root.start_time;
}

function openPathTo(
  spans: readonly TraceSpan[],
  expanded: ReadonlySet<string>,
  spanId: string,
): Set<string> {
  const ancestors = ancestorIds(spans, spanId);
  const path = new Set([spanId, ...ancestors]);
  const roots = buildSpanTree(spans);
  const open = new Set([...expanded, ...ancestors]);
  for (let pass = 0; pass < path.size; pass++) {
    const before = open.size;
    for (const row of stepRows(roots, { expanded: open, keep: null })) {
      if (isGroupRow(row) && row.spanIds.some((id) => path.has(id))) open.add(row.key);
    }
    if (open.size === before) break;
  }
  return open;
}

function deepestRunning(spans: readonly TraceSpan[]): string | null {
  let best: { readonly span: TraceSpan; readonly depth: number } | null = null;
  for (const span of spans) {
    if (span.start_time === null || span.end_time !== null) continue;
    const depth = ancestorIds(spans, span.span_id).length;
    const bestStart = best?.span.start_time ?? null;
    const wins =
      best === null ||
      depth > best.depth ||
      (depth === best.depth && bestStart !== null && span.start_time > bestStart);
    if (wins) best = { span, depth };
  }
  return best?.span.span_id ?? null;
}

function initialExpanded(
  spans: readonly TraceSpan[],
  selected: string | null,
  traceState: TraceState,
): Set<string> {
  const expanded = new Set(buildSpanTree(spans).map((root) => root.span.span_id));
  for (const span of spans) {
    if (INITIAL_OPERATIONS.includes(span.operation)) expanded.add(span.span_id);
  }
  if (selected !== null) return openPathTo(spans, expanded, selected);
  if (traceState !== TRACE_STATE_OPEN) return expanded;
  const running = deepestRunning(spans);
  return running === null ? expanded : openPathTo(spans, expanded, running);
}

function flatten(nodes: readonly SpanNode[]): readonly TraceSpan[] {
  return nodes.flatMap((node) => [node.span, ...flatten(node.children)]);
}

function carriedExpansion(
  previous: readonly SpanNode[],
  next: readonly SpanNode[],
  expanded: ReadonlySet<string>,
): Set<string> {
  const previousGroups = turnGroups(previous);
  const grouped = new Set(previousGroups.flatMap((group) => group.spanIds));
  const collected = new Set([
    ...previousGroups.filter((group) => expanded.has(group.key)).flatMap((group) => group.spanIds),
    ...flatten(previous)
      .filter(
        (span) =>
          span.operation === OPERATION_TURN &&
          expanded.has(span.span_id) &&
          !grouped.has(span.span_id),
      )
      .map((span) => span.span_id),
  ]);
  const knownKeys = new Set(previousGroups.map((group) => group.key));
  const carried = new Set(expanded);
  for (const group of turnGroups(next)) {
    if (!knownKeys.has(group.key) && group.spanIds.some((id) => collected.has(id))) {
      carried.add(group.key);
    }
  }
  return carried;
}

function keepOf(
  search: string,
  pillKeep: ((span: TraceSpan) => boolean) | null,
): ((span: TraceSpan) => boolean) | null {
  const text = search.trim();
  if (text === "" && pillKeep === null) return null;
  return (span) =>
    (text === "" || spanMatches(span, text)) && (pillKeep === null || pillKeep(span));
}

function withTaskName(row: StepRow, taskNames: ReadonlyMap<string, string>): StepRow {
  if (!isSpanRow(row) || row.span.operation !== OPERATION_TASK) return row;
  const taskId = row.span.attributes[ATTRIBUTE_TASK_ID];
  const name = typeof taskId === "string" ? taskNames.get(taskId) : undefined;
  return name === undefined ? row : { ...row, label: name };
}

function isButtonEnter(event: KeyboardEvent<HTMLElement>): boolean {
  return event.key === "Enter" && event.target instanceof HTMLButtonElement;
}

export function useTimeline(
  spans: readonly TraceSpan[],
  selection: Selection,
  taskNames: ReadonlyMap<string, string>,
  traceState: TraceState,
): Timeline {
  const [expanded, setExpanded] = useState(() =>
    initialExpanded(spans, selection.span, traceState),
  );
  const [seenSpan, setSeenSpan] = useState(selection.span);
  const [seenSpans, setSeenSpans] = useState(spans);
  const [search, setSearch] = useState("");
  const [pill, setPill] = useState<StepPill | null>(null);
  const [allErrors, setAllErrors] = useState(false);

  let nextExpanded = expanded;
  let expandedChanged = false;
  if (seenSpans !== spans) {
    setSeenSpans(spans);
    nextExpanded = carriedExpansion(buildSpanTree(seenSpans), buildSpanTree(spans), nextExpanded);
    expandedChanged = true;
  }
  if (seenSpan !== selection.span) {
    setSeenSpan(selection.span);
    if (selection.span !== null) {
      nextExpanded = openPathTo(spans, nextExpanded, selection.span);
      expandedChanged = true;
    }
  }
  if (expandedChanged) setExpanded(nextExpanded);

  const roots = useMemo(() => buildSpanTree(spans), [spans]);
  const usage = useMemo(() => usageBySpan(spans), [spans]);
  const axis = useMemo(() => traceAxis(spans), [spans]);
  const errors = useMemo(() => analyseErrors(spans), [spans]);
  const pillKeep = useMemo(
    () =>
      pill === null
        ? null
        : pillFilter(
            pill,
            spans,
            { duration_ms: rootDurationMs(spans) },
            allErrors ? errors.allErrorIds : errors.causeAndConsequenceIds,
          ),
    [pill, spans, allErrors, errors],
  );
  const keep = useMemo(() => keepOf(search, pillKeep), [search, pillKeep]);
  const rows = useMemo(
    () => stepRows(roots, { expanded, keep }).map((row) => withTaskName(row, taskNames)),
    [roots, expanded, keep, taskNames],
  );
  const spanRows = useMemo(() => rows.filter(isSpanRow), [rows]);

  const isExpanded = (row: StepRow) => {
    if (isGroupRow(row)) return expanded.has(row.key);
    return keep !== null || expanded.has(row.span.span_id);
  };

  const setOpen = (key: string, open: boolean) => {
    const next = new Set(expanded);
    if (open) next.add(key);
    else next.delete(key);
    setExpanded(next);
  };

  const selectRow = (row: SpanStepRow | undefined) => {
    if (row !== undefined) selection.selectSpan(row.span.span_id);
  };

  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || !HANDLED_KEYS.includes(event.key) || isButtonEnter(event)) return;
    const index = Math.max(
      spanRows.findIndex((row) => row.span.span_id === selection.span),
      0,
    );
    const current = spanRows[index];
    if (current === undefined) return;
    event.preventDefault();
    const open = isExpanded(current);
    const expandable = keep === null && current.hasChildren;
    switch (event.key) {
      case "ArrowDown":
        selectRow(spanRows[index + 1]);
        break;
      case "ArrowUp":
        selectRow(spanRows[index - 1]);
        break;
      case "ArrowRight":
        if (expandable && !open) setOpen(current.span.span_id, true);
        break;
      case "ArrowLeft":
        if (expandable && open) setOpen(current.span.span_id, false);
        else selectRow(spanRows.find((row) => row.span.span_id === current.span.parent_span_id));
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
    pill,
    setPill,
    allErrors,
    setAllErrors,
    errorCount: errors.causeAndConsequenceIds.size,
    causalSpanId: errors.causalSpanId,
    roleOf: (spanId) => errors.roles.get(spanId),
    isExpanded,
    toggle: (key) => setOpen(key, !expanded.has(key)),
    expandAll: () => setExpanded(new Set(spans.map((span) => span.span_id))),
    collapseAll: () => setExpanded(new Set()),
    onKey,
  };
}
