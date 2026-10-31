import type { FlowExit, FlowRead, FlowStage, FlowStageResult, FlowStageWindow } from "@/api/types";

import { dayTarget, spanOf } from "./flow-drill";
import {
  costText,
  countText,
  durationText,
  rateText,
  ratioText,
  runLabel,
  tokensText,
} from "./flow-format";
import type { FlowScope } from "./flow-query";
import {
  exitCountOf,
  leakedOf,
  loopsOf,
  settledOf,
  stageResultOf,
  stageSignalsOf,
} from "./flow-signals";
import {
  evaluate,
  type FlowFrame,
  type FlowSeverity,
  type FlowSignal,
  type FlowState,
  type FlowUnit,
  isActive,
  scoreOf,
  severityOf,
  type SignalResult,
} from "./flow-status";
import { MIN_SETTLED } from "./flow-thresholds";

export interface FlowHeadline {
  readonly label: string;
  readonly value: string;
  readonly severity: FlowSeverity;
}

export interface FlowException {
  readonly text: string;
  readonly severity: FlowSeverity;
  readonly muted: boolean;
  readonly reader: string;
}

export interface FlowDayCell {
  readonly day: string;
  readonly severity: FlowSeverity;
  readonly partial: boolean;
  readonly underSettled: boolean;
  readonly changed: boolean;
  readonly label: string;
  readonly target: string;
}

export interface FlowDayStrip {
  readonly metric: string;
  readonly cells: readonly FlowDayCell[];
}

export interface FlowSegment {
  readonly kind: "forward" | "loops" | "leaks";
  readonly count: number;
  readonly severity: FlowSeverity;
}

export interface FlowExitsBand {
  readonly header: string;
  readonly lines: readonly string[];
}

export interface FlowTimeBand {
  readonly name: string;
  readonly range: string;
  readonly previous: string;
  readonly glyph: string | null;
  readonly severity: FlowSeverity;
}

export interface FlowSignalLine {
  readonly glyph: string | null;
  readonly text: string;
  readonly severity: FlowSeverity;
  readonly state: FlowState;
  readonly reader: string;
}

export interface FlowSignalsBand {
  readonly lines: readonly FlowSignalLine[];
  readonly context: readonly string[];
}

export interface FlowBands {
  readonly exits: FlowExitsBand;
  readonly time: FlowTimeBand;
  readonly signals: FlowSignalsBand;
  readonly notInRates: readonly string[];
}

export interface FlowColumn {
  readonly stage: FlowStage;
  readonly name: string;
  readonly icon: FlowSeverity;
  readonly headline: FlowHeadline;
  readonly exception: FlowException | null;
  readonly strip: FlowDayStrip;
  readonly bar: readonly FlowSegment[];
  readonly exits: string;
  readonly entered: string;
  readonly bands: FlowBands;
}

export interface FlowLegendEntry {
  readonly glyph: string;
  readonly label: string;
}

export interface FlowModel {
  readonly columns: readonly FlowColumn[];
  readonly loops: string | null;
  readonly legend: readonly FlowLegendEntry[];
}

interface Evaluated {
  readonly signal: FlowSignal;
  readonly result: SignalResult;
}

interface StagePart {
  readonly stage: FlowStage;
  readonly name: string;
  readonly key: string;
  readonly time: string | null;
  readonly timeName: string;
  readonly leak: string | null;
  readonly loop: string | null;
}

const STAGE_PARTS: readonly StagePart[] = [
  {
    stage: "queued",
    name: "Queued",
    key: "queued.wait",
    time: null,
    timeName: "wait",
    leak: null,
    loop: null,
  },
  {
    stage: "executing",
    name: "Executing",
    key: "executing.leak",
    time: "executing.time",
    timeName: "exec",
    leak: "executing.leak",
    loop: null,
  },
  {
    stage: "verification",
    name: "Verification",
    key: "verification.flaky",
    time: "verification.time",
    timeName: "run",
    leak: null,
    loop: null,
  },
  {
    stage: "release_gate",
    name: "Release gate",
    key: "release_gate.leak",
    time: "release_gate.time",
    timeName: "gate",
    leak: "release_gate.leak",
    loop: null,
  },
  {
    stage: "evaluation",
    name: "Evaluation",
    key: "evaluation.review",
    time: "evaluation.review",
    timeName: "review wait",
    leak: "evaluation.leak",
    loop: null,
  },
  {
    stage: "outcome",
    name: "Outcome",
    key: "outcome.rework",
    time: null,
    timeName: "lead",
    leak: "outcome.blocked",
    loop: "outcome.rework",
  },
];

