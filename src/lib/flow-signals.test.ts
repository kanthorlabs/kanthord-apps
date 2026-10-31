import { describe, expect, it } from "vitest";

import type { FlowCauseRow, FlowRead, FlowStage, FlowStageResult } from "@/api/types";

import flowRead from "../../test/flow-read.json";
import { stageSignalsOf } from "./flow-signals";
import { type FlowSignal, frameOf } from "./flow-status";

const FLOW_READ = flowRead as unknown as FlowRead;
const FRAME = frameOf(FLOW_READ, "7d");
const SCOPE = { projectId: null, workerName: null };

function signalsOf(read: FlowRead = FLOW_READ): readonly FlowSignal[] {
  return stageSignalsOf(read, FRAME, SCOPE);
}

function signalOf(id: string, read: FlowRead = FLOW_READ): FlowSignal {
  const signal = signalsOf(read).find((candidate) => candidate.id === id);
  if (signal === undefined) throw new Error(`No signal ${id}`);
  return signal;
}

function withStage(
  read: FlowRead,
  stage: FlowStage,
  patch: (result: FlowStageResult) => FlowStageResult,
): FlowRead {
  return {
    ...read,
    stages: read.stages.map((result) => (result.stage === stage ? patch(result) : result)),
  };
}

function withCauses(rows: readonly FlowCauseRow[]): FlowRead {
  return { ...FLOW_READ, causes: { ...FLOW_READ.causes, rows } };
}

function stageOf(stage: FlowStage): FlowStageResult {
  const result = FLOW_READ.stages.find((candidate) => candidate.stage === stage);
  if (result === undefined) throw new Error(`No stage ${stage}`);
  return result;
}

function ratios(numerators: readonly (number | null)[], denominators: readonly (number | null)[]) {
  return numerators.map((numerator, index) => (numerator ?? 0) / (denominators[index] ?? 1));
}

