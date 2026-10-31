import type { FlowCauseRow, FlowExit, FlowPreviousCauseRow, FlowRead } from "@/api/types";

import { causeTarget, signalTarget, spanOf } from "./flow-drill";
import { costText, countText, rateBoundText, rateText } from "./flow-format";
import type { FlowFilterStage, FlowScope } from "./flow-query";
import {
  evaluate,
  type FlowFrame,
  type FlowSeverity,
  type FlowSignal,
  isActive,
} from "./flow-status";
import { boundsOf } from "./flow-thresholds";

export interface ParetoOptions {
  readonly stage: FlowFilterStage | null;
  readonly includeBudget: boolean;
  readonly scope: FlowScope;
}

export interface CauseDetail {
  readonly name: string;
  readonly count: number;
  readonly assigners: string;
}

export interface CauseRow {
  readonly key: string;
  readonly name: string;
  readonly count: number;
  readonly countText: string;
  readonly suspectedText: string | null;
  readonly costText: string;
  readonly previousText: string;
  readonly doubled: boolean;
  readonly cumulativeText: string;
  readonly bar: number;
  readonly target: string | null;
  readonly details: readonly CauseDetail[];
}

export interface ParetoModel {
  readonly caused: number;
  readonly rows: readonly CauseRow[];
  readonly unattributed: CauseRow | null;
}

export interface UnattributedModel {
  readonly severity: FlowSeverity;
  readonly icon: string | null;
  readonly share: string;
  readonly comparison: string;
  readonly series: readonly (number | null)[];
  readonly bad: number | null;
  readonly partial: boolean;
  readonly caused: string;
  readonly manual: string;
  readonly target: string;
}

interface Tally {
  count: number;
  cost: number;
  suspected: number;
  details: Map<string, Map<string, number>>;
}

type Assigner = FlowCauseRow["assigner"];

const CAUSED_EXITS: readonly FlowExit[] = ["stopped", "paused", "revoked", "rework", "blocked"];
const UNATTRIBUTED = "unattributed";
const NO_CAUSE = "no cause";
const NO_DETAIL = "no detail";
const NO_VALUE = "—";
const PERCENT = 100;
const DOUBLED_AT_LEAST = 10;
const ASSIGNERS: readonly Assigner[] = ["rule", "reviewer", "human", ""];
const ASSIGNER_NAMES: Readonly<Record<Assigner, string>> = {
  rule: "rule",
  reviewer: "reviewer",
  human: "manual label",
  "": "no assigner",
};
const SEVERITY_ICON: Readonly<Record<FlowSeverity, string | null>> = {
  ok: null,
  warn: "⚠",
  bad: "✕",
};
const PANEL_OPTIONS = { stage: null, includeBudget: false } as const;
const NO_SLICE = { project_id: null, worker_name: null } as const;

export function isDoubled(count: number, previous: number | null): boolean {
  return previous !== null && count >= 2 * previous && count >= DOUBLED_AT_LEAST;
}

function keeper(options: Pick<ParetoOptions, "stage" | "includeBudget">) {
  const exits = options.includeBudget ? [...CAUSED_EXITS, "budget"] : CAUSED_EXITS;
  return (row: { readonly stage: string; readonly exit: FlowExit }) =>
    exits.includes(row.exit) && (options.stage === null || row.stage === options.stage);
}

function tallyOf(tallies: Map<string, Tally>, category: string): Tally {
  const found = tallies.get(category);
  if (found !== undefined) return found;
  const created: Tally = { count: 0, cost: 0, suspected: 0, details: new Map() };
  tallies.set(category, created);
  return created;
}

function tallies(rows: readonly FlowCauseRow[]): Map<string, Tally> {
  const result = new Map<string, Tally>();
  for (const row of rows) {
    const tally = tallyOf(result, row.category);
    tally.count += row.count;
    tally.cost += row.cost_usd;
    const assigners = tally.details.get(row.detail) ?? new Map<string, number>();
    assigners.set(row.assigner, (assigners.get(row.assigner) ?? 0) + row.count);
    tally.details.set(row.detail, assigners);
    if (row.category === UNATTRIBUTED && row.detail !== "") {
      tallyOf(result, row.detail).suspected += row.count;
    }
  }
  return result;
}

function previousCounts(
  rows: readonly FlowPreviousCauseRow[] | null,
  keeps: ReturnType<typeof keeper>,
): ReadonlyMap<string, number> | null {
  if (rows === null) return null;
  const counts = new Map<string, number>();
  for (const row of rows.filter(keeps)) {
    counts.set(row.category, (counts.get(row.category) ?? 0) + row.count);
  }
  return counts;
}