const EXIT_LINES = [
  ["completed", "✓"],
  ["external", "✓"],
  ["stopped", "↓"],
  ["paused", "↓"],
  ["revoked", "↓"],
  ["blocked", "↓"],
  ["budget", "↺"],
  ["further_work", "↺"],
  ["rework", "↺"],
  ["handed_on", "→"],
] as const satisfies readonly (readonly [FlowExit, string])[];

const NO_VALUE = "—";
const PARTIAL_STATUS = "today, partial";
const LATE_RECORDS = "changed by late records";
const LEAK_KEYS = new Set(["executing.leak", "release_gate.leak"]);
const UNOBSERVED_STAGES = new Set<FlowStage>(["verification", "release_gate"]);
const SEVERITY_GLYPH: Readonly<Record<FlowSeverity, string>> = { ok: "▢", warn: "◐", bad: "■" };
const SEVERITY_STATUS: Readonly<Record<FlowSeverity, string>> = {
  ok: "within",
  warn: "warn",
  bad: "bad",
};
const SEVERITY_ORDER: readonly FlowSeverity[] = ["bad", "warn"];
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

function timeText(value: number | null | undefined): string {
  return value === null || value === undefined ? NO_VALUE : durationText(value);
}

function forwardOf(window: FlowStageWindow): number {
  return settledOf(window) - leakedOf(window) - loopsOf(window);
}

function entryOf(entries: readonly Evaluated[], id: string | null): Evaluated | undefined {
  return entries.find((entry) => entry.signal.id === id);
}

function keyEntryOf(entries: readonly Evaluated[], part: StagePart): Evaluated {
  const entry = entryOf(entries, part.key);
  if (entry === undefined) throw new Error(`No key signal ${part.key}`);
  return entry;
}

function iconOf(entries: readonly Evaluated[]): FlowSeverity {
  const active = entries.filter((entry) => isActive(entry.result));
  return (
    SEVERITY_ORDER.find((severity) => active.some((e) => e.result.severity === severity)) ?? "ok"
  );
}

function headlineOf({ signal, result }: Evaluated, frame: FlowFrame): FlowHeadline {
  const ongoing = result.state === "ongoing";
  const value = ongoing ? result.value : signal.shown;
  const period = ongoing ? (result.period ?? frame.range) : frame.range;
  return {
    label: signal.label,
    value: `${valueText(signal.unit, value)} ${period}`,
    severity: isActive(result) ? result.severity : "ok",
  };
}

function exceptionOf(
  entries: readonly Evaluated[],
  part: StagePart,
  frame: FlowFrame,
): FlowException | null {
  const top = entries
    .filter((entry) => entry.signal.id !== part.key && scoreOf(entry.result) > 0)
    .reduce<Evaluated | undefined>(
      (best, entry) =>
        best === undefined || scoreOf(entry.result) > scoreOf(best.result) ? entry : best,
      undefined,
    );
  if (top === undefined) return null;
  const { signal, result } = top;
  const ended = result.state === "ended";
  const value = valueText(signal.unit, result.value);
  return {
    text: `${SEVERITY_GLYPH[result.severity]} ${signal.label} ${value} · ${result.period ?? frame.range}`,
    severity: result.severity,
    muted: ended,
    reader: ended ? " ended" : "",
  };
}

function statusOf(partial: boolean, underSettled: boolean, severity: FlowSeverity): string {
  if (partial) return PARTIAL_STATUS;
  if (underSettled) return `under ${MIN_SETTLED} settled`;
  return SEVERITY_STATUS[severity];
}