describe("stageSignalsOf", () => {
  it("answers one signal per row of the table, in order", () => {
    expect(signalsOf().map((signal) => signal.id)).toEqual([
      "queued.wait",
      "executing.leak",
      "executing.turn_rate_limited",
      "executing.turn_quota_exhausted",
      "executing.turn_unavailable",
      "executing.tool_error",
      "executing.time",
      "verification.flaky",
      "verification.loops",
      "verification.fail",
      "verification.base_red",
      "verification.time",
      "release_gate.leak",
      "release_gate.time",
      "evaluation.review",
      "evaluation.leak",
      "evaluation.time",
      "outcome.rework",
      "outcome.blocked",
    ]);
  });

  it("names the metric, the label and the short text of each signal", () => {
    const names = signalsOf().map(({ id, metric, label, short }) => [id, metric, label, short]);
    expect(names).toEqual([
      ["queued.wait", "wait p90", "wait p90", "Queued wait p90"],
      ["executing.leak", "leak rate", "leak rate", "Executing leak"],
      [
        "executing.turn_rate_limited",
        "provider errors (rate_limited)",
        "provider errors",
        "provider errors",
      ],
      [
        "executing.turn_quota_exhausted",
        "provider errors (quota_exhausted)",
        "provider errors",
        "provider errors",
      ],
      [
        "executing.turn_unavailable",
        "provider errors (unavailable)",
        "provider errors",
        "provider errors",
      ],
      ["executing.tool_error", "tool errors", "tool errors", "tool errors"],
      ["executing.time", "exec p90", "exec p90", "exec p90"],
      ["verification.flaky", "flaky runs", "flaky runs", "Verification flaky runs"],
      ["verification.loops", "revision loops", "revision loops", "revision loops"],
      ["verification.fail", "affected fail", "affected fail", "affected fail"],
      ["verification.base_red", "base red", "base red", "Verification base red"],
      ["verification.time", "run p90", "run p90", "run p90"],
      ["release_gate.leak", "leak rate", "leak rate", "Release gate leak"],
      ["release_gate.time", "gate p90", "gate p90", "gate p90"],
      ["evaluation.review", "review wait p90", "review p90", "review wait p90"],
      ["evaluation.leak", "leak rate", "leak", "Evaluation leak"],
      ["evaluation.time", "evaluation time p90", "evaluation time p90", "evaluation time p90"],
      ["outcome.rework", "rework rate", "rework", "Outcome rework"],
      ["outcome.blocked", "blocked rate", "blocked", "Outcome blocked"],
    ]);
  });

  it("reads the queued wait from the time of the stage", () => {
    const signal = signalOf("queued.wait");
    expect(signal.window).toBe(588000);
    expect(signal.previous).toBe(552000);
    expect(signal.series).toEqual(stageOf("queued").series.time_p90);
  });

  it("divides the leaked executions by the settled ones", () => {
    const signal = signalOf("executing.leak");
    expect(signal.window).toBeCloseTo(68 / 408, 10);
    expect(signal.previous).toBeCloseTo(34 / 398, 10);
    expect(signal.series).toEqual(stageOf("executing").series.signals.leak_rate);
  });

  it("shows the window sum of a provider error and keeps the window empty", () => {
    const signal = signalOf("executing.turn_rate_limited");
    expect(signal.window).toBeNull();
    expect(signal.shown).toBe(133);
    expect(signal.previous).toBe(14);
    expect(signal.series).toEqual([2, 1, 3, 118, 4, 2, 3]);
    expect(signalOf("executing.turn_quota_exhausted").shown).toBe(9);
    expect(signalOf("executing.turn_unavailable").shown).toBe(8);
  });

  it("reads the tool error rate and the execution time", () => {
    const toolError = signalOf("executing.tool_error");
    expect(toolError.window).toBe(0.047);
    expect(toolError.previous).toBe(0.044);
    expect(toolError.series).toBeNull();
    const time = signalOf("executing.time");
    expect(time.window).toBe(4260000);
    expect(time.previous).toBe(4020000);
    expect(time.series).toEqual(stageOf("executing").series.time_p90);
  });

  it("derives the verification ratios from the affected runs", () => {
    const { series } = stageOf("verification");
    const flaky = signalOf("verification.flaky");
    expect(flaky.window).toBeCloseTo(61 / 498, 10);
    expect(flaky.previous).toBe(0.046);
    expect(flaky.series).toEqual(series.signals.flaky_run_share);
    const loops = signalOf("verification.loops");
    expect(loops.window).toBeCloseTo(171 / 281, 10);
    expect(loops.previous).toBe(0.49);
    expect(loops.series).toEqual(ratios(series.signals.gate_routed ?? [], series.entered));
    const fail = signalOf("verification.fail");
    expect(fail.window).toBeCloseTo(128 / 498, 10);
    expect(fail.previous).toBe(0.241);
    expect(fail.series).toEqual(
      ratios(series.signals.affected_failed ?? [], series.signals.affected_runs ?? []),
    );
    const baseRed = signalOf("verification.base_red");
    expect(baseRed.window).toBeCloseTo(25 / 498, 10);
    expect(baseRed.previous).toBe(0.044);
    expect(baseRed.series).toEqual(
      ratios(series.signals.affected_base_red ?? [], series.signals.affected_runs ?? []),
    );
  });

  it("reads the time of verification, release gate and evaluation", () => {
    expect(signalOf("verification.time").window).toBe(546000);
    expect(signalOf("verification.time").previous).toBe(498000);
    expect(signalOf("release_gate.time").window).toBe(1020000);
    expect(signalOf("release_gate.time").previous).toBe(960000);
    const review = signalOf("evaluation.review");
    expect(review.window).toBe(8640000);
    expect(review.previous).toBe(1860000);
    expect(review.series).toEqual(stageOf("evaluation").series.time_p90);
    const time = signalOf("evaluation.time");
    expect(time.window).toBe(1140000);
    expect(time.previous).toBe(1080000);
    expect(time.series).toBeNull();
  });

  it("divides the leaked executions of the release gate and the evaluation", () => {
    const gate = signalOf("release_gate.leak");
    expect(gate.window).toBeCloseTo(5 / 255, 10);
    expect(gate.previous).toBeCloseTo(7 / 264, 10);
    expect(gate.series).toEqual(stageOf("release_gate").series.signals.leak_rate);
    const evaluation = signalOf("evaluation.leak");
    const { series } = stageOf("evaluation");
    expect(evaluation.window).toBeCloseTo(25 / 291, 10);
    expect(evaluation.previous).toBeCloseTo(17 / 287, 10);
    expect(evaluation.series).toEqual([2 / 41, 3 / 43, 2 / 44, 9 / 45, 3 / 41, 3 / 39, 3 / 38]);
    expect(series.leaked).toHaveLength(7);
  });

  it("divides the rework and the blocked executions of the outcome", () => {
    const rework = signalOf("outcome.rework");
    expect(rework.window).toBeCloseTo(74 / 266, 10);
    expect(rework.previous).toBeCloseTo(52 / 270, 10);
    expect(rework.series).toEqual(stageOf("outcome").series.signals.rework_rate);
    const blocked = signalOf("outcome.blocked");
    expect(blocked.window).toBeCloseTo(9 / 266, 10);
    expect(blocked.previous).toBeCloseTo(7 / 270, 10);
    expect(blocked.series).toEqual([1 / 39, 1 / 40, 2 / 42, 1 / 36, 2 / 38, 1 / 36, 1 / 35]);
  });

  it("gives no previous value when the read has no previous window", () => {
    const read = withStage(FLOW_READ, "executing", (result) => ({ ...result, previous: null }));
    expect(signalOf("executing.leak", read).previous).toBeNull();
    expect(signalOf("executing.turn_rate_limited", read).previous).toBeNull();
  });

  it("gives a null bucket value below MIN_SETTLED settled executions", () => {
    const read = withStage(FLOW_READ, "evaluation", (result) => ({
      ...result,
      series: {
        ...result.series,
        entered: [5, 43, 44, 45, 41, 40, 42],
        open: [1, 0, 0, 0, 0, 1, 4],
      },
    }));
    expect(signalOf("evaluation.leak", read).series?.[0]).toBeNull();
    expect(signalOf("evaluation.leak", read).series?.[1]).toBeCloseTo(3 / 43, 10);
  });

  it("gives a null bucket value below MIN_SETTLED entered executions or affected runs", () => {
    const read = withStage(FLOW_READ, "verification", (result) => ({
      ...result,
      series: {
        ...result.series,
        entered: [4, 43, 46, 37, 40, 37, 36],
        signals: { ...result.series.signals, affected_runs: [4, 64, 68, 55, 76, 82, 92] },
      },
    }));
    expect(signalOf("verification.loops", read).series?.[0]).toBeNull();
    expect(signalOf("verification.fail", read).series?.[0]).toBeNull();
    expect(signalOf("verification.base_red", read).series?.[0]).toBeNull();
    expect(signalOf("verification.fail", read).series?.[1]).toBeCloseTo(16 / 64, 10);
  });

  it("keeps the null of a ratio series of the read", () => {
    const read = withStage(FLOW_READ, "executing", (result) => ({
      ...result,
      series: {
        ...result.series,
        signals: { ...result.series.signals, leak_rate: [null, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1] },
      },
    }));
    expect(signalOf("executing.leak", read).series?.[0]).toBeNull();
  });

  it("gives no series when the read lacks the counts of a derived series", () => {
    const read = withStage(FLOW_READ, "verification", (result) => ({
      ...result,
      series: { ...result.series, signals: {} },
    }));
    expect(signalOf("verification.fail", read).series).toBeNull();
  });

  it("builds each target with signalTarget", () => {
    expect(signalOf("queued.wait").target).toBe("/scheduler");
    expect(signalOf("outcome.blocked").target).toBe("/");
    expect(signalOf("executing.leak").target).toBe(
      "/traces?state=error&worker_name=coder%401&from=1792800000000&to=1793369520000",
    );
    expect(signalOf("executing.tool_error").target).toBe(
      "/traces?error_type=tool_error&from=1792800000000&to=1793369520000",
    );
  });

  it("adds the scope to a target when the slice names no item", () => {
    const target = stageSignalsOf(FLOW_READ, FRAME, {
      projectId: "billing",
      workerName: null,
    }).find((signal) => signal.id === "release_gate.leak")?.target;
    expect(target).toBe(
      "/traces?state=error&q=operation_failed&project_id=billing&from=1792800000000&to=1793369520000",
    );
  });
});

