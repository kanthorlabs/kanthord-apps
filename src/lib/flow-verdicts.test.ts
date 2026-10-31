import { describe, expect, it } from "vitest";

import type { FlowRead } from "@/api/types";

import flowRead from "../../test/flow-read.json";
import { frameOf } from "./flow-status";
import { type VerdictRow, verdictsOf } from "./flow-verdicts";

const FLOW_READ = flowRead as unknown as FlowRead;
const FRAME = frameOf(FLOW_READ, "7d");
const SCOPE = { projectId: null, workerName: null };

const ZEROS = (values: readonly unknown[]) => values.map(() => 0);

const QUIET_READ = {
  ...FLOW_READ,
  stages: FLOW_READ.stages.map((stage) => ({
    ...stage,
    current: { ...stage.current, exits: {}, signals: {}, time: null },
    previous: null,
    previous_bucket_median: {},
    dimensions: [],
    series: {
      ...stage.series,
      leaked: ZEROS(stage.series.leaked),
      loops: ZEROS(stage.series.loops),
      time_p90: stage.series.time_p90.map(() => null),
      signals: {},
    },
  })),
  causes: { ...FLOW_READ.causes, rows: [], previous_unattributed_share: null },
  usage: {
    ...FLOW_READ.usage,
    by: { ...FLOW_READ.usage.by, model: [] },
    series: {
      ...FLOW_READ.usage.series,
      cache_hit: FLOW_READ.usage.series.cache_hit.map(() => 0.9),
    },
    current: {
      ...FLOW_READ.usage.current,
      cache_read_tokens: FLOW_READ.usage.current.input_tokens * 0.9,
    },
    previous: null,
  },
  cost: {
    ...FLOW_READ.cost,
    previous: null,
    current: { ...FLOW_READ.cost.current, leaked_usd: 0 },
    series: { ...FLOW_READ.cost.series, leaked_usd: ZEROS(FLOW_READ.cost.series.leaked_usd) },
  },
  completeness: {
    ...FLOW_READ.completeness,
    awaiting_ingestion: [],
    exit_unknown: 0,
    no_root: 0,
  },
} as unknown as FlowRead;

function lineOf(row: VerdictRow): string {
  return [
    row.severity,
    row.where,
    row.metric,
    row.value,
    row.bound,
    row.since,
    row.slice,
    row.cause,
    row.link.label,
  ].join(" · ");
}

describe("verdictsOf", () => {
  const verdicts = verdictsOf(FLOW_READ, FRAME, SCOPE);

  it("lists the active rows with ongoing bad first and range warn last", () => {
    expect(verdicts.rows.map(lineOf)).toEqual([
      "bad · Verification · flaky runs · 22.0 % Oct 29 · bad > 15 % · since Oct 28 · auth-gateway · environment.flaky_verification · Traces →",
      "bad · Tokens · cache hit ratio · 32.0 % Oct 29 · bad < 40 % · since Oct 28 · gpt-5-codex · — · Traces →",
      "warn · Verification · revision loops · 0.81 Oct 29 · warn > 0.75 · since Oct 29 · auth-gateway · — · Traces →",
      "warn · Evaluation · review wait p90 · 2.7 h Oct 29 · warn > 1 h · since Oct 27 · billing · claude-code@1 · — · Scheduler →",
      "bad · Why · unattributed share · 43.1 % 7d · bad > 40 % · 7d · — · suspect model · Traces →",
      "warn · Data · awaiting ingestion · 9 7d · warn > 0 · 7d · claude-code@1 · — · Traces →",
    ]);
  });

  it("opens the target of the signal with the slice and a span from the since bucket to now", () => {
    expect(verdicts.rows[0]?.link.target).toBe(
      "/traces?project_id=auth-gateway&from=1793145600000&to=1793369520000",
    );
  });

  it("links the tile group to the Cost tab and no other place", () => {
    expect(verdicts.rows.map((row) => row.whereTarget)).toEqual([
      null,
      "/analytics?tab=cost&range=7d",
      null,
      null,
      null,
      null,
    ]);
  });

  it("keeps the scope in the Cost tab link", () => {
    const scoped = verdictsOf(FLOW_READ, FRAME, { projectId: "auth-gateway", workerName: null });

    expect(scoped.rows.find((row) => row.where === "Tokens")?.whereTarget).toBe(
      "/analytics?tab=cost&project_id=auth-gateway&range=7d",
    );
  });

  it("groups the ended results by breach days, worst first", () => {
    expect(verdicts.groups.map((group) => group.text)).toEqual([
      "Oct 27 · Executing leak 43.0 % · provider errors 118 · Evaluation leak 20.0 % · cost per success $3.01 · leaked cost 23.6 % · tokens per success 4.95 M · coder@1 · llm_provider.rate_limited",
      "Oct 24 – Oct 28 · Outcome rework up to 38.9 % · model.work_defect",
      "Oct 25, Oct 27 – Oct 28 · Verification base red up to 7.3 %",
      "Oct 28 · Outcome blocked 5.3 % · model.work_defect",
    ]);
  });

  it("opens the first member of a group over the span of its breach days", () => {
    const [first, second] = verdicts.groups;

    expect(first?.link).toEqual({
      label: "Traces →",
      target: expect.stringContaining("from=1793059200000&to=1793145600000"),
    });
    expect(second?.link.label).toBe("Timeline →");
  });

  it("reads the first and the last day of the window", () => {
    expect(verdicts.days).toBe("Oct 24 – Oct 30");
  });

  it("answers no row and no group for a read within bounds", () => {
    const quiet = verdictsOf(QUIET_READ, frameOf(QUIET_READ, "7d"), SCOPE);

    expect(quiet.rows).toEqual([]);
    expect(quiet.groups).toEqual([]);
  });
});