function stripOf(
  read: FlowRead,
  frame: FlowFrame,
  scope: FlowScope,
  part: StagePart,
  { signal }: Evaluated,
): FlowDayStrip {
  const { series } = stageResultOf(read, part.stage);
  const cells = read.window.buckets.map((_, index): FlowDayCell => {
    const partial = index > frame.lastFull;
    const value = signal.series?.[index] ?? null;
    const settled = (series.entered[index] ?? 0) - (series.open[index] ?? 0);
    const underSettled = !partial && LEAK_KEYS.has(signal.id) && settled < MIN_SETTLED;
    const severity = partial || underSettled ? "ok" : severityOf(value, signal.bounds);
    const changed = series.changed_after_end[index] === true;
    const day = frame.labels[index] ?? "";
    const status = statusOf(partial, underSettled, severity);
    return {
      day,
      severity,
      partial,
      underSettled,
      changed,
      label: `${day}: ${signal.metric} ${valueText(signal.unit, value)}, ${status}${changed ? `, ${LATE_RECORDS}` : ""}`,
      target: dayTarget(part.stage, scope, spanOf(read, index, index)),
    };
  });
  return { metric: signal.metric, cells };
}

function segmentSeverity(entry: Evaluated | undefined): FlowSeverity {
  return entry !== undefined && isActive(entry.result) ? entry.result.severity : "ok";
}

function barOf(
  window: FlowStageWindow,
  entries: readonly Evaluated[],
  part: StagePart,
): readonly FlowSegment[] {
  const segments: readonly FlowSegment[] = [
    { kind: "forward", count: forwardOf(window), severity: "ok" },
    {
      kind: "loops",
      count: loopsOf(window),
      severity: segmentSeverity(entryOf(entries, part.loop)),
    },
    {
      kind: "leaks",
      count: leakedOf(window),
      severity: segmentSeverity(entryOf(entries, part.leak)),
    },
  ];
  return segments.filter((segment) => segment.count > 0);
}

function exitSummaryOf(stage: FlowStage, window: FlowStageWindow): string {
  const forward: readonly [string, number] = ["✓", forwardOf(window)];
  const loops: readonly [string, number] = ["↺", loopsOf(window)];
  const leaked: readonly [string, number] = ["↓", leakedOf(window)];
  const handedOn: readonly [string, number] = [
    "→",
    stage === "release_gate" ? exitCountOf(window, ["handed_on"]) : 0,
  ];
  const parts = stage === "outcome" ? [forward, loops, leaked] : [leaked, loops, handedOn];
  return parts
    .filter(([, count]) => count > 0)
    .map(([glyph, count]) => `${glyph} ${countText(count)}`)
    .join(" ");
}

function exitsBandOf(stage: FlowStage, window: FlowStageWindow): FlowExitsBand {
  if (stage === "queued") return { header: NO_VALUE, lines: [] };
  const settled = settledOf(window);
  const rate = settled > 0 ? rateText(forwardOf(window) / settled) : NO_VALUE;
  const lines = EXIT_LINES.flatMap(([exit, glyph]) => {
    const count = exitCountOf(window, [exit]);
    if (count === 0) return [];
    const name = exit.replace(/_/g, " ");
    return [`${glyph} ${countText(count)} ${name}${exit === "rework" ? " → Queued" : ""}`];
  });
  return { header: `${stage === "outcome" ? "success" : "pass"} ${rate}`, lines };
}

function timeBandOf(
  part: StagePart,
  stage: FlowStageResult,
  entries: readonly Evaluated[],
): FlowTimeBand {
  const timed = entryOf(entries, part.time);
  const active = timed !== undefined && isActive(timed.result);
  const { time } = stage.current;
  return {
    name: part.timeName,
    range: `${timeText(time?.p50)} / ${timeText(time?.p90)}`,
    previous: `prev p90 ${timeText(stage.previous?.time?.p90)}`,
    glyph: active ? SEVERITY_GLYPH[timed.result.severity] : null,
    severity: active ? timed.result.severity : "ok",
  };
}

