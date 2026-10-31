import type {
  FlowExit,
  FlowRead,
  FlowStage,
  FlowStageDimension,
  FlowStageResult,
  FlowStageSeries,
  FlowStageWindow,
} from "@/api/types";

import { signalTarget, sliceParamsOf, spanOf } from "./flow-drill";
import type { FlowScope } from "./flow-query";
import { evaluate, type FlowFrame, type FlowSignal } from "./flow-status";
import { boundsOf, FLOW_THRESHOLDS, type FlowThresholdId, MIN_SETTLED } from "./flow-thresholds";

type Series = readonly (number | null)[];
type SliceOf = (result: FlowStageResult, signal: FlowSignal, frame: FlowFrame) => readonly string[];

interface SignalSpec {
  readonly id: FlowThresholdId;
  readonly stage: FlowStage;
  readonly metric: string;
  readonly label: string;
  readonly short: string;
  readonly value: (window: FlowStageWindow) => number | null;
  readonly series: (series: FlowStageSeries) => Series | null;
  readonly sumKey?: string;
  readonly slice?: SliceOf;
  readonly causeExits?: readonly FlowExit[];
}

const LEAK_EXITS = [
  "stopped",
  "paused",
  "revoked",
  "blocked",
] as const satisfies readonly FlowExit[];
const LOOP_EXITS = ["budget", "further_work", "rework"] as const satisfies readonly FlowExit[];

const OVERREPRESENTED_PERCENT = 15;
const PERCENT = 100;
const BY_ORDER = ["project_id", "worker_name"] as const;
const PROVIDER_ERRORS = ["rate_limited", "quota_exhausted", "unavailable"] as const;
const UNCAUSED = new Set(["", "unattributed"]);

export function exitCountOf(window: FlowStageWindow, exits: readonly FlowExit[]): number {
  return exits.reduce((sum, exit) => sum + (window.exits[exit]?.count ?? 0), 0);
}

export function settledOf(window: Pick<FlowStageWindow, "entered" | "open">): number {
  return window.entered - window.open;
}

export function leakedOf(window: FlowStageWindow): number {
  return exitCountOf(window, LEAK_EXITS);
}

export function loopsOf(window: FlowStageWindow): number {
  return exitCountOf(window, LOOP_EXITS);
}

export function stageResultOf(read: FlowRead, stage: FlowStage): FlowStageResult {
  const result = read.stages.find((candidate) => candidate.stage === stage);
  if (result === undefined) throw new Error(`No ${stage} stage in the flow read`);
  return result;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator > 0 ? numerator / denominator : null;
}

function signalRatio(
  window: FlowStageWindow,
  numerator: string,
  denominator: string,
  stored: string,
): number | null {
  const top = window.signals[numerator];
  const bottom = window.signals[denominator];
  const computed = top === undefined || bottom === undefined ? null : ratio(top, bottom);
  return computed ?? window.signals[stored] ?? null;
}

function ratioSeries(
  numerators: Series | undefined,
  denominators: Series | undefined,
): Series | null {
  if (numerators === undefined || denominators === undefined) return null;
  return denominators.map((denominator, index) => {
    const numerator = numerators[index];
    if (numerator === undefined || numerator === null) return null;
    return denominator === null || denominator < MIN_SETTLED ? null : numerator / denominator;
  });
}

function settledSeriesOf(series: FlowStageSeries): readonly number[] {
  return series.entered.map((entered, index) => entered - (series.open[index] ?? 0));
}

const p90Of = (window: FlowStageWindow): number | null => window.time?.p90 ?? null;
const timeSeriesOf = (series: FlowStageSeries): Series => series.time_p90;
const storedSeries =
  (key: string) =>
  (series: FlowStageSeries): Series | null =>
    series.signals[key] ?? null;
const noSeries = (): null => null;
const leakShareOf = (window: FlowStageWindow): number | null =>
  ratio(leakedOf(window), settledOf(window));

function overRepresentedKeys(
  dimensions: readonly FlowStageDimension[],
  countOf: (dimension: FlowStageDimension) => number,
): readonly string[] {
  const over = new Set<FlowStageDimension>();
  for (const by of BY_ORDER) {
    const group = dimensions.filter((dimension) => dimension.by === by);
    const total = group.reduce((sum, dimension) => sum + countOf(dimension), 0);
    const entered = group.reduce((sum, dimension) => sum + dimension.entered, 0);
    for (const dimension of group) {
      const count = countOf(dimension);
      const lead = PERCENT * (count * entered - dimension.entered * total);
      if (count > 0 && lead >= OVERREPRESENTED_PERCENT * total * entered) over.add(dimension);
    }
  }
  return dimensions.filter((dimension) => over.has(dimension)).map((dimension) => dimension.key);
}

