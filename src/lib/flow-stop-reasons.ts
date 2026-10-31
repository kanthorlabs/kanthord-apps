import type { FlowRead, FlowStopReason } from "@/api/types";

import { isDoubled } from "./flow-causes";
import { spanOf, stopReasonTarget } from "./flow-drill";
import { countText, dayLabel, timeLabel } from "./flow-format";
import type { FlowFrame } from "./flow-status";

export type StopShade = "seq1" | "seq2" | "seq3" | "seq4" | "seq5";

export interface StopCell {
  readonly count: number;
  readonly text: string;
  readonly label: string;
  readonly shade: StopShade | null;
  readonly target: string | null;
}

export interface StopRow {
  readonly name: string;
  readonly bold: boolean;
  readonly cells: readonly StopCell[];
  readonly total: string;
  readonly doubled: boolean;
  readonly previous: string;
}

export interface StopColumn {
  readonly label: string;
  readonly partial: boolean;
}

export interface StopMatrix {
  readonly heading: string;
  readonly summary: string;
  readonly lead: string;
  readonly columns: readonly StopColumn[];
  readonly rows: readonly StopRow[];
  readonly all: StopRow;
  readonly budget: StopRow;
  readonly reconciliation: string;
}

const BUDGET_REASON = "budget_end";
const ALL_FAILURES = "All failures";
const NO_VALUE = "—";
const SHADE_LIMITS: readonly (readonly [number, StopShade])[] = [
  [2, "seq1"],
  [5, "seq2"],
  [10, "seq3"],
  [20, "seq4"],
];

function shadeOf(count: number): StopShade | null {
  if (count === 0) return null;
  return SHADE_LIMITS.find(([limit]) => count <= limit)?.[1] ?? "seq5";
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function sumAt(rows: readonly (readonly number[])[], index: number): number {
  return sum(rows.map((row) => row[index] ?? 0));
}

function leadAt(read: FlowRead, start: number): string {
  const day = dayLabel(start);
  return read.window.bucket === "hour" ? day : (day.split(" ")[0] ?? day);
}

function unitAt(read: FlowRead, start: number): string {
  return read.window.bucket === "hour" ? timeLabel(start) : String(new Date(start).getUTCDate());
}

function columnsOf(read: FlowRead, frame: FlowFrame): readonly StopColumn[] {
  const { buckets } = read.window;
  const last = buckets.length - 1;
  return buckets.map((start, index) => {
    const before = buckets[index - 1];
    const changed = before !== undefined && leadAt(read, before) !== leadAt(read, start);
    return {
      label: changed ? `${leadAt(read, start)} ${unitAt(read, start)}` : unitAt(read, start),
      partial: frame.partial && index === last,
    };
  });
}

function leadOf(read: FlowRead): string {
  const [first] = read.window.buckets;
  return first === undefined ? "" : leadAt(read, first);
}

function rowOf(
  read: FlowRead,
  frame: FlowFrame,
  name: string,
  reason: FlowStopReason | null,
  counts: readonly number[],
  previous: number | null,
): StopRow {
  const total = sum(counts);
  return {
    name,
    bold: reason === null,
    cells: read.window.buckets.map((_start, index) => {
      const count = counts[index] ?? 0;
      return {
        count,
        text: count === 0 ? "·" : countText(count),
        label: `${name} ${frame.labels[index] ?? ""}: ${count}`,
        shade: shadeOf(count),
        target: count === 0 ? null : stopReasonTarget(reason, spanOf(read, index, index)),
      };
    }),
    total: countText(total),
    doubled: isDoubled(total, previous),
    previous: previous === null ? NO_VALUE : countText(previous),
  };
}

function exitTotalOf(read: FlowRead, exit: "stopped" | "budget"): number {
  return sum(read.stages.map((stage) => stage.current.exits[exit]?.count ?? 0));
}

function checkOf(label: string, total: number, exits: number): string {
  return total === exits ? `${total} = ${label} ✓` : `${total} = ${label} ⚠ ${total} ≠ ${exits}`;
}

export function stopMatrixOf(read: FlowRead, frame: FlowFrame): StopMatrix {
  const { order, rows: counts, previous_totals: previous } = read.stop_reasons;
  const reasons = order.filter((reason) => reason !== BUDGET_REASON);
  const previousOf = (reason: FlowStopReason) => (previous === null ? null : previous[reason]);
  const rows = reasons.map((reason) =>
    rowOf(read, frame, reason, reason, counts[reason], previousOf(reason)),
  );
  const columns = columnsOf(read, frame);
  const allCounts = columns.map((_column, index) =>
    sumAt(
      reasons.map((reason) => counts[reason]),
      index,
    ),
  );
  const allPrevious = previous === null ? null : sum(reasons.map((reason) => previous[reason]));
  const all = rowOf(read, frame, ALL_FAILURES, null, allCounts, allPrevious);
  const budget = rowOf(
    read,
    frame,
    BUDGET_REASON,
    BUDGET_REASON,
    counts[BUDGET_REASON],
    previousOf(BUDGET_REASON),
  );
  const stopped = sum(allCounts);
  const budgetEnds = sum(counts[BUDGET_REASON]);
  return {
    heading: "Stop reasons",
    summary: `${countText(stopped)} stopped · ${countText(budgetEnds)} budget ends`,
    lead: leadOf(read),
    columns,
    rows,
    all,
    budget,
    reconciliation: [
      `Σ above the divider ${checkOf("↓ stopped exits", stopped, exitTotalOf(read, "stopped"))}`,
      `${BUDGET_REASON} ${checkOf("↺ budget loops", budgetEnds, exitTotalOf(read, "budget"))}`,
    ].join(" · "),
  };
}
