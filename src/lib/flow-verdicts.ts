import type { FlowRead, FlowStage } from "@/api/types";

import { unattributedSignalOf } from "./flow-causes";
import { dataSignalOf } from "./flow-completeness";
import { costTabTarget, signalTarget, sliceParamsOf, spanOf, targetLabel } from "./flow-drill";
import {
  costText,
  countText,
  dayLabel,
  durationText,
  rateText,
  ratioText,
  runLabel,
  tokensText,
} from "./flow-format";
import type { FlowScope } from "./flow-query";
import { stageSignalsOf } from "./flow-signals";
import {
  boundText,
  evaluate,
  type FlowFrame,
  type FlowSeverity,
  type FlowSignal,
  type FlowUnit,
  severityOf,
  type SignalResult,
} from "./flow-status";
import { tileSignalsOf } from "./flow-tiles";

export interface VerdictLink {
  readonly label: string;
  readonly target: string;
}

export interface VerdictRow {
  readonly id: string;
  readonly state: "ongoing" | "range";
  readonly severity: FlowSeverity;
  readonly where: string;
  readonly whereTarget: string | null;
  readonly metric: string;
  readonly value: string;
  readonly bound: string;
  readonly since: string;
  readonly slice: string;
  readonly cause: string;
  readonly link: VerdictLink;
}

export interface VerdictGroup {
  readonly key: string;
  readonly severity: FlowSeverity;
  readonly text: string;
  readonly link: VerdictLink;
}

export interface Verdicts {
  readonly rows: readonly VerdictRow[];
  readonly groups: readonly VerdictGroup[];
  readonly days: string;
}

interface Evaluated {
  readonly signal: FlowSignal;
  readonly result: SignalResult;
}

interface Bucket {
  readonly key: string;
  readonly days: readonly number[];
  readonly members: readonly Evaluated[];
}

const NO_VALUE = "—";
const SEPARATOR = " · ";
const WINDOW_KEY = "window";
const SEVERITY_RANK: Readonly<Record<FlowSeverity, number>> = { ok: 0, warn: 1, bad: 2 };
const STAGE_NAMES: Readonly<Record<FlowStage, string>> = {
  queued: "Queued",
  executing: "Executing",
  verification: "Verification",
  release_gate: "Release gate",
  evaluation: "Evaluation",
  outcome: "Outcome",
};
const WHERE_NAMES = { why: "Why", data: "Data" } as const;
const UNIT_TEXT: Readonly<Record<FlowUnit, (value: number) => string>> = {
  ms: durationText,
  ratio: rateText,
  ratio2: ratioText,
  count: countText,
  usd: costText,
  tokens: tokensText,
};

function valueText(unit: FlowUnit, value: number | null): string {
  return value === null ? NO_VALUE : UNIT_TEXT[unit](value);
}

function whereOf(signal: FlowSignal): string {
  if (signal.where === "stage" && signal.stage !== null) return STAGE_NAMES[signal.stage];
  if (signal.where === "tile" && signal.group !== null) return signal.group;
  if (signal.where === "why" || signal.where === "data") return WHERE_NAMES[signal.where];
  throw new Error(`No place for ${signal.id}`);
}

