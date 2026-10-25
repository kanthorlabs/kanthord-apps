import { ACT_OPERATIONS, type TimelineItem, type TraceState } from "@/api/types";

import { durationText } from "./format";
import { revocationLabel } from "./span-labels";

const ATTRIBUTE_EXECUTION_KIND = "kanthord.execution.kind";
const ATTRIBUTE_EXECUTION_END = "kanthord.execution.end";
const EXECUTION_FINISHED = "finished";
const RUNNING_TEXT = "running";
const NO_END_TEXT = "No end recorded";
const OPERATION_EXECUTION = "scheduler.execution";
const OPERATION_TRANSITION = "scheduler.transition";
const REASON_TEXT_NAME = "reason";
const TEXT_NAME_SEPARATOR = ":";

export type TimelineRow =
  | { readonly kind: "root"; readonly key: string; readonly item: TimelineItem }
  | {
      readonly kind: "child";
      readonly key: string;
      readonly item: TimelineItem;
      readonly rootEnded: boolean;
    }
  | { readonly kind: "missing_root"; readonly key: string; readonly traceId: string };

export type TimelineItemKind = "execution" | "transition" | "act" | "span";

interface Group {
  readonly traceId: string;
  readonly root: TimelineItem | null;
  readonly children: readonly TimelineItem[];
  readonly start: number;
}

function timeOf(item: TimelineItem): number {
  return item.start_time ?? item.end_time ?? item.created_at;
}

function byTime(a: TimelineItem, b: TimelineItem): number {
  return timeOf(a) - timeOf(b) || a.span_id.localeCompare(b.span_id);
}

function groupOf(traceId: string, items: readonly TimelineItem[]): Group {
  const root = items.find((item) => item.depth === 1) ?? null;
  const children = items.filter((item) => item.depth === 2).sort(byTime);
  const first = root ?? children[0];
  return { traceId, root, children, start: first === undefined ? 0 : timeOf(first) };
}

function rowsOf(group: Group): readonly TimelineRow[] {
  const head: TimelineRow =
    group.root === null
      ? { kind: "missing_root", key: `${group.traceId}:root`, traceId: group.traceId }
      : { kind: "root", key: group.root.span_id, item: group.root };
  const rootEnded = group.root !== null && group.root.end_time !== null;
  return [
    head,
    ...group.children.map((item): TimelineRow => ({
      kind: "child",
      key: item.span_id,
      item,
      rootEnded,
    })),
  ];
}

export function timelineRows(items: readonly TimelineItem[]): readonly TimelineRow[] {
  const spans = new Map<string, TimelineItem>();
  for (const item of items) spans.set(item.span_id, item);
  const traces = new Map<string, TimelineItem[]>();
  for (const item of spans.values()) {
    traces.set(item.trace_id, [...(traces.get(item.trace_id) ?? []), item]);
  }
  return [...traces]
    .map(([traceId, members]) => groupOf(traceId, members))
    .sort((a, b) => a.start - b.start || a.traceId.localeCompare(b.traceId))
    .flatMap(rowsOf);
}

export function hasOpenRoot(items: readonly TimelineItem[]): boolean {
  return items.some((item) => item.depth === 1 && item.end_time === null);
}

export function spanDurationText(item: TimelineItem, rootEnded: boolean): string {
  if (item.duration_ms !== null) return durationText(item.duration_ms);
  return item.end_time === null && rootEnded ? NO_END_TEXT : RUNNING_TEXT;
}

export function executionStateOf(item: TimelineItem): TraceState {
  if (item.end_time === null) return "open";
  return item.status === "Error" ? "error" : "ok";
}

function attributeText(item: TimelineItem, name: string): string | null {
  const value = item.attributes[name];
  return value === undefined ? null : String(value);
}

export function executionKindOf(item: TimelineItem): string | null {
  return attributeText(item, ATTRIBUTE_EXECUTION_KIND);
}

export function executionStopReasonOf(item: TimelineItem): string | null {
  const end = attributeText(item, ATTRIBUTE_EXECUTION_END);
  if (end === null || end === EXECUTION_FINISHED) return null;
  return revocationLabel(item) ?? end;
}

export function reasonTextIdOf(item: TimelineItem): string | null {
  const nameOf = (textId: string) => textId.slice(textId.lastIndexOf(TEXT_NAME_SEPARATOR) + 1);
  return item.text_ids.find((textId) => nameOf(textId) === REASON_TEXT_NAME) ?? null;
}

export function itemKindOf(item: TimelineItem): TimelineItemKind {
  if (item.operation === OPERATION_EXECUTION) return "execution";
  if (item.operation === OPERATION_TRANSITION) return "transition";
  return (ACT_OPERATIONS as readonly string[]).includes(item.operation) ? "act" : "span";
}
