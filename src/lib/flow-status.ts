import type { FlowRead, FlowStage } from "@/api/types";

import {
  bucketLabel,
  costText,
  countText,
  durationBoundText,
  rateBoundText,
  ratioText,
  tokensText,
} from "./flow-format";
import type { FlowRange } from "./flow-query";

export type FlowSeverity = "ok" | "warn" | "bad";
export type FlowState = "ok" | "ended" | "range" | "ongoing";
export type FlowUnit = "ms" | "ratio" | "ratio2" | "count" | "usd" | "tokens";
export type FlowWhere = "stage" | "tile" | "why" | "data";
export type FlowGroup = "Cost" | "Tokens";

export interface FlowBounds {
  readonly direction: "high" | "low";
  readonly warn: number | null;
  readonly bad: number | null;
  readonly floor: number | null;
}

export interface FlowSlice {
  readonly key: string;
  readonly window: number | null;
  readonly series: readonly (number | null)[] | null;
}

export interface FlowSignal {
  readonly id: string;
  readonly where: FlowWhere;
  readonly stage: FlowStage | null;
  readonly group: FlowGroup | null;
  readonly metric: string;
  readonly label: string;
  readonly short: string;
  readonly unit: FlowUnit;
  readonly bounds: FlowBounds | null;
  readonly window: number | null;
  readonly shown: number | null;
  readonly previous: number | null;
  readonly series: readonly (number | null)[] | null;
  readonly slices: readonly FlowSlice[];
  readonly slice: readonly string[];
  readonly cause: string | null;
  readonly target: string;
}

export interface FlowFrame {
  readonly labels: readonly string[];
  readonly lastFull: number;
  readonly partial: boolean;
  readonly range: FlowRange;
}

export interface SignalResult {
  readonly state: FlowState;
  readonly severity: FlowSeverity;
  readonly value: number | null;
  readonly period: string | null;
  readonly since: number | null;
  readonly days: readonly number[];
  readonly daySeverity: FlowSeverity;
  readonly slice: readonly string[];
  readonly sliceLevel: boolean;
}

type Reading = Omit<SignalResult, "slice" | "sliceLevel">;

const STATE_RANK: Readonly<Record<FlowState, number>> = { ok: 0, ended: 1, range: 2, ongoing: 3 };
const SEVERITY_RANK: Readonly<Record<FlowSeverity, number>> = { ok: 0, warn: 1, bad: 2 };
const STATE_WEIGHT = 10;

const SETTLED: Reading = {
  state: "ok",
  severity: "ok",
  value: null,
  period: null,
  since: null,
  days: [],
  daySeverity: "ok",
};

export function frameOf(read: FlowRead, range: FlowRange): FlowFrame {
  const { buckets, bucket, now, to } = read.window;
  const partial = now < to;
  return {
    labels: buckets.map((start) => bucketLabel(start, bucket)),
    lastFull: buckets.length - 1 - (partial ? 1 : 0),
    partial,
    range,
  };
}

export function severityOf(value: number | null, bounds: FlowBounds | null): FlowSeverity {
  if (value === null || !Number.isFinite(value) || bounds === null) return "ok";
  if (bounds.floor !== null && value < bounds.floor) return "ok";
  const sign = bounds.direction === "high" ? 1 : -1;
  const beyond = (bound: number | null) => bound !== null && sign * (value - bound) > 0;
  if (beyond(bounds.bad)) return "bad";
  return beyond(bounds.warn) ? "warn" : "ok";
}

function worstOf(severities: readonly FlowSeverity[]): FlowSeverity {
  return severities.reduce<FlowSeverity>(
    (worst, severity) => (SEVERITY_RANK[severity] > SEVERITY_RANK[worst] ? severity : worst),
    "ok",
  );
}

function windowReading(severity: FlowSeverity, value: number | null, frame: FlowFrame): Reading {
  return severity === "ok"
    ? SETTLED
    : { ...SETTLED, state: "range", severity, value, period: frame.range };
}

function runStartOf(breaching: readonly number[], lastFull: number): number {
  let since = lastFull;
  while (breaching.includes(since - 1)) since -= 1;
  return since;
}