function signalPeriodOf(result: SignalResult, frame: FlowFrame): string {
  if (result.state === "ended") return ` · ended ${runLabel(result.days, frame.labels)}`;
  if (result.state !== "ongoing") return "";
  return ` · since ${frame.labels[result.since ?? frame.lastFull] ?? ""}`;
}

function signalLineOf({ signal, result }: Evaluated, frame: FlowFrame): FlowSignalLine {
  const shown = valueText(signal.unit, signal.shown);
  const previous = valueText(signal.unit, signal.previous);
  return {
    glyph: signal.bounds === null ? null : SEVERITY_GLYPH[result.severity],
    text: `${signal.metric} ${shown} (${previous})${signalPeriodOf(result, frame)}`,
    severity: result.severity,
    state: result.state,
    reader: SEVERITY_STATUS[result.severity],
  };
}

function countOf(window: FlowStageWindow, key: string): string {
  return countText(window.signals[key] ?? 0);
}

function unrecordedOf(read: FlowRead): number {
  const decided = stageResultOf(read, "evaluation").current;
  const decidedCount = ["judgement", "affected", "verification", "setup"].reduce(
    (sum, name) => sum + (decided.signals[`evaluation_${name}`] ?? 0),
    0,
  );
  return exitCountOf(stageResultOf(read, "outcome").current, ["rework", "blocked"]) - decidedCount;
}

type ContextOf = (stage: FlowStageResult, read: FlowRead) => readonly string[];

const CONTEXT: Readonly<Record<FlowStage, ContextOf>> = {
  queued: ({ current, previous }) => [
    `wait p99 ${timeText(current.time?.p99)} (${timeText(previous?.time?.p99)})`,
  ],
  executing: ({ current }) => {
    const turns = current.signals.turns_per_execution;
    return [
      `turns / execution ${turns === undefined ? NO_VALUE : ratioText(turns)}`,
      `other turn errors ${countOf(current, "turn_error_other")}`,
    ];
  },
  verification: ({ current }) => [
    `flaky tests ${countOf(current, "flaky_tests")} · routed runs ${countOf(current, "gate_routed")}`,
  ],
  release_gate: ({ current }) => [
    `verdicts: passed ${countOf(current, "gate_affected_passed")} · base_red ${countOf(current, "gate_affected_base_red")} · absent ${countOf(current, "gate_affected_absent")}`,
  ],
  evaluation: ({ current }, read) => [
    `decided at: judgement ${countOf(current, "evaluation_judgement")} · affected ${countOf(current, "evaluation_affected")} · verification ${countOf(current, "evaluation_verification")} · setup ${countOf(current, "evaluation_setup")} · unrecorded ${countText(unrecordedOf(read))}`,
  ],
  outcome: ({ current, previous }) => [
    `blocked by rule: rework_limit ${countOf(current, "blocked_rework_limit")} · plan_defect ${countOf(current, "blocked_plan_defect")}`,
    `success ${countOf(current, "success")} (${previous === null ? NO_VALUE : countOf(previous, "success")})`,
  ],
};

function signalsBandOf(
  read: FlowRead,
  frame: FlowFrame,
  part: StagePart,
  stage: FlowStageResult,
  entries: readonly Evaluated[],
): FlowSignalsBand {
  return {
    lines: entries
      .filter((entry) => entry.signal.id !== part.time)
      .map((entry) => signalLineOf(entry, frame)),
    context: CONTEXT[part.stage](stage, read),
  };
}

const UNOBSERVED_LINES = [
  ["unobserved_external", "telemetry"],
  ["unobserved_no_gate", "gate run"],
] as const;

function unobservedLinesOf(read: FlowRead): readonly string[] {
  const verification = stageResultOf(read, "verification");
  return UNOBSERVED_LINES.flatMap(([key, missing]) => {
    const count = verification.current.signals[key] ?? 0;
    if (count <= 0) return [];
    const workers = verification.dimensions
      .filter((dimension) => dimension.by === "worker_name" && (dimension.signals[key] ?? 0) > 0)
      .map((dimension) => dimension.key);
    const named = workers.length === 0 ? "" : ` (${workers.join(", ")})`;
    return [`${countText(count)} passed with no ${missing}${named}`];
  });
}

