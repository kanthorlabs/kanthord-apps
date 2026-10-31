import type { FlowRead, FlowUsageTotals } from "@/api/types";

import { signalTarget, sliceParamsOf, spanOf } from "./flow-drill";
import {
  costChangeText,
  costText,
  countText,
  dayLabel,
  deltaText,
  rateBoundText,
  rateDeltaText,
  rateText,
  tokensText,
} from "./flow-format";
import { exitCountOf, stageResultOf } from "./flow-signals";
import {
  evaluate,
  type FlowBounds,
  type FlowFrame,
  type FlowGroup,
  type FlowSeverity,
  type FlowSignal,
  type FlowSlice,
  isActive,
  type SignalResult,
} from "./flow-status";
import {
  boundsOf,
  FLOW_THRESHOLDS,
  type FlowThresholdId,
  MIN_MODEL_TURNS,
  MIN_SUCCESS,
} from "./flow-thresholds";

type Series = readonly (number | null)[];
type TileUnit = "usd" | "tokens" | "ratio";
type StatusId = Extract<FlowThresholdId, `tile.${string}`>;

export interface TileSlice {
  readonly key: string;
  readonly values: Series;
  readonly severity: FlowSeverity;
}

export interface ScorecardTile {
  readonly id: string;
  readonly label: string;
  readonly kind: "status" | "context";
  readonly value: string;
  readonly delta: string | null;
  readonly series: Series;
  readonly bounds: FlowBounds | null;
  readonly slice: TileSlice | null;
  readonly partial: boolean;
  readonly format: (value: number) => string;
  readonly line: string | null;
  readonly severity: FlowSeverity;
  readonly icon: FlowSeverity;
  readonly muted: boolean;
  readonly target: string;
}

export interface ScorecardRow {
  readonly name: FlowGroup;
  readonly tiles: readonly ScorecardTile[];
}

export interface Scorecard {
  readonly qualifier: string;
  readonly noTurns: boolean;
  readonly rows: readonly ScorecardRow[];
}

interface Metric {
  readonly group: FlowGroup;
  readonly label: string;
  readonly unit: TileUnit;
  readonly value: (read: FlowRead) => number | null;
  readonly previous: (read: FlowRead) => number | null;
  readonly series: (read: FlowRead) => Series;
}

interface StatusMetric extends Metric {
  readonly kind: "status";
  readonly id: StatusId;
  readonly short: string;
  readonly slices?: (read: FlowRead) => readonly FlowSlice[];
}

interface ContextMetric extends Metric {
  readonly kind: "context";
  readonly id: string;
  readonly line: (read: FlowRead) => string | null;
}

const NO_VALUE = "—";

const VALUE_TEXT: Readonly<Record<TileUnit, (value: number) => string>> = {
  usd: costText,
  tokens: tokensText,
  ratio: rateText,
};

const BOUND_TEXT: Readonly<Record<TileUnit, (value: number) => string>> = {
  ...VALUE_TEXT,
  ratio: rateBoundText,
};

const tokensOf = (usage: FlowUsageTotals): number => usage.input_tokens + usage.output_tokens;

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function perSuccess(total: number, success: number): number | null {
  return success >= MIN_SUCCESS ? total / success : null;
}

function bucketed(
  numerators: readonly number[],
  denominators: readonly number[],
  quotient: (numerator: number, denominator: number) => number | null,
): Series {
  return numerators.map((numerator, index) => quotient(numerator, denominators[index] ?? 0));
}

export function isUnpriced(row: FlowUsageTotals): boolean {
  return row.cost_usd === 0 && row.unpriced_tokens > 0;
}

const cacheRatioOf = (usage: FlowUsageTotals): number | null =>
  ratio(usage.cache_read_tokens, usage.input_tokens);

function cacheSlicesOf(read: FlowRead): readonly FlowSlice[] {
  return read.usage.by.model
    .filter((row) => row.turn_count >= MIN_MODEL_TURNS)
    .map((row) => ({ key: row.key, window: cacheRatioOf(row), series: row.series.cache_hit }));
}

