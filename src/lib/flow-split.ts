import type {
  FlowExit,
  FlowRead,
  FlowStage,
  FlowStageWindow,
  FlowUsageRow,
  FlowUsageTotals,
} from "@/api/types";

import { type FlowSpan, spanOf, splitRowTarget } from "./flow-drill";
import { costChangeText, costText, countText, rateText, tokensText } from "./flow-format";
import type { FlowSplit } from "./flow-query";
import {
  evaluate,
  type FlowFrame,
  type FlowSeverity,
  type FlowSignal,
  isActive,
} from "./flow-status";
import { isUnpriced, tileSignalsOf } from "./flow-tiles";

type Series = readonly (number | null)[];
type UsageSplitKey = Exclude<FlowSplit, "stage">;

export interface SplitBar {
  readonly text: string;
  readonly fraction: number;
}

export interface SplitCache {
  readonly text: string;
  readonly series: Series;
  readonly warn: number | null;
  readonly bad: number | null;
  readonly status: FlowSeverity;
}

export interface UsageSplitRow {
  readonly key: string;
  readonly all: boolean;
  readonly target: string | null;
  readonly cost: string;
  readonly share: SplitBar | null;
  readonly delta: SplitBar | null;
  readonly days: readonly number[];
  readonly cache: SplitCache;
  readonly perMillion: string;
  readonly tokens: string;
  readonly turns: string;
  readonly unpriced: string;
}

export interface UsageSplit {
  readonly kind: "usage";
  readonly split: UsageSplitKey;
  readonly rows: readonly UsageSplitRow[];
  readonly dayScale: number;
  readonly partial: boolean;
}

export interface StageSplitRow {
  readonly key: string;
  readonly all: boolean;
  readonly ended: string;
  readonly share: SplitBar;
  readonly leaked: string;
  readonly handedOn: string;
}

export interface StageSplit {
  readonly kind: "stage";
  readonly rows: readonly StageSplitRow[];
  readonly note: string;
}

export type SplitModel = UsageSplit | StageSplit;

interface UsageEntry {
  readonly key: string;
  readonly all: boolean;
  readonly row: FlowUsageTotals;
  readonly previousCost: number | null;
  readonly days: readonly number[];
  readonly cache: Series;
}

interface UsageContext {
  readonly frame: FlowFrame;
  readonly split: UsageSplitKey;
  readonly cacheSignal: FlowSignal;
  readonly total: number;
  readonly deltaScale: number;
  readonly span: FlowSpan;
}

const NO_VALUE = "—";
const PERCENT = 100;
const PER_MILLION = 1_000_000;
const ALL_KEY = "All";
const LEAK_EXITS = [
  "stopped",
  "paused",
  "revoked",
  "blocked",
] as const satisfies readonly FlowExit[];
const STAGE_NAMES: Readonly<Record<FlowStage, string>> = {
  queued: "Queued",
  executing: "Executing",
  verification: "Verification",
  release_gate: "Release gate",
  evaluation: "Evaluation",
  outcome: "Outcome",
};

function wholePercent(part: number, total: number): SplitBar | null {
  if (total <= 0) return null;
  return { text: `${Math.round((part / total) * PERCENT)} %`, fraction: part / total };
}

function perMillionOf(row: FlowUsageTotals): string {
  const priced = row.input_tokens + row.output_tokens - row.unpriced_tokens;
  if (priced <= 0 || isUnpriced(row)) return NO_VALUE;
  return `$${((row.cost_usd / priced) * PER_MILLION).toFixed(2)}`;
}

function unpricedTokensText(tokens: number): string {
  return tokens === 0 ? NO_VALUE : tokensText(tokens);
}

function entryOf(row: FlowUsageRow): UsageEntry {
  return {
    key: row.key,
    all: false,
    row,
    previousCost: row.previous_same_hour?.cost_usd ?? null,
    days: row.series.cost_usd,
    cache: row.series.cache_hit,
  };
}

function allEntryOf(read: FlowRead): UsageEntry {
  return {
    key: ALL_KEY,
    all: true,
    row: read.usage.current,
    previousCost: read.usage.previous_same_hour?.cost_usd ?? null,
    days: read.cost.series.total_usd,
    cache: read.usage.series.cache_hit,
  };
}

function orderedEntries(rows: readonly FlowUsageRow[]): readonly UsageEntry[] {
  const entries = rows.map(entryOf);
  const priced = entries.filter((entry) => !isUnpriced(entry.row));
  const unpriced = entries.filter((entry) => isUnpriced(entry.row));
  return [...priced.sort((a, b) => b.row.cost_usd - a.row.cost_usd), ...unpriced];
}

function cacheStatusOf(context: UsageContext, entry: UsageEntry): FlowSeverity {
  const { cacheSignal, frame, split } = context;
  if (entry.all) {
    const result = evaluate(cacheSignal, frame);
    return !result.sliceLevel && isActive(result) ? result.severity : "ok";
  }
  const slice =
    split === "model" ? cacheSignal.slices.find((candidate) => candidate.key === entry.key) : null;
  if (slice === null || slice === undefined) return "ok";
  const rowSignal = { ...cacheSignal, window: slice.window, series: slice.series, slices: [] };
  const result = evaluate(rowSignal, frame);
  return isActive(result) ? result.severity : "ok";
}