const overRepresented =
  (countOf: (dimension: FlowStageDimension) => number): SliceOf =>
  (result) =>
    overRepresentedKeys(result.dimensions, countOf);

const bySignal = (key: string) => (dimension: FlowStageDimension) => dimension.signals[key] ?? 0;
const byLeaked = (dimension: FlowStageDimension) => dimension.leaked;
const byLoops = (dimension: FlowStageDimension) => dimension.loops;

const slowReviewers: SliceOf = (result, signal, frame) => {
  const severity = evaluate(signal, frame).severity;
  const bound = severity === "bad" ? signal.bounds?.bad : signal.bounds?.warn;
  if (bound === null || bound === undefined) return [];
  const slow = result.dimensions.filter((dimension) => (dimension.time?.p90 ?? 0) > bound);
  return BY_ORDER.flatMap((by) =>
    slow.filter((dimension) => dimension.by === by).map((dimension) => dimension.key),
  );
};

function providerSpec(error: (typeof PROVIDER_ERRORS)[number]): SignalSpec {
  const key = `turn_${error}`;
  return {
    id: `executing.turn_${error}`,
    stage: "executing",
    metric: `provider errors (${error})`,
    label: "provider errors",
    short: "provider errors",
    value: (window) => window.signals[key] ?? 0,
    series: storedSeries(key),
    sumKey: key,
    slice: overRepresented(bySignal(key)),
  };
}

const SPECS: readonly SignalSpec[] = [
  {
    id: "queued.wait",
    stage: "queued",
    metric: "wait p90",
    label: "wait p90",
    short: "Queued wait p90",
    value: p90Of,
    series: timeSeriesOf,
  },
  {
    id: "executing.leak",
    stage: "executing",
    metric: "leak rate",
    label: "leak rate",
    short: "Executing leak",
    value: leakShareOf,
    series: storedSeries("leak_rate"),
    slice: overRepresented(byLeaked),
    causeExits: LEAK_EXITS,
  },
  ...PROVIDER_ERRORS.map(providerSpec),
  {
    id: "executing.tool_error",
    stage: "executing",
    metric: "tool errors",
    label: "tool errors",
    short: "tool errors",
    value: (window) => window.signals.tool_error_rate ?? null,
    series: noSeries,
  },
  {
    id: "executing.time",
    stage: "executing",
    metric: "exec p90",
    label: "exec p90",
    short: "exec p90",
    value: p90Of,
    series: timeSeriesOf,
  },
  {
    id: "verification.flaky",
    stage: "verification",
    metric: "flaky runs",
    label: "flaky runs",
    short: "Verification flaky runs",
    value: (window) =>
      signalRatio(window, "affected_flaky_runs", "affected_runs", "flaky_run_share"),
    series: storedSeries("flaky_run_share"),
    slice: overRepresented(bySignal("affected_flaky_runs")),
    causeExits: ["budget"],
  },
  {
    id: "verification.loops",
    stage: "verification",
    metric: "revision loops",
    label: "revision loops",
    short: "revision loops",
    value: (window) => {
      const routed = window.signals.gate_routed;
      const computed = routed === undefined ? null : ratio(routed, window.entered);
      return computed ?? window.signals.loops_per_entry ?? null;
    },
    series: (series) => ratioSeries(series.signals.gate_routed, series.entered),
    slice: overRepresented(byLoops),
  },
  {
    id: "verification.fail",
    stage: "verification",
    metric: "affected fail",
    label: "affected fail",
    short: "affected fail",
    value: (window) =>
      signalRatio(window, "affected_failed", "affected_runs", "affected_fail_rate"),
    series: (series) => ratioSeries(series.signals.affected_failed, series.signals.affected_runs),
  },
  {
    id: "verification.base_red",
    stage: "verification",
    metric: "base red",
    label: "base red",
    short: "Verification base red",
    value: (window) => signalRatio(window, "affected_base_red", "affected_runs", "base_red_share"),
    series: (series) => ratioSeries(series.signals.affected_base_red, series.signals.affected_runs),
  },
  {
    id: "verification.time",
    stage: "verification",
    metric: "run p90",
    label: "run p90",
    short: "run p90",
    value: p90Of,
    series: timeSeriesOf,
  },
  {
    id: "release_gate.leak",
    stage: "release_gate",
    metric: "leak rate",
    label: "leak rate",
    short: "Release gate leak",
    value: leakShareOf,
    series: storedSeries("leak_rate"),
    slice: overRepresented(byLeaked),
  },
  {
    id: "release_gate.time",
    stage: "release_gate",
    metric: "gate p90",
    label: "gate p90",
    short: "gate p90",
    value: p90Of,
    series: timeSeriesOf,
  },
  {
    id: "evaluation.review",
    stage: "evaluation",
    metric: "review wait p90",
    label: "review p90",
    short: "review wait p90",
    value: p90Of,
    series: timeSeriesOf,
    slice: slowReviewers,
  },
  {
    id: "evaluation.leak",
    stage: "evaluation",
    metric: "leak rate",
    label: "leak",
    short: "Evaluation leak",
    value: leakShareOf,
    series: (series) => ratioSeries(series.leaked, settledSeriesOf(series)),
    slice: overRepresented(byLeaked),
    causeExits: LEAK_EXITS,
  },
  {
    id: "evaluation.time",
    stage: "evaluation",
    metric: "evaluation time p90",
    label: "evaluation time p90",
    short: "evaluation time p90",
    value: (window) => window.signals.evaluation_time_p90 ?? null,
    series: noSeries,
  },
  {
    id: "outcome.rework",
    stage: "outcome",
    metric: "rework rate",
    label: "rework",
    short: "Outcome rework",
    value: (window) => ratio(exitCountOf(window, ["rework"]), settledOf(window)),
    series: storedSeries("rework_rate"),
    slice: overRepresented(byLoops),
    causeExits: ["rework"],
  },
  {
    id: "outcome.blocked",
    stage: "outcome",
    metric: "blocked rate",
    label: "blocked",
    short: "Outcome blocked",
    value: (window) => ratio(exitCountOf(window, ["blocked"]), settledOf(window)),
    series: (series) => ratioSeries(series.leaked, settledSeriesOf(series)),
    slice: overRepresented(byLeaked),
    causeExits: ["blocked"],
  },
];