function totalCostLine({ cost }: FlowRead): string | null {
  const { current, previous_same_hour: sameHour } = cost;
  if (sameHour === null || sameHour.success <= 0 || current.success <= 0) return null;
  const previousUnit = sameHour.total_usd / sameHour.success;
  const volume = (current.success - sameHour.success) * previousUnit;
  const unitCost = (current.total_usd / current.success - previousUnit) * current.success;
  const change = costChangeText(current.total_usd, sameHour.total_usd);
  return `${change} = volume ${costChangeText(volume, 0)} · unit cost ${costChangeText(unitCost, 0)}`;
}

function rejectedReviewLine(read: FlowRead): string {
  const { current } = stageResultOf(read, "outcome");
  const rework = countText(exitCountOf(current, ["rework"]));
  const blocked = countText(exitCountOf(current, ["blocked"]));
  return `${rework} rework · ${blocked} blocked`;
}

function totalTokensLine({ usage }: FlowRead): string {
  const { cache_read_tokens: cache, input_tokens: input, output_tokens: output } = usage.current;
  return `cache ${tokensText(cache)} · fresh ${tokensText(input - cache)} · out ${tokensText(output)}`;
}

function unpricedLine({ usage }: FlowRead): string | null {
  const workers = usage.by.worker_name.filter(isUnpriced).map((row) => row.key);
  return workers.length === 0 ? null : `${workers.join(", ")} · not in cost`;
}

const TOTAL_COST: ContextMetric = {
  kind: "context",
  id: "tile.total_cost",
  group: "Cost",
  label: "Total cost",
  unit: "usd",
  value: ({ cost }) => cost.current.total_usd,
  previous: ({ cost }) => cost.previous_same_hour?.total_usd ?? null,
  series: ({ cost }) => cost.series.total_usd,
  line: totalCostLine,
};

const COST_PER_SUCCESS: StatusMetric = {
  kind: "status",
  id: "tile.cost_per_success",
  group: "Cost",
  label: "Cost per success",
  short: "cost per success",
  unit: "usd",
  value: ({ cost }) => perSuccess(cost.current.total_usd, cost.current.success),
  previous: ({ cost }) =>
    cost.previous === null ? null : perSuccess(cost.previous.total_usd, cost.previous.success),
  series: ({ cost }) => bucketed(cost.series.total_usd, cost.series.success, perSuccess),
};

const LEAKED_SHARE: StatusMetric = {
  kind: "status",
  id: "tile.leaked_share",
  group: "Cost",
  label: "Leaked cost share",
  short: "leaked cost",
  unit: "ratio",
  value: ({ cost }) => ratio(cost.current.leaked_usd, cost.current.total_usd),
  previous: ({ cost }) =>
    cost.previous === null ? null : ratio(cost.previous.leaked_usd, cost.previous.total_usd),
  series: ({ cost }) => bucketed(cost.series.leaked_usd, cost.series.total_usd, ratio),
};

const REJECTED_REVIEW: ContextMetric = {
  kind: "context",
  id: "tile.rejected_review_cost",
  group: "Cost",
  label: "Rejected review cost",
  unit: "usd",
  value: ({ cost }) => cost.current.rejected_review_usd,
  previous: ({ cost }) => cost.previous_same_hour?.rejected_review_usd ?? null,
  series: ({ cost }) => cost.series.rejected_review_usd,
  line: rejectedReviewLine,
};

const TOTAL_TOKENS: ContextMetric = {
  kind: "context",
  id: "tile.total_tokens",
  group: "Tokens",
  label: "Total tokens",
  unit: "tokens",
  value: ({ usage }) => tokensOf(usage.current),
  previous: ({ usage }) =>
    usage.previous_same_hour === null ? null : tokensOf(usage.previous_same_hour),
  series: ({ usage }) => usage.series.total_tokens,
  line: totalTokensLine,
};