function unique(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function sliceKeysOf({ signal, result }: Evaluated): readonly string[] {
  if (result.slice.length > 0) return result.slice;
  return signal.slices
    .filter((slice) => severityOf(slice.window, signal.bounds) !== "ok")
    .map((slice) => slice.key);
}

function joined(values: readonly string[]): string {
  return values.length === 0 ? NO_VALUE : values.join(SEPARATOR);
}

function linkOf(
  read: FlowRead,
  scope: FlowScope,
  signal: FlowSignal,
  slice: readonly string[],
  first: number,
  last: number,
): VerdictLink {
  const sliced = sliceParamsOf(read, slice);
  const target = signalTarget(
    signal.id,
    {
      project_id: sliced.project_id ?? scope.projectId,
      worker_name: sliced.worker_name ?? scope.workerName,
    },
    spanOf(read, first, last),
  );
  return { label: `${targetLabel(target)} →`, target };
}

function rowOf(read: FlowRead, frame: FlowFrame, scope: FlowScope, entry: Evaluated): VerdictRow {
  const { signal, result } = entry;
  const slice = sliceKeysOf(entry);
  const ongoing = result.state === "ongoing";
  const first = ongoing ? (result.since ?? 0) : 0;
  const period = result.period ?? frame.range;
  return {
    id: signal.id,
    state: ongoing ? "ongoing" : "range",
    severity: result.severity,
    where: whereOf(signal),
    whereTarget: signal.where === "tile" ? costTabTarget({ ...scope, range: frame.range }) : null,
    metric: signal.metric,
    value: `${valueText(signal.unit, result.value)} ${period}`,
    bound: boundText(signal, result.severity) ?? NO_VALUE,
    since: ongoing ? `since ${frame.labels[first] ?? ""}` : frame.range,
    slice: joined(slice),
    cause: signal.cause ?? NO_VALUE,
    link: linkOf(read, scope, signal, slice, first, read.window.buckets.length - 1),
  };
}

function activeRank({ state, severity }: Pick<VerdictRow, "state" | "severity">): number {
  return (state === "ongoing" ? 0 : 2) + (severity === "bad" ? 0 : 1);
}

function bucketsOf(ended: readonly Evaluated[]): readonly Bucket[] {
  const buckets = new Map<string, Bucket>();
  for (const entry of ended) {
    const days = [...entry.result.days].sort((a, b) => a - b);
    const key = days.length === 0 ? WINDOW_KEY : days.join(",");
    const found = buckets.get(key);
    buckets.set(key, { key, days, members: [...(found?.members ?? []), entry] });
  }
  return [...buckets.values()];
}

function worstOf(members: readonly Evaluated[]): FlowSeverity {
  return members.reduce<FlowSeverity>(
    (worst, { result }) =>
      SEVERITY_RANK[result.severity] > SEVERITY_RANK[worst] ? result.severity : worst,
    "ok",
  );
}

function memberText({ signal, result }: Evaluated): string {
  const upTo = result.days.length > 1 ? "up to " : "";
  return `${signal.short} ${upTo}${valueText(signal.unit, result.value)}`;
}

function groupOf(
  read: FlowRead,
  frame: FlowFrame,
  scope: FlowScope,
  { key, days, members }: Bucket,
): VerdictGroup {
  const slices = unique(members.flatMap(sliceKeysOf));
  const causes = unique(
    members.flatMap(({ signal }) => (signal.cause === null ? [] : [signal.cause])),
  );
  const [lead] = members;
  if (lead === undefined) throw new Error(`No member in group ${key}`);
  const dayText = days.length === 0 ? frame.range : runLabel(days, frame.labels);
  const first = days[0] ?? 0;
  const last = days.at(-1) ?? read.window.buckets.length - 1;
  return {
    key,
    severity: worstOf(members),
    text: [
      dayText,
      ...members.map(memberText),
      ...(slices.length === 0 ? [] : [joined(slices)]),
      ...(causes.length === 0 ? [] : [joined(causes)]),
    ].join(SEPARATOR),
    link: linkOf(read, scope, lead.signal, slices, first, last),
  };
}

function groupOrder(
  read: FlowRead,
  frame: FlowFrame,
  scope: FlowScope,
  buckets: readonly Bucket[],
) {
  const ranked = buckets.map((bucket) => ({
    bucket,
    group: groupOf(read, frame, scope, bucket),
    firstDay: bucket.days[0] ?? Number.POSITIVE_INFINITY,
  }));
  ranked.sort(
    (a, b) =>
      SEVERITY_RANK[b.group.severity] - SEVERITY_RANK[a.group.severity] ||
      b.bucket.members.length - a.bucket.members.length ||
      a.firstDay - b.firstDay,
  );
  return ranked.map(({ group }) => group);
}

export function verdictsOf(read: FlowRead, frame: FlowFrame, scope: FlowScope): Verdicts {
  const signals = [
    ...stageSignalsOf(read, frame, scope),
    ...tileSignalsOf(read, frame),
    unattributedSignalOf(read, frame),
    dataSignalOf(read, frame),
  ];
  const entries = signals.map((signal) => ({ signal, result: evaluate(signal, frame) }));
  const rows = entries
    .filter(({ result }) => result.state === "ongoing" || result.state === "range")
    .map((entry) => rowOf(read, frame, scope, entry))
    .sort((a, b) => activeRank(a) - activeRank(b));
  const ended = entries.filter(({ result }) => result.state === "ended");
  const { buckets } = read.window;
  const first = buckets[0];
  const last = buckets.at(-1);
  if (first === undefined || last === undefined) throw new RangeError("No bucket in the window");
  return {
    rows,
    groups: groupOrder(read, frame, scope, bucketsOf(ended)),
    days: `${dayLabel(first)} – ${dayLabel(last)}`,
  };
}