function soleMaximum(totals: ReadonlyMap<string, number>): string | null {
  const [first, second] = [...totals].sort((a, b) => b[1] - a[1]);
  if (first === undefined) return null;
  return second !== undefined && second[1] === first[1] ? null : first[0];
}

function totalsBy<T>(rows: readonly T[], keyOf: (row: T) => string, countOf: (row: T) => number) {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(keyOf(row), (totals.get(keyOf(row)) ?? 0) + countOf(row));
  return totals;
}

function causeOf(read: FlowRead, spec: SignalSpec): string | null {
  const { causeExits } = spec;
  if (causeExits === undefined) return null;
  const rows = read.causes.rows.filter(
    (row) =>
      row.stage === spec.stage && causeExits.includes(row.exit) && !UNCAUSED.has(row.category),
  );
  const category = soleMaximum(
    totalsBy(
      rows,
      (row) => row.category,
      (row) => row.count,
    ),
  );
  if (category === null) return null;
  const detail = soleMaximum(
    totalsBy(
      rows.filter((row) => row.category === category),
      (row) => row.detail,
      (row) => row.count,
    ),
  );
  return detail === null || detail === "" ? category : `${category}.${detail}`;
}

function targetOf(
  read: FlowRead,
  scope: FlowScope,
  id: FlowThresholdId,
  slice: readonly string[],
): string {
  const sliced = sliceParamsOf(read, slice);
  return signalTarget(
    id,
    {
      project_id: sliced.project_id ?? scope.projectId,
      worker_name: sliced.worker_name ?? scope.workerName,
    },
    spanOf(read, 0, read.window.buckets.length - 1),
  );
}

function signalOf(
  read: FlowRead,
  frame: FlowFrame,
  scope: FlowScope,
  spec: SignalSpec,
): FlowSignal {
  const result = stageResultOf(read, spec.stage);
  const shown = spec.value(result.current);
  const previous = result.previous === null ? null : spec.value(result.previous);
  const reference =
    spec.sumKey === undefined ? previous : (result.previous_bucket_median?.[spec.sumKey] ?? null);
  const base: FlowSignal = {
    id: spec.id,
    where: "stage",
    stage: spec.stage,
    group: null,
    metric: spec.metric,
    label: spec.label,
    short: spec.short,
    unit: FLOW_THRESHOLDS[spec.id].unit,
    bounds: boundsOf(spec.id, reference),
    window: spec.sumKey === undefined ? shown : null,
    shown,
    previous,
    series: spec.series(result.series),
    slices: [],
    slice: [],
    cause: causeOf(read, spec),
    target: targetOf(read, scope, spec.id, []),
  };
  const slice = spec.slice?.(result, base, frame) ?? [];
  return slice.length === 0
    ? base
    : { ...base, slice, target: targetOf(read, scope, spec.id, slice) };
}

export function stageSignalsOf(
  read: FlowRead,
  frame: FlowFrame,
  scope: FlowScope,
): readonly FlowSignal[] {
  return SPECS.map((spec) => signalOf(read, frame, scope, spec));
}