function peakIndexOf(
  breaching: readonly number[],
  full: readonly (number | null)[],
  bounds: FlowBounds | null,
): number {
  const sign = bounds?.direction === "low" ? -1 : 1;
  return breaching.reduce((peak, index) =>
    sign * ((full[index] ?? 0) - (full[peak] ?? 0)) > 0 ? index : peak,
  );
}

function seriesReading(
  bounds: FlowBounds | null,
  windowValue: number | null,
  series: readonly (number | null)[],
  frame: FlowFrame,
): Reading {
  const full = Array.from({ length: frame.lastFull + 1 }, (_, index) => series[index] ?? null);
  const severities = full.map((value) => severityOf(value, bounds));
  const breaching = severities.flatMap((severity, index) => (severity === "ok" ? [] : [index]));
  const daySeverity = worstOf(severities);
  const windowSeverity = severityOf(windowValue, bounds);
  if (breaching.at(-1) === frame.lastFull) {
    return {
      state: "ongoing",
      severity: severities[frame.lastFull] ?? "ok",
      value: full[frame.lastFull] ?? null,
      period: frame.labels[frame.lastFull] ?? null,
      since: runStartOf(breaching, frame.lastFull),
      days: breaching,
      daySeverity,
    };
  }
  if (breaching.length === 0 && windowSeverity === "ok") return SETTLED;
  const severity = worstOf([windowSeverity, daySeverity]);
  if (breaching.length === 0) {
    return { ...SETTLED, state: "ended", severity, value: windowValue, period: frame.range };
  }
  const peak = peakIndexOf(breaching, full, bounds);
  return {
    state: "ended",
    severity,
    value: full[peak] ?? null,
    period: frame.labels[peak] ?? null,
    since: null,
    days: breaching,
    daySeverity,
  };
}

function readingOf(
  bounds: FlowBounds | null,
  windowValue: number | null,
  series: readonly (number | null)[] | null,
  frame: FlowFrame,
): Reading {
  if (series === null || series.length === 0 || frame.lastFull < 0) {
    return windowReading(severityOf(windowValue, bounds), windowValue, frame);
  }
  return seriesReading(bounds, windowValue, series, frame);
}

export function scoreOf(result: Pick<SignalResult, "state" | "severity">): number {
  return STATE_WEIGHT * STATE_RANK[result.state] + SEVERITY_RANK[result.severity];
}

export function evaluate(signal: FlowSignal, frame: FlowFrame): SignalResult {
  const all: SignalResult = {
    ...readingOf(signal.bounds, signal.window, signal.series, frame),
    slice: signal.slice,
    sliceLevel: false,
  };
  return signal.slices.reduce<SignalResult>((best, slice) => {
    const candidate: SignalResult = {
      ...readingOf(signal.bounds, slice.window, slice.series, frame),
      slice: [slice.key],
      sliceLevel: true,
    };
    return scoreOf(candidate) > scoreOf(best) ? candidate : best;
  }, all);
}

export function isActive(result: Pick<SignalResult, "state">): boolean {
  return result.state === "ongoing" || result.state === "range";
}

function unitText(unit: FlowUnit, value: number): string {
  if (unit === "ms") return durationBoundText(value);
  if (unit === "ratio") return rateBoundText(value);
  if (unit === "ratio2") return ratioText(value);
  if (unit === "usd") return costText(value);
  if (unit === "tokens") return tokensText(value);
  return countText(value);
}

export function boundText(signal: FlowSignal, severity: FlowSeverity): string | null {
  const { bounds } = signal;
  if (severity === "ok" || bounds === null) return null;
  const bound = bounds[severity];
  if (bound === null) return null;
  if (bounds.floor !== null) {
    return `${severity} > ${unitText(signal.unit, bound)} a day and ≥ ${unitText(signal.unit, bounds.floor)}`;
  }
  const sign = bounds.direction === "high" ? ">" : "<";
  return `${severity} ${sign} ${unitText(signal.unit, bound)}`;
}