const TOKENS_PER_SUCCESS: StatusMetric = {
  kind: "status",
  id: "tile.tokens_per_success",
  group: "Tokens",
  label: "Tokens per success",
  short: "tokens per success",
  unit: "tokens",
  value: ({ usage, cost }) => perSuccess(tokensOf(usage.current), cost.current.success),
  previous: ({ usage, cost }) =>
    usage.previous === null || cost.previous === null
      ? null
      : perSuccess(tokensOf(usage.previous), cost.previous.success),
  series: ({ usage, cost }) => bucketed(usage.series.total_tokens, cost.series.success, perSuccess),
};

const CACHE_HIT: StatusMetric = {
  kind: "status",
  id: "tile.cache_hit",
  group: "Tokens",
  label: "Cache hit ratio",
  short: "cache hit",
  unit: "ratio",
  value: ({ usage }) => cacheRatioOf(usage.current),
  previous: ({ usage }) => (usage.previous === null ? null : cacheRatioOf(usage.previous)),
  series: ({ usage }) => usage.series.cache_hit,
  slices: cacheSlicesOf,
};

const UNPRICED: ContextMetric = {
  kind: "context",
  id: "tile.unpriced",
  group: "Tokens",
  label: "Unpriced tokens",
  unit: "ratio",
  value: ({ usage }) => ratio(usage.current.unpriced_tokens, tokensOf(usage.current)),
  previous: ({ usage }) =>
    usage.previous_same_hour === null
      ? null
      : ratio(usage.previous_same_hour.unpriced_tokens, tokensOf(usage.previous_same_hour)),
  series: ({ usage }) => bucketed(usage.series.unpriced_tokens, usage.series.total_tokens, ratio),
  line: unpricedLine,
};

const STATUS_METRICS: readonly StatusMetric[] = [
  COST_PER_SUCCESS,
  LEAKED_SHARE,
  TOKENS_PER_SUCCESS,
  CACHE_HIT,
];

const ROWS: readonly {
  readonly name: FlowGroup;
  readonly metrics: readonly (StatusMetric | ContextMetric)[];
}[] = [
  { name: "Cost", metrics: [TOTAL_COST, COST_PER_SUCCESS, LEAKED_SHARE, REJECTED_REVIEW] },
  { name: "Tokens", metrics: [TOTAL_TOKENS, TOKENS_PER_SUCCESS, CACHE_HIT, UNPRICED] },
];

function targetOf(read: FlowRead, id: string, keys: readonly string[], first: number): string {
  const last = read.window.buckets.length - 1;
  return signalTarget(id, sliceParamsOf(read, keys), spanOf(read, first, last));
}

function signalOf(read: FlowRead, frame: FlowFrame, metric: StatusMetric): FlowSignal {
  const value = metric.value(read);
  const previous = metric.previous(read);
  const base: FlowSignal = {
    id: metric.id,
    where: "tile",
    stage: null,
    group: metric.group,
    metric: metric.label.toLowerCase(),
    label: metric.label,
    short: metric.short,
    unit: FLOW_THRESHOLDS[metric.id].unit,
    bounds: boundsOf(metric.id, previous),
    window: value,
    shown: value,
    previous,
    series: metric.series(read),
    slices: metric.slices?.(read) ?? [],
    slice: [],
    cause: null,
    target: targetOf(read, metric.id, [], 0),
  };
  const result = evaluate(base, frame);
  return result.sliceLevel ? { ...base, target: targetOf(read, metric.id, result.slice, 0) } : base;
}

export function tileSignalsOf(read: FlowRead, frame: FlowFrame): readonly FlowSignal[] {
  return STATUS_METRICS.map((metric) => signalOf(read, frame, metric));
}

function valueText(unit: TileUnit, value: number | null): string {
  return value === null ? NO_VALUE : VALUE_TEXT[unit](value);
}

function deltaOf(unit: TileUnit, value: number, previous: number | null): string {
  return unit === "ratio" ? rateDeltaText(value, previous) : deltaText(value, previous);
}

function sinceText(result: SignalResult, frame: FlowFrame): string {
  if (result.state !== "ongoing") return "";
  return ` · since ${frame.labels[result.since ?? frame.lastFull] ?? ""}`;
}

