import type { TraceSpan } from "@/api/types";

import { spanLabel } from "./span-labels";

export interface SpanNode {
  readonly span: TraceSpan;
  readonly depth: number;
  readonly children: readonly SpanNode[];
  readonly parentMissing: boolean;
}

export interface VisibleRowsOptions {
  readonly expanded: ReadonlySet<string>;
  readonly keep: ((span: TraceSpan) => boolean) | null;
}

function compareSpans(a: TraceSpan, b: TraceSpan): number {
  if (a.start_time !== b.start_time) {
    if (a.start_time === null) return 1;
    if (b.start_time === null) return -1;
    return a.start_time - b.start_time;
  }
  if (a.span_id === b.span_id) return 0;
  return a.span_id < b.span_id ? -1 : 1;
}

function groupByParent(spans: readonly TraceSpan[]): Map<string, TraceSpan[]> {
  const ids = new Set(spans.map((span) => span.span_id));
  const groups = new Map<string, TraceSpan[]>();
  for (const span of spans) {
    const parent = span.parent_span_id;
    if (parent === null || !ids.has(parent)) continue;
    const siblings = groups.get(parent) ?? [];
    siblings.push(span);
    groups.set(parent, siblings);
  }
  return groups;
}

export function buildSpanTree(spans: readonly TraceSpan[]): readonly SpanNode[] {
  const ids = new Set(spans.map((span) => span.span_id));
  const groups = groupByParent(spans);
  const seen = new Set<string>();

  function nodeOf(span: TraceSpan, depth: number, parentMissing: boolean): SpanNode | null {
    if (seen.has(span.span_id)) return null;
    seen.add(span.span_id);
    const children = [...(groups.get(span.span_id) ?? [])]
      .sort(compareSpans)
      .flatMap((child) => nodeOf(child, depth + 1, false) ?? []);
    return { span, depth, children, parentMissing };
  }

  return spans
    .filter((span) => span.parent_span_id === null || !ids.has(span.parent_span_id))
    .sort(compareSpans)
    .flatMap((span) => nodeOf(span, 0, span.parent_span_id !== null) ?? []);
}

export function spanMatches(span: TraceSpan, text: string): boolean {
  const needle = text.toLowerCase();
  if (spanLabel(span).toLowerCase().includes(needle)) return true;
  return Object.values(span.attributes).some((value) =>
    String(value).toLowerCase().includes(needle),
  );
}

function collectAll(node: SpanNode, expanded: ReadonlySet<string>, rows: SpanNode[]): void {
  rows.push(node);
  if (!expanded.has(node.span.span_id)) return;
  for (const child of node.children) collectAll(child, expanded, rows);
}

function collectKept(
  node: SpanNode,
  keep: (span: TraceSpan) => boolean,
  rows: SpanNode[],
): boolean {
  const start = rows.length;
  rows.push(node);
  let childShown = false;
  for (const child of node.children) {
    if (collectKept(child, keep, rows)) childShown = true;
  }
  if (childShown || keep(node.span)) return true;
  rows.length = start;
  return false;
}

export function visibleRows(
  roots: readonly SpanNode[],
  options: VisibleRowsOptions,
): readonly SpanNode[] {
  const rows: SpanNode[] = [];
  const { expanded, keep } = options;
  for (const root of roots) {
    if (keep === null) collectAll(root, expanded, rows);
    else collectKept(root, keep, rows);
  }
  return rows;
}

export function ancestorIds(spans: readonly TraceSpan[], spanId: string): readonly string[] {
  const byId = new Map(spans.map((span) => [span.span_id, span]));
  const chain: string[] = [];
  const seen = new Set<string>([spanId]);
  let parent = byId.get(spanId)?.parent_span_id ?? null;
  while (parent !== null && byId.has(parent) && !seen.has(parent)) {
    seen.add(parent);
    chain.push(parent);
    parent = byId.get(parent)?.parent_span_id ?? null;
  }
  return chain.reverse();
}
