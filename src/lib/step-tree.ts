import type { SpanStatus, TraceSpan, TraceSummary } from "@/api/types";

import { spanLabel } from "./span-labels";
import { buildSpanTree, type SpanNode } from "./trace-tree";

export const MAX_INDENT_LEVEL = 4;
export const INDENT_PX = 12;

const MIN_RUN_LENGTH = 2;
const SLOW_SHARE = 0.1;
const OPERATION_TURN = "agent.turn";
const OPERATION_TOOL = "agent.tool";
const ATTRIBUTE_TURN_INDEX = "kanthord.turn.index";
const STATUS_ERROR: SpanStatus = "Error";

export interface SpanStepRow {
  readonly span: TraceSpan;
  readonly depth: number;
  readonly label: string;
  readonly durationMs: number | null;
  readonly status: SpanStatus;
  readonly hasChildren: boolean;
}

export interface TurnGroupRow {
  readonly key: string;
  readonly depth: number;
  readonly first: number;
  readonly last: number;
  readonly turnCount: number;
  readonly durationMs: number;
  readonly toolErrorCount: number;
  readonly spanIds: readonly string[];
}

export type StepRow = SpanStepRow | TurnGroupRow;

export interface StepRowsOptions {
  readonly expanded: ReadonlySet<string>;
  readonly keep: ((span: TraceSpan) => boolean) | null;
}

export const StepPill = {
  Errors: "errors",
  Slow: "slow",
  Agent: "agent",
  Checks: "checks",
  Git: "git",
} as const;

export type StepPill = (typeof StepPill)[keyof typeof StepPill];

const PILL_OPERATIONS: Readonly<Record<Exclude<StepPill, "errors" | "slow">, readonly string[]>> = {
  agent: ["agent.session", OPERATION_TURN, OPERATION_TOOL],
  checks: ["worker.verification", "worker.evaluation", "worker.release_gate", "worker.setup"],
  git: ["worker.git", "worker.gate"],
};

interface NumberedTurn {
  readonly node: SpanNode;
  readonly number: number;
}

interface TurnRun {
  readonly turns: readonly NumberedTurn[];
}

type Entry = SpanNode | TurnRun;

interface Walk {
  readonly expanded: ReadonlySet<string>;
  readonly filtered: boolean;
}

function durationOf(span: TraceSpan): number | null {
  if (span.start_time === null || span.end_time === null) return null;
  return span.end_time - span.start_time;
}

export function selfTimeMs(node: SpanNode): number {
  const { start_time: start, end_time: end } = node.span;
  if (start === null || end === null) return 0;
  const intervals = node.children
    .flatMap(({ span }) =>
      span.start_time === null || span.end_time === null
        ? []
        : [[Math.max(span.start_time, start), Math.min(span.end_time, end)] as const],
    )
    .filter(([from, to]) => to > from)
    .sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let reach = start;
  for (const [from, to] of intervals) {
    covered += Math.max(0, to - Math.max(from, reach));
    reach = Math.max(reach, to);
  }
  return Math.max(0, end - start - covered);
}

function prune(node: SpanNode, keep: (span: TraceSpan) => boolean): SpanNode | null {
  const children = node.children.flatMap((child) => prune(child, keep) ?? []);
  if (children.length === 0 && !keep(node.span)) return null;
  return { ...node, children };
}

function turnNumber(span: TraceSpan, ordinal: number): number {
  const value = span.attributes[ATTRIBUTE_TURN_INDEX];
  return typeof value === "number" ? value : ordinal;
}

function fold(nodes: readonly SpanNode[], filtered: boolean): readonly Entry[] {
  if (filtered) return nodes;
  const entries: Entry[] = [];
  let run: NumberedTurn[] = [];
  let ordinal = 0;
  const flush = (): void => {
    if (run.length >= MIN_RUN_LENGTH) entries.push({ turns: run });
    else entries.push(...run.map((turn) => turn.node));
    run = [];
  };
  for (const node of nodes) {
    if (node.span.operation !== OPERATION_TURN) {
      flush();
      entries.push(node);
      continue;
    }
    ordinal += 1;
    if (node.span.status === STATUS_ERROR) {
      flush();
      entries.push(node);
      continue;
    }
    run.push({ node, number: turnNumber(node.span, ordinal) });
  }
  flush();
  return entries;
}