function deltaOf(context: UsageContext, entry: UsageEntry): SplitBar | null {
  if (entry.previousCost === null || isUnpriced(entry.row)) return null;
  const change = entry.row.cost_usd - entry.previousCost;
  return {
    text: costChangeText(entry.row.cost_usd, entry.previousCost),
    fraction: context.deltaScale > 0 ? change / context.deltaScale : 0,
  };
}

function usageRowOf(context: UsageContext, entry: UsageEntry): UsageSplitRow {
  const { row } = entry;
  const unpriced = isUnpriced(row);
  const { bounds } = context.cacheSignal;
  return {
    key: entry.key,
    all: entry.all,
    target: entry.all ? null : splitRowTarget(context.split, entry.key, context.span),
    cost: unpriced ? "unpriced" : costText(row.cost_usd),
    share: unpriced ? null : wholePercent(row.cost_usd, context.total),
    delta: deltaOf(context, entry),
    days: entry.days,
    cache: {
      text: row.input_tokens > 0 ? rateText(row.cache_read_tokens / row.input_tokens) : NO_VALUE,
      series: entry.cache,
      warn: bounds?.warn ?? null,
      bad: bounds?.bad ?? null,
      status: cacheStatusOf(context, entry),
    },
    perMillion: perMillionOf(row),
    tokens: `${tokensText(row.input_tokens)} (${tokensText(row.cache_read_tokens)}) / ${tokensText(row.output_tokens)}`,
    turns: countText(row.turn_count),
    unpriced: unpricedTokensText(row.unpriced_tokens),
  };
}

function deltaScaleOf(entries: readonly UsageEntry[]): number {
  return Math.max(
    0,
    ...entries.map((entry) =>
      entry.previousCost === null || isUnpriced(entry.row)
        ? 0
        : Math.abs(entry.row.cost_usd - entry.previousCost),
    ),
  );
}

function cacheSignalOf(read: FlowRead, frame: FlowFrame): FlowSignal {
  const signal = tileSignalsOf(read, frame).find((candidate) => candidate.id === "tile.cache_hit");
  if (signal === undefined) throw new Error("No cache hit signal in the tile signals");
  return signal;
}

function usageSplitOf(read: FlowRead, frame: FlowFrame, split: UsageSplitKey): UsageSplit {
  const entries = [...orderedEntries(read.usage.by[split]), allEntryOf(read)];
  const context: UsageContext = {
    frame,
    split,
    cacheSignal: cacheSignalOf(read, frame),
    total: read.cost.current.total_usd,
    deltaScale: deltaScaleOf(entries),
    span: spanOf(read, 0, read.window.buckets.length - 1),
  };
  return {
    kind: "usage",
    split,
    rows: entries.map((entry) => usageRowOf(context, entry)),
    dayScale: Math.max(0, ...entries.flatMap((entry) => entry.days)),
    partial: frame.partial,
  };
}

function exitCostOf(window: FlowStageWindow, exits: readonly FlowExit[]): number {
  return exits.reduce((sum, exit) => sum + (window.exits[exit]?.cost_usd ?? 0), 0);
}

function endedCostOf(window: FlowStageWindow): number {
  const all = Object.keys(window.exits) as FlowExit[];
  return exitCostOf(
    window,
    all.filter((exit) => exit !== "handed_on"),
  );
}

function stageRowOf(
  key: string,
  all: boolean,
  parts: { readonly ended: number; readonly leaked: number; readonly handedOn: number },
  total: number,
): StageSplitRow {
  return {
    key,
    all,
    ended: costText(parts.ended),
    share: wholePercent(parts.ended + parts.handedOn, total) ?? { text: NO_VALUE, fraction: 0 },
    leaked: costText(parts.leaked),
    handedOn: costText(parts.handedOn),
  };
}

function stageSplitOf(read: FlowRead): StageSplit {
  const total = read.cost.current.total_usd;
  const parts = read.stages.map((result) => ({
    key: STAGE_NAMES[result.stage],
    ended: endedCostOf(result.current),
    leaked: exitCostOf(result.current, LEAK_EXITS),
    handedOn: exitCostOf(result.current, ["handed_on"]),
  }));
  const sum = (pick: (part: (typeof parts)[number]) => number) =>
    parts.reduce((acc, part) => acc + pick(part), 0);
  const all = {
    ended: sum((part) => part.ended),
    leaked: sum((part) => part.leaked),
    handedOn: sum((part) => part.handedOn),
  };
  return {
    kind: "stage",
    rows: [
      ...parts.map((part) => stageRowOf(part.key, false, part, total)),
      stageRowOf(ALL_KEY, true, all, total),
    ],
    note: `Ended here + handed on = ${costText(total)}, the total cost.`,
  };
}

export function splitOf(read: FlowRead, frame: FlowFrame, split: FlowSplit): SplitModel {
  return split === "stage" ? stageSplitOf(read) : usageSplitOf(read, frame, split);
}