function detailsOf(tally: Tally): readonly CauseDetail[] {
  return [...tally.details]
    .map(([name, assigners]) => ({
      name: name === "" ? NO_DETAIL : name,
      count: [...assigners.values()].reduce((sum, count) => sum + count, 0),
      assigners: ASSIGNERS.filter((assigner) => assigners.has(assigner))
        .map((assigner) => `${ASSIGNER_NAMES[assigner]} ${countText(assigners.get(assigner) ?? 0)}`)
        .join(" · "),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

function orderedKeys(all: ReadonlyMap<string, Tally>): readonly string[] {
  const keys = [...all.keys()].filter((key) => key !== UNATTRIBUTED);
  keys.sort((a, b) => {
    const left = all.get(a);
    const right = all.get(b);
    return (
      (right?.count ?? 0) - (left?.count ?? 0) ||
      (right?.suspected ?? 0) - (left?.suspected ?? 0) ||
      a.localeCompare(b)
    );
  });
  return all.has(UNATTRIBUTED) ? [...keys, UNATTRIBUTED] : keys;
}

function previousTextOf(count: number, previous: number | null | undefined): string {
  if (previous === null) return NO_VALUE;
  if (previous !== undefined) return countText(previous);
  return count > 0 ? "0" : NO_VALUE;
}

export function paretoOf(read: FlowRead, options: ParetoOptions): ParetoModel {
  const keeps = keeper(options);
  const all = tallies(read.causes.rows.filter(keeps));
  const previous = previousCounts(read.causes.previous_rows, keeps);
  const keys = orderedKeys(all);
  const caused = [...all.values()].reduce((sum, tally) => sum + tally.count, 0);
  const peak = Math.max(0, ...[...all.values()].map((tally) => tally.count));
  const span = spanOf(read, 0, read.window.buckets.length - 1);
  let running = 0;
  const rows = keys.map((key): CauseRow => {
    const tally = tallyOf(all, key);
    running += tally.count;
    const previousCount = previous === null ? null : previous.get(key);
    return {
      key,
      name: key === "" ? NO_CAUSE : key,
      count: tally.count,
      countText: countText(tally.count),
      suspectedText: tally.suspected > 0 ? `+${countText(tally.suspected)} suspected` : null,
      costText: costText(tally.cost),
      previousText: previousTextOf(tally.count, previousCount),
      doubled: isDoubled(tally.count, previousCount === undefined ? 0 : previousCount),
      cumulativeText:
        tally.count === 0 ? NO_VALUE : `${Math.round((running / caused) * PERCENT)} %`,
      bar: peak === 0 ? 0 : tally.count / peak,
      target: tally.count > 0 ? causeTarget(key, options.scope, span) : null,
      details: key === UNATTRIBUTED ? [] : detailsOf(tally),
    };
  });
  const last = rows.at(-1);
  const hasUnattributed = last?.key === UNATTRIBUTED;
  return {
    caused,
    rows: hasUnattributed ? rows.slice(0, -1) : rows,
    unattributed: hasUnattributed ? last : null,
  };
}

function panelRows(read: FlowRead): readonly FlowCauseRow[] {
  return read.causes.rows.filter(keeper(PANEL_OPTIONS));
}

function topSuspectOf(rows: readonly FlowCauseRow[]): string | null {
  const suspects = new Map<string, number>();
  for (const row of rows) {
    if (row.category === UNATTRIBUTED && row.detail !== "") {
      suspects.set(row.detail, (suspects.get(row.detail) ?? 0) + row.count);
    }
  }
  const [top] = [...suspects].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return top === undefined ? null : top[0];
}

function countOf(rows: readonly FlowCauseRow[], keeps: (row: FlowCauseRow) => boolean): number {
  return rows.filter(keeps).reduce((sum, row) => sum + row.count, 0);
}

export function unattributedSignalOf(read: FlowRead, _frame: FlowFrame): FlowSignal {
  const rows = panelRows(read);
  const caused = countOf(rows, () => true);
  const share =
    caused === 0 ? null : countOf(rows, (row) => row.category === UNATTRIBUTED) / caused;
  const suspect = topSuspectOf(rows);
  const id = "causes.unattributed";
  return {
    id,
    where: "why",
    stage: null,
    group: null,
    metric: "unattributed share",
    label: "Unattributed",
    short: "unattributed",
    unit: "ratio",
    bounds: boundsOf(id),
    window: share,
    shown: share,
    previous: read.causes.previous_unattributed_share,
    series: null,
    slices: [],
    slice: [],
    cause: suspect === null ? null : `suspect ${suspect}`,
    target: signalTarget(id, NO_SLICE, spanOf(read, 0, read.window.buckets.length - 1)),
  };
}

function trendOf(share: number, previous: number): string {
  if (share > previous) return "▲";
  return share < previous ? "▼" : "";
}

function comparisonOf(signal: FlowSignal): string {
  const { window: share, previous, bounds } = signal;
  const from =
    share === null || previous === null
      ? []
      : [[trendOf(share, previous), `from ${rateBoundText(previous)}`].filter(Boolean).join(" ")];
  const named = (name: string, bound: number | null | undefined) =>
    bound === null || bound === undefined ? [] : [`${name} ${rateBoundText(bound)}`];
  return [...from, ...named("warn", bounds?.warn), ...named("bad", bounds?.bad)].join(" · ");
}

export function unattributedOf(read: FlowRead, frame: FlowFrame): UnattributedModel {
  const signal = unattributedSignalOf(read, frame);
  const result = evaluate(signal, frame);
  const rows = panelRows(read);
  const caused = countOf(rows, () => true);
  const manual = countOf(rows, (row) => row.assigner === "human");
  return {
    severity: result.severity,
    icon: isActive(result) ? SEVERITY_ICON[result.severity] : null,
    share: signal.window === null ? NO_VALUE : rateText(signal.window),
    comparison: comparisonOf(signal),
    series: read.causes.unattributed_share_series,
    bad: signal.bounds?.bad ?? null,
    partial: frame.partial,
    caused: `${countText(countOf(rows, (row) => row.category === UNATTRIBUTED))} of ${countText(caused)} caused`,
    manual: `Manual labels: ${countText(manual)} of ${countText(caused)} (${caused === 0 ? 0 : Math.round((manual / caused) * PERCENT)} %)`,
    target: signal.target,
  };
}