function countToolErrors(node: SpanNode): number {
  const own = node.span.operation === OPERATION_TOOL && node.span.status === STATUS_ERROR ? 1 : 0;
  return node.children.reduce((total, child) => total + countToolErrors(child), own);
}

function groupRow(run: TurnRun, depth: number): TurnGroupRow {
  const { turns } = run;
  const [head] = turns;
  const tail = turns[turns.length - 1];
  if (head === undefined || tail === undefined) throw new Error("a turn group holds no turn");
  return {
    key: `turns:${head.node.span.span_id}`,
    depth,
    first: head.number,
    last: tail.number,
    turnCount: turns.length,
    durationMs: turns.reduce((total, turn) => total + (durationOf(turn.node.span) ?? 0), 0),
    toolErrorCount: turns.reduce((total, turn) => total + countToolErrors(turn.node), 0),
    spanIds: turns.map((turn) => turn.node.span.span_id),
  };
}

function appendNode(node: SpanNode, depth: number, walk: Walk, rows: StepRow[]): void {
  const { span } = node;
  rows.push({
    span,
    depth,
    label: spanLabel(span),
    durationMs: durationOf(span),
    status: span.status,
    hasChildren: node.children.length > 0,
  });
  if (walk.filtered || walk.expanded.has(span.span_id)) {
    appendLevel(node.children, depth + 1, walk, rows);
  }
}

function appendLevel(nodes: readonly SpanNode[], depth: number, walk: Walk, rows: StepRow[]): void {
  for (const entry of fold(nodes, walk.filtered)) {
    if (!("turns" in entry)) {
      appendNode(entry, depth, walk, rows);
      continue;
    }
    const group = groupRow(entry, depth);
    rows.push(group);
    if (!walk.expanded.has(group.key)) continue;
    for (const turn of entry.turns) appendNode(turn.node, depth + 1, walk, rows);
  }
}

export function stepRows(nodes: readonly SpanNode[], options: StepRowsOptions): readonly StepRow[] {
  const { expanded, keep } = options;
  const roots = keep === null ? nodes : nodes.flatMap((node) => prune(node, keep) ?? []);
  const rows: StepRow[] = [];
  appendLevel(roots, 0, { expanded, filtered: keep !== null }, rows);
  return rows;
}

function markKept(
  node: SpanNode,
  matches: (node: SpanNode) => boolean,
  kept: Set<string>,
): boolean {
  let any = matches(node);
  for (const child of node.children) {
    if (markKept(child, matches, kept)) any = true;
  }
  if (any) kept.add(node.span.span_id);
  return any;
}

function pillMatcher(
  pill: StepPill,
  summary: Pick<TraceSummary, "duration_ms">,
  errorSpanIds: ReadonlySet<string>,
): (node: SpanNode) => boolean {
  switch (pill) {
    case StepPill.Errors:
      return (node) => errorSpanIds.has(node.span.span_id);
    case StepPill.Slow: {
      const total = summary.duration_ms;
      if (total === null || total <= 0) return () => false;
      return (node) => selfTimeMs(node) >= total * SLOW_SHARE;
    }
    default: {
      const operations = PILL_OPERATIONS[pill];
      return (node) => operations.includes(node.span.operation);
    }
  }
}

export function pillFilter(
  pill: StepPill,
  spans: readonly TraceSpan[],
  summary: Pick<TraceSummary, "duration_ms">,
  errorSpanIds: ReadonlySet<string>,
): (span: TraceSpan) => boolean {
  const matches = pillMatcher(pill, summary, errorSpanIds);
  const kept = new Set<string>();
  for (const root of buildSpanTree(spans)) markKept(root, matches, kept);
  return (span) => kept.has(span.span_id);
}