function notInRatesOf(read: FlowRead, stage: FlowStageResult): readonly string[] {
  const { open } = stage.current;
  const lines = [
    ...(open > 0 ? [`○ ${countText(open)} open`] : []),
    ...(UNOBSERVED_STAGES.has(stage.stage) ? unobservedLinesOf(read) : []),
  ];
  return lines.length === 0 ? [NO_VALUE] : lines;
}

function columnOf(
  read: FlowRead,
  frame: FlowFrame,
  scope: FlowScope,
  part: StagePart,
  entries: readonly Evaluated[],
): FlowColumn {
  const stage = stageResultOf(read, part.stage);
  const key = keyEntryOf(entries, part);
  return {
    stage: part.stage,
    name: part.name,
    icon: iconOf(entries),
    headline: headlineOf(key, frame),
    exception: exceptionOf(entries, part, frame),
    strip: stripOf(read, frame, scope, part, key),
    bar: barOf(stage.current, entries, part),
    exits: exitSummaryOf(part.stage, stage.current),
    entered: `${countText(stage.current.entered)} in`,
    bands: {
      exits: exitsBandOf(part.stage, stage.current),
      time: timeBandOf(part, stage, entries),
      signals: signalsBandOf(read, frame, part, stage, entries),
      notInRates: notInRatesOf(read, stage),
    },
  };
}

function loopLineOf(read: FlowRead): string | null {
  const loops = read.stages.reduce((sum, stage) => sum + loopsOf(stage.current), 0);
  return loops > 0 ? `↺ ${countText(loops)} loops re-enter Queued` : null;
}

function legendOf(columns: readonly FlowColumn[]): readonly FlowLegendEntry[] {
  const cells = columns.flatMap((column) => column.strip.cells);
  const severities = new Set<FlowSeverity>([
    ...cells.filter((cell) => !cell.partial && !cell.underSettled).map((cell) => cell.severity),
    ...columns.map((column) => column.icon).filter((icon) => icon !== "ok"),
    ...columns.flatMap((column) => (column.exception === null ? [] : [column.exception.severity])),
  ]);
  const shows = (glyph: string) => columns.some((column) => column.exits.includes(glyph));
  const entries: readonly (readonly [boolean, FlowLegendEntry])[] = [
    [severities.has("ok"), { glyph: SEVERITY_GLYPH.ok, label: SEVERITY_STATUS.ok }],
    [severities.has("warn"), { glyph: SEVERITY_GLYPH.warn, label: SEVERITY_STATUS.warn }],
    [severities.has("bad"), { glyph: SEVERITY_GLYPH.bad, label: SEVERITY_STATUS.bad }],
    [
      cells.some((cell) => cell.underSettled),
      { glyph: "┄", label: `under ${MIN_SETTLED} settled` },
    ],
    [cells.some((cell) => cell.partial), { glyph: "◔", label: PARTIAL_STATUS }],
    [shows("↓"), { glyph: "↓", label: "leak" }],
    [shows("↺"), { glyph: "↺", label: "loop" }],
    [shows("→"), { glyph: "→", label: "handed on" }],
    [shows("✓"), { glyph: "✓", label: "success" }],
  ];
  return entries.filter(([present]) => present).map(([, entry]) => entry);
}

export function flowOf(read: FlowRead, frame: FlowFrame, scope: FlowScope): FlowModel {
  const evaluated = stageSignalsOf(read, frame, scope).map((signal) => ({
    signal,
    result: evaluate(signal, frame),
  }));
  const columns = STAGE_PARTS.map((part) =>
    columnOf(
      read,
      frame,
      scope,
      part,
      evaluated.filter((entry) => entry.signal.stage === part.stage),
    ),
  );
  return { columns, loops: loopLineOf(read), legend: legendOf(columns) };
}