describe("the bounds of a signal", () => {
  it("takes the fixed bounds from FLOW_THRESHOLDS", () => {
    expect(signalOf("executing.leak").bounds).toEqual({
      direction: "high",
      warn: 0.15,
      bad: 0.25,
      floor: null,
    });
    expect(signalOf("executing.leak").unit).toBe("ratio");
    expect(signalOf("verification.loops").unit).toBe("ratio2");
  });

  it("scales the bound of a time signal by the previous value", () => {
    expect(signalOf("executing.time").bounds?.warn).toBeCloseTo(1.5 * 4020000, 6);
  });

  it("reads the provider error bound from previous_bucket_median of executing", () => {
    const bounds = signalOf("executing.turn_rate_limited").bounds;
    expect(bounds?.warn).toBe(6);
    expect(bounds?.floor).toBe(10);
    expect(signalOf("executing.turn_quota_exhausted").bounds?.warn).toBe(0);
    expect(signalOf("executing.turn_unavailable").bounds?.warn).toBe(3);
  });

  it("gives no bound when the median is null", () => {
    const read = withStage(FLOW_READ, "executing", (result) => ({
      ...result,
      previous_bucket_median: null,
    }));
    expect(signalOf("executing.turn_rate_limited", read).bounds).toBeNull();
  });
});