function statusLineOf(
  unit: TileUnit,
  signal: FlowSignal,
  result: SignalResult,
  frame: FlowFrame,
): string | null {
  const { bounds } = signal;
  if (bounds === null) return null;
  const operator = bounds.direction === "high" ? ">" : "<";
  if (result.state === "ok") {
    if (bounds.warn === null) return null;
    return `within · warn ${operator} ${BOUND_TEXT[unit](bounds.warn)}`;
  }
  const bound = result.severity === "ok" ? null : bounds[result.severity];
  if (bound === null) return null;
  const limit = `${operator} ${BOUND_TEXT[unit](bound)}`;
  const value = valueText(unit, result.value);
  const period = result.period ?? frame.range;
  if (result.state === "ended") {
    return period === frame.range
      ? `ended · ${value} ${period} ${limit}`
      : `ended · ${period} ${value} ${limit}`;
  }
  const slice = result.sliceLevel ? `${result.slice.join(", ")} ` : "";
  return `${slice}${value} ${period} ${limit}${sinceText(result, frame)}`;
}

function sliceOf(signal: FlowSignal, result: SignalResult): TileSlice | null {
  if (!result.sliceLevel) return null;
  const found = signal.slices.find((slice) => slice.key === result.slice[0]);
  if (found === undefined || found.series === null) return null;
  return { key: found.key, values: found.series, severity: result.severity };
}

function statusTileOf(read: FlowRead, frame: FlowFrame, metric: StatusMetric): ScorecardTile {
  const signal = signalOf(read, frame, metric);
  const result = evaluate(signal, frame);
  const active = isActive(result);
  const first = result.state === "ongoing" ? (result.since ?? 0) : 0;
  const keys = result.sliceLevel ? result.slice : [];
  return {
    id: metric.id,
    label: metric.label,
    kind: "status",
    value: valueText(metric.unit, signal.shown),
    delta: signal.shown === null ? null : deltaOf(metric.unit, signal.shown, signal.previous),
    series: signal.series ?? [],
    bounds: signal.bounds,
    slice: sliceOf(signal, result),
    partial: frame.partial,
    format: VALUE_TEXT[metric.unit],
    line: statusLineOf(metric.unit, signal, result, frame),
    severity: active ? result.severity : "ok",
    icon: active ? result.severity : "ok",
    muted: !active,
    target: targetOf(read, metric.id, keys, first),
  };
}

function contextTileOf(read: FlowRead, frame: FlowFrame, metric: ContextMetric): ScorecardTile {
  const value = metric.value(read);
  const previous = metric.previous(read);
  return {
    id: metric.id,
    label: metric.label,
    kind: "context",
    value: valueText(metric.unit, value),
    delta: value === null || previous === null ? null : deltaOf(metric.unit, value, previous),
    series: metric.series(read),
    bounds: null,
    slice: null,
    partial: frame.partial,
    format: VALUE_TEXT[metric.unit],
    line: metric.line(read),
    severity: "ok",
    icon: "ok",
    muted: true,
    target: targetOf(read, metric.id, [], 0),
  };
}

function qualifierOf(read: FlowRead): string {
  const { previous_window: window } = read;
  if (window === null) return "no comparison: no aggregates";
  const previous = `vs ${dayLabel(window.from)} – ${dayLabel(window.to - 1)}`;
  if (read.cost.previous_same_hour === null || read.usage.previous_same_hour === null) {
    return previous;
  }
  const share = UNPRICED.value(read);
  const excludes = share === null ? "" : `, excludes ${rateText(share)} unpriced tokens`;
  return `${previous} to the same hour · cost: list-price estimate${excludes}`;
}

export function scorecardOf(read: FlowRead, frame: FlowFrame): Scorecard {
  const noTurns = read.usage.current.turn_count === 0;
  const rows = noTurns ? ROWS.slice(0, 1) : ROWS;
  return {
    qualifier: qualifierOf(read),
    noTurns,
    rows: rows.map((row) => ({
      name: row.name,
      tiles: row.metrics.map((metric) =>
        metric.kind === "status"
          ? statusTileOf(read, frame, metric)
          : contextTileOf(read, frame, metric),
      ),
    })),
  };
}
