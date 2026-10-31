import { describe, expect, it } from "vitest";

import type { FlowCauseRow, FlowRead } from "@/api/types";

import flowRead from "../../test/flow-read.json";
import {
  isDoubled,
  paretoOf,
  type ParetoOptions,
  unattributedOf,
  unattributedSignalOf,
} from "./flow-causes";
import { frameOf } from "./flow-status";

const FLOW_READ = flowRead as unknown as FlowRead;
const FRAME = frameOf(FLOW_READ, "7d");
const SCOPE = { projectId: null, workerName: null };
const ALL = { stage: null, includeBudget: false, scope: SCOPE } as const;

function causeRow(overrides: Partial<FlowCauseRow>): FlowCauseRow {
  return {
    stage: "executing",
    exit: "stopped",
    category: "model",
    detail: "work_defect",
    assigner: "rule",
    count: 1,
    cost_usd: 0,
    ...overrides,
  };
}

function readWith(
  rows: readonly FlowCauseRow[],
  causes: Partial<FlowRead["causes"]> = {},
): FlowRead {
  return { ...FLOW_READ, causes: { ...FLOW_READ.causes, rows, ...causes } };
}

function namesOf(read: FlowRead, options: ParetoOptions = ALL) {
  return paretoOf(read, options).rows.map((row) => row.name);
}

describe("paretoOf", () => {
  it("counts 188 caused executions and lists the categories by count", () => {
    const pareto = paretoOf(FLOW_READ, ALL);

    expect(pareto.caused).toBe(188);
    expect(namesOf(FLOW_READ)).toEqual([
      "llm_provider",
      "model",
      "environment",
      "infrastructure",
      "human",
      "plan",
      "worker_action",
    ]);
  });

  it("reads the figures of each category of the fixture", () => {
    const rows = paretoOf(FLOW_READ, ALL).rows.map((row) => [
      row.name,
      row.countText,
      row.suspectedText,
      row.costText,
      row.previousText,
      row.cumulativeText,
      row.doubled,
    ]);

    expect(rows).toEqual([
      ["llm_provider", "39", null, "$4.40", "13", "21 %", true],
      ["model", "35", "+64 suspected", "$9.40", "34", "39 %", false],
      ["environment", "16", "+4 suspected", "$6.90", "13", "48 %", false],
      ["infrastructure", "9", "+6 suspected", "$10.00", "10", "53 %", false],
      ["human", "5", null, "$2.80", "3", "55 %", false],
      ["plan", "3", "+5 suspected", "$0.90", "2", "57 %", false],
      ["worker_action", "0", "+2 suspected", "$0.00", "—", "—", false],
    ]);
  });

  it("puts unattributed last with the cumulative 100 %", () => {
    const { unattributed } = paretoOf(FLOW_READ, ALL);

    expect(unattributed).toMatchObject({
      name: "unattributed",
      countText: "81",
      costText: "$30.60",
      previousText: "48",
      cumulativeText: "100 %",
      details: [],
      suspectedText: null,
    });
  });

  it("scales the bars against the largest count", () => {
    const pareto = paretoOf(FLOW_READ, ALL);

    expect(pareto.rows[0]?.bar).toBeCloseTo(39 / 81, 5);
    expect(pareto.unattributed?.bar).toBe(1);
  });

  it("adds the budget exits with the option", () => {
    const pareto = paretoOf(FLOW_READ, { ...ALL, includeBudget: true });

    expect(pareto.caused).toBe(211);
  });

  it("keeps only the rows of the stage option", () => {
    const pareto = paretoOf(FLOW_READ, { ...ALL, stage: "verification" });

    expect(pareto.caused).toBe(7);
    expect(namesOf(FLOW_READ, { ...ALL, stage: "verification" })).toEqual([
      "environment",
      "infrastructure",
    ]);
    expect(pareto.unattributed).toBeNull();
  });

  it("applies the stage option to the previous rows", () => {
    const pareto = paretoOf(FLOW_READ, { ...ALL, stage: "verification" });

    expect(pareto.rows.map((row) => row.previousText)).toEqual(["3", "3"]);
  });

  it("reads 0 as previous for a category with a count and no previous row", () => {
    const read = readWith([causeRow({ category: "plan", count: 3 })], {
      previous_rows: [],
    });

    expect(paretoOf(read, ALL).rows[0]?.previousText).toBe("0");
  });

  it("reads a dash as previous when the read has no previous rows", () => {
    const read = readWith([causeRow({ count: 30 })], { previous_rows: null });
    const [row] = paretoOf(read, ALL).rows;

    expect(row?.previousText).toBe("—");
    expect(row?.doubled).toBe(false);
  });

  it("names the empty category no cause", () => {
    const read = readWith([causeRow({ category: "", count: 2 })]);

    expect(paretoOf(read, ALL).rows[0]).toMatchObject({ key: "", name: "no cause" });
  });

  it("sorts equal counts by suspected count", () => {
    const read = readWith([
      causeRow({ category: "plan", count: 3 }),
      causeRow({ category: "human", count: 3 }),
      causeRow({ category: "unattributed", detail: "human", count: 4 }),
    ]);

    expect(namesOf(read)).toEqual(["human", "plan"]);
  });

  it("splits a detail by assigner with the assigner names", () => {
    const read = readWith([
      causeRow({ category: "model", detail: "work_defect", assigner: "rule", count: 10 }),
      causeRow({ category: "model", detail: "work_defect", assigner: "human", count: 6 }),
      causeRow({ category: "model", detail: "work_defect", assigner: "", count: 2 }),
      causeRow({ category: "model", detail: "work_defect", assigner: "reviewer", count: 1 }),
      causeRow({ category: "model", detail: "other", assigner: "rule", count: 1 }),
    ]);

    expect(paretoOf(read, ALL).rows[0]?.details).toEqual([
      {
        name: "work_defect",
        count: 19,
        assigners: "rule 10 · reviewer 1 · manual label 6 · no assigner 2",
      },
      { name: "other", count: 1, assigners: "rule 1" },
    ]);
  });

  it("links a category with a count to its traces and leaves a zero category without link", () => {
    const { rows } = paretoOf(FLOW_READ, ALL);

    expect(rows[0]?.target).toBe(
      "/traces?cause_category=llm_provider&from=1792800000000&to=1793369520000",
    );
    expect(rows.at(-1)?.target).toBeNull();
  });

  it("answers no rows for a read without caused rows", () => {
    const pareto = paretoOf(readWith([]), ALL);

    expect(pareto).toEqual({ caused: 0, rows: [], unattributed: null });
  });
});