describe("the slice of a signal", () => {
  it("names the over-represented project for the flaky runs and the loops", () => {
    expect(signalOf("verification.flaky").slice).toEqual(["auth-gateway"]);
    expect(signalOf("verification.loops").slice).toEqual(["auth-gateway"]);
  });

  it("names the over-represented worker for the executing leak", () => {
    expect(signalOf("executing.leak").slice).toEqual(["coder@1"]);
    expect(signalOf("executing.turn_rate_limited").slice).toEqual(["coder@1"]);
  });

  it("names no item for a group with a sum of 0", () => {
    expect(signalOf("executing.turn_quota_exhausted").slice).toEqual([]);
  });

  it("names no item when no share reaches 0.15 over its share of entered", () => {
    expect(signalOf("release_gate.leak").slice).toEqual([]);
    expect(signalOf("evaluation.leak").slice).toEqual([]);
    expect(signalOf("outcome.rework").slice).toEqual([]);
    expect(signalOf("outcome.blocked").slice).toEqual([]);
  });

  it("names each slow item of the review wait, projects first", () => {
    expect(signalOf("evaluation.review").slice).toEqual(["billing", "claude-code@1"]);
  });

  it("uses the bad bound for a review wait with a bad result", () => {
    const read = withStage(FLOW_READ, "evaluation", (result) => ({
      ...result,
      series: {
        ...result.series,
        time_p90: [1560000, 2040000, 3120000, 4260000, 5880000, 15000000, 14160000],
      },
      dimensions: result.dimensions.map((dimension) =>
        dimension.key === "billing" && dimension.time !== null
          ? { ...dimension, time: { ...dimension.time, p90: 5000000 } }
          : dimension,
      ),
    }));
    expect(signalOf("evaluation.review", read).slice).toEqual(["claude-code@1"]);
  });

  it("gives the other signals no slice", () => {
    expect(signalOf("queued.wait").slice).toEqual([]);
    expect(signalOf("executing.time").slice).toEqual([]);
    expect(signalOf("executing.tool_error").slice).toEqual([]);
    expect(signalOf("verification.fail").slice).toEqual([]);
  });
});

describe("the top cause of a signal", () => {
  it("names the category and the sole top detail", () => {
    expect(signalOf("verification.flaky").cause).toBe("environment.flaky_verification");
    expect(signalOf("executing.leak").cause).toBe("llm_provider.rate_limited");
    expect(signalOf("outcome.rework").cause).toBe("model.work_defect");
  });

  it("gives no cause to a signal without exits", () => {
    expect(signalOf("queued.wait").cause).toBeNull();
    expect(signalOf("release_gate.leak").cause).toBeNull();
    expect(signalOf("executing.time").cause).toBeNull();
  });

  it("leaves out the unattributed category", () => {
    expect(signalOf("outcome.blocked").cause).toBe("model.work_defect");
  });

  it("gives no cause for a tie of two top categories", () => {
    const row = (category: string, count: number): FlowCauseRow => ({
      stage: "outcome",
      exit: "rework",
      category,
      detail: "x",
      assigner: "rule",
      count,
      cost_usd: 0,
    });
    const read = withCauses([row("model", 5), row("plan", 5), row("environment", 1)]);
    expect(signalOf("outcome.rework", read).cause).toBeNull();
  });

  it("names only the category when two details tie", () => {
    const row = (detail: string): FlowCauseRow => ({
      stage: "outcome",
      exit: "rework",
      category: "model",
      detail,
      assigner: "rule",
      count: 4,
      cost_usd: 0,
    });
    const read = withCauses([row("work_defect"), row("standard_violation")]);
    expect(signalOf("outcome.rework", read).cause).toBe("model");
  });

  it("gives no cause when only unattributed rows exist", () => {
    const row: FlowCauseRow = {
      stage: "outcome",
      exit: "rework",
      category: "unattributed",
      detail: "model",
      assigner: "rule",
      count: 9,
      cost_usd: 0,
    };
    expect(signalOf("outcome.rework", withCauses([row])).cause).toBeNull();
  });
});

describe("a read without a stage", () => {
  it("throws an error that names the stage", () => {
    const read = { ...FLOW_READ, stages: FLOW_READ.stages.filter((s) => s.stage !== "outcome") };
    expect(() => signalsOf(read)).toThrow("outcome");
  });
});