describe("isDoubled", () => {
  it("needs twice the previous count and a count of 10", () => {
    expect(isDoubled(39, 13)).toBe(true);
    expect(isDoubled(9, 4)).toBe(false);
    expect(isDoubled(25, 13)).toBe(false);
    expect(isDoubled(20, null)).toBe(false);
  });
});

describe("unattributedSignalOf", () => {
  it("answers the causes.unattributed signal with the window share", () => {
    const signal = unattributedSignalOf(FLOW_READ, FRAME);

    expect(signal).toMatchObject({
      id: "causes.unattributed",
      metric: "unattributed share",
      previous: 0.39,
      series: null,
      slices: [],
      slice: [],
      cause: "suspect model",
      target:
        "/traces?cause_category=unattributed&sort=cost_usd&from=1792800000000&to=1793369520000",
    });
    expect(signal.window).toBeCloseTo(81 / 188, 5);
    expect(signal.bounds).toMatchObject({ warn: 0.25, bad: 0.4 });
  });

  it("has no share and no suspect without caused rows", () => {
    const signal = unattributedSignalOf(readWith([]), FRAME);

    expect(signal.window).toBeNull();
    expect(signal.cause).toBeNull();
  });
});

describe("unattributedOf", () => {
  it("reads the panel of the fixture", () => {
    const panel = unattributedOf(FLOW_READ, FRAME);

    expect(panel).toMatchObject({
      severity: "bad",
      icon: "✕",
      share: "43.1 %",
      comparison: "▲ from 39 % · warn 25 % · bad 40 %",
      caused: "81 of 188 caused",
      manual: "Manual labels: 8 of 188 (4 %)",
      bad: 0.4,
      partial: true,
    });
    expect(panel.series).toEqual(FLOW_READ.causes.unattributed_share_series);
  });

  it("shows the warn icon between the bounds", () => {
    const read = readWith(
      [causeRow({ category: "unattributed", detail: "model", count: 30 }), causeRow({ count: 70 })],
      { previous_unattributed_share: 0.5 },
    );

    expect(unattributedOf(read, FRAME)).toMatchObject({
      severity: "warn",
      icon: "⚠",
      comparison: "▼ from 50 % · warn 25 % · bad 40 %",
    });
  });

  it("shows no icon and no trend below the warn bound", () => {
    const read = readWith(
      [causeRow({ category: "unattributed", detail: "model", count: 10 }), causeRow({ count: 90 })],
      { previous_unattributed_share: 0.1 },
    );

    expect(unattributedOf(read, FRAME)).toMatchObject({
      severity: "ok",
      icon: null,
      comparison: "from 10 % · warn 25 % · bad 40 %",
    });
  });

  it("omits the comparison with the previous share when the server sends none", () => {
    const read = readWith([causeRow({ count: 5 })], { previous_unattributed_share: null });

    expect(unattributedOf(read, FRAME).comparison).toBe("warn 25 % · bad 40 %");
  });

  it("ignores the budget exits", () => {
    const read = readWith([
      causeRow({ category: "unattributed", detail: "plan", exit: "budget", count: 50 }),
      causeRow({ count: 5 }),
    ]);

    expect(unattributedOf(read, FRAME)).toMatchObject({
      share: "0.0 %",
      caused: "0 of 5 caused",
    });
  });

  it("reads a dash and 0 % without caused rows", () => {
    const panel = unattributedOf(readWith([]), FRAME);

    expect(panel).toMatchObject({
      share: "—",
      icon: null,
      caused: "0 of 0 caused",
      manual: "Manual labels: 0 of 0 (0 %)",
    });
  });
});
