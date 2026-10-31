import { describe, expect, it } from "vitest";

import type { FlowRead } from "@/api/types";

import flowRead from "../../test/flow-read.json";
import {
  boundText,
  evaluate,
  type FlowBounds,
  type FlowFrame,
  type FlowSignal,
  frameOf,
  isActive,
  scoreOf,
  severityOf,
} from "./flow-status";
import { boundsOf } from "./flow-thresholds";

const FLOW_READ = flowRead as unknown as FlowRead;

const HIGH: FlowBounds = { direction: "high", warn: 10, bad: 20, floor: null };
const LOW: FlowBounds = { direction: "low", warn: 0.6, bad: 0.4, floor: null };

const FRAME: FlowFrame = {
  labels: ["d0", "d1", "d2", "d3", "d4", "d5", "d6"],
  lastFull: 5,
  partial: true,
  range: "7d",
};

function signalOf(overrides: Partial<FlowSignal>): FlowSignal {
  return {
    id: "test.signal",
    where: "stage",
    stage: "executing",
    group: null,
    metric: "metric",
    label: "Metric",
    short: "m",
    unit: "count",
    bounds: HIGH,
    window: 1,
    shown: 1,
    previous: null,
    series: null,
    slices: [],
    slice: [],
    cause: null,
    target: "/traces",
    ...overrides,
  };
}

describe("frameOf", () => {
  it("answers the labels, lastFull 5 and partial for the fixture", () => {
    const frame = frameOf(FLOW_READ, "7d");

    expect(frame.lastFull).toBe(5);
    expect(frame.partial).toBe(true);
    expect(frame.range).toBe("7d");
    expect(frame.labels).toEqual([
      "Oct 24",
      "Oct 25",
      "Oct 26",
      "Oct 27",
      "Oct 28",
      "Oct 29",
      "Oct 30",
    ]);
  });

  it("answers the last index when the last bucket is full", () => {
    const read = { ...FLOW_READ, window: { ...FLOW_READ.window, now: FLOW_READ.window.to } };

    expect(frameOf(read, "7d")).toMatchObject({ lastFull: 6, partial: false });
  });

  it("labels an hour grain with the hour", () => {
    const read = {
      ...FLOW_READ,
      window: { ...FLOW_READ.window, bucket: "hour" as const, buckets: [1793369520000] },
    };

    expect(frameOf(read, "24h").labels).toEqual(["Oct 30 14:12"]);
  });
});

describe("severityOf", () => {
  it("answers ok for a null or a non-finite value", () => {
    expect(severityOf(null, HIGH)).toBe("ok");
    expect(severityOf(Number.NaN, HIGH)).toBe("ok");
    expect(severityOf(Number.POSITIVE_INFINITY, HIGH)).toBe("ok");
  });

  it("answers ok with no bounds", () => {
    expect(severityOf(1000, null)).toBe("ok");
  });

  it("treats a value equal to a bound as within", () => {
    expect(severityOf(10, HIGH)).toBe("ok");
    expect(severityOf(20, HIGH)).toBe("warn");
    expect(severityOf(0.6, LOW)).toBe("ok");
    expect(severityOf(0.4, LOW)).toBe("warn");
  });

  it("answers warn and bad above the bounds", () => {
    expect(severityOf(10.5, HIGH)).toBe("warn");
    expect(severityOf(20.5, HIGH)).toBe("bad");
  });

  it("answers by the direction low", () => {
    expect(severityOf(0.7, LOW)).toBe("ok");
    expect(severityOf(0.5, LOW)).toBe("warn");
    expect(severityOf(0.3, LOW)).toBe("bad");
  });

  it("answers a bound with no bad value", () => {
    expect(severityOf(500, { direction: "high", warn: 10, bad: null, floor: null })).toBe("warn");
  });

  it("answers ok below the floor of the provider error rule", () => {
    const provider = boundsOf("executing.turn_rate_limited", 2);

    expect(severityOf(9, provider)).toBe("ok");
    expect(severityOf(10, provider)).toBe("warn");
    expect(severityOf(118, provider)).toBe("warn");
  });

  it("answers ok above the floor when the value stays within the bound", () => {
    expect(severityOf(10, boundsOf("executing.turn_rate_limited", 5))).toBe("ok");
    expect(severityOf(15, boundsOf("executing.turn_rate_limited", 5))).toBe("ok");
    expect(severityOf(16, boundsOf("executing.turn_rate_limited", 5))).toBe("warn");
  });
});

describe("evaluate", () => {
  it("answers ongoing with since at the first bucket of the run", () => {
    const result = evaluate(signalOf({ window: 5, series: [15, 1, 1, 15, 22, 15, 1] }), FRAME);

    expect(result).toMatchObject({
      state: "ongoing",
      severity: "warn",
      value: 15,
      period: "d5",
      since: 3,
      days: [0, 3, 4, 5],
      daySeverity: "bad",
    });
  });

  it("answers ongoing for a single breaching last full bucket", () => {
    const result = evaluate(signalOf({ window: 1, series: [1, 1, 1, 1, 1, 25, 1] }), FRAME);

    expect(result).toMatchObject({ state: "ongoing", severity: "bad", since: 5, period: "d5" });
  });

  it("lets the partial bucket never set a status", () => {
    const result = evaluate(signalOf({ window: 1, series: [1, 1, 1, 1, 1, 1, 99] }), FRAME);

    expect(result.state).toBe("ok");
    expect(isActive(result)).toBe(false);
  });

  it("counts the last bucket as full when no bucket is partial", () => {
    const frame: FlowFrame = { ...FRAME, lastFull: 6, partial: false };

    expect(evaluate(signalOf({ series: [1, 1, 1, 1, 1, 1, 99] }), frame).state).toBe("ongoing");
  });

  it("answers range for a breaching window with no series", () => {
    const result = evaluate(signalOf({ window: 15, series: null }), FRAME);

    expect(result).toMatchObject({
      state: "range",
      severity: "warn",
      value: 15,
      period: "7d",
      since: null,
      days: [],
    });
    expect(isActive(result)).toBe(true);
  });

  it("answers ok for a window within the bounds with no series", () => {
    expect(evaluate(signalOf({ window: 10, series: null }), FRAME).state).toBe("ok");
  });

  it("answers ended with the peak value and its bucket", () => {
    const result = evaluate(signalOf({ window: 5, series: [1, 25, 15, 1, 1, 1, 1] }), FRAME);

    expect(result).toMatchObject({
      state: "ended",
      severity: "bad",
      value: 25,
      period: "d1",
      since: null,
      days: [1, 2],
      daySeverity: "bad",
    });
    expect(isActive(result)).toBe(false);
  });

  it("answers ended with the window value when no bucket breaches", () => {
    const result = evaluate(signalOf({ window: 15, series: [1, 1, 1, 1, 1, 1, 1] }), FRAME);

    expect(result).toMatchObject({
      state: "ended",
      severity: "warn",
      value: 15,
      period: "7d",
      days: [],
      daySeverity: "ok",
    });
  });

  it("takes the worst severity of the window and the buckets for ended", () => {
    const result = evaluate(signalOf({ window: 25, series: [15, 1, 1, 1, 1, 1, 1] }), FRAME);

    expect(result).toMatchObject({
      state: "ended",
      severity: "bad",
      value: 15,
      daySeverity: "warn",
    });
  });

  it("answers ok when the window and every full bucket are within", () => {
    expect(evaluate(signalOf({ window: 5, series: [1, 2, 3, 10, 1, 1, 99] }), FRAME).state).toBe(
      "ok",
    );
  });

  it("takes the lowest value as the peak for the direction low", () => {
    const result = evaluate(
      signalOf({ bounds: LOW, window: 0.7, series: [0.7, 0.5, 0.3, 0.7, 0.7, 0.7, 0.7] }),
      FRAME,
    );

    expect(result).toMatchObject({
      state: "ended",
      value: 0.3,
      period: "d2",
      severity: "bad",
      daySeverity: "bad",
    });
  });

  it("ignores a null bucket", () => {
    const result = evaluate(signalOf({ window: 1, series: [15, null, 1, 1, 1, null, 1] }), FRAME);

    expect(result).toMatchObject({ state: "ended", days: [0] });
  });

  it("answers range with no bounds as ok", () => {
    expect(evaluate(signalOf({ bounds: null, window: 1000 }), FRAME).state).toBe("ok");
  });

  it("reads the window value alone when the series is empty", () => {
    expect(evaluate(signalOf({ window: 15, series: [] }), FRAME).state).toBe("range");
  });

  it("takes the slice from the signal for the All result", () => {
    const result = evaluate(signalOf({ window: 15, slice: ["billing"] }), FRAME);

    expect(result).toMatchObject({ slice: ["billing"], sliceLevel: false });
  });

  it("replaces the All result with a slice of a higher score", () => {
    const result = evaluate(
      signalOf({
        window: 1,
        series: [1, 1, 1, 1, 1, 1, 1],
        slices: [
          { key: "tdd@1", window: 1, series: null },
          { key: "coder@1", window: 5, series: [1, 1, 1, 1, 1, 25, 1] },
        ],
      }),
      FRAME,
    );

    expect(result).toMatchObject({
      state: "ongoing",
      severity: "bad",
      slice: ["coder@1"],
      sliceLevel: true,
    });
  });

  it("keeps the All result for a slice of an equal score", () => {
    const result = evaluate(
      signalOf({
        window: 15,
        slices: [{ key: "coder@1", window: 15, series: null }],
      }),
      FRAME,
    );

    expect(result).toMatchObject({ state: "range", slice: [], sliceLevel: false });
  });

  it("keeps the first of two slices of an equal score", () => {
    const result = evaluate(
      signalOf({
        window: 1,
        slices: [
          { key: "a", window: 15, series: null },
          { key: "b", window: 15, series: null },
        ],
      }),
      FRAME,
    );

    expect(result.slice).toEqual(["a"]);
  });
});

describe("scoreOf", () => {
  it("adds ten times the state rank to the severity rank", () => {
    expect(scoreOf({ state: "ok", severity: "ok" })).toBe(0);
    expect(scoreOf({ state: "ended", severity: "warn" })).toBe(11);
    expect(scoreOf({ state: "range", severity: "bad" })).toBe(22);
    expect(scoreOf({ state: "ongoing", severity: "warn" })).toBe(31);
  });
});

describe("boundText", () => {
  it("writes the bound of a high direction", () => {
    const signal = signalOf({
      unit: "ratio",
      bounds: { direction: "high", warn: 0.1, bad: 0.15, floor: null },
    });

    expect(boundText(signal, "bad")).toBe("bad > 15 %");
    expect(boundText(signal, "warn")).toBe("warn > 10 %");
  });

  it("writes the bound of the direction low", () => {
    const signal = signalOf({ unit: "ratio", bounds: LOW });

    expect(boundText(signal, "warn")).toBe("warn < 60 %");
  });

  it("writes a duration bound", () => {
    const signal = signalOf({ unit: "ms", bounds: boundsOf("evaluation.review") });

    expect(boundText(signal, "warn")).toBe("warn > 1 h");
    expect(boundText(signal, "bad")).toBe("bad > 4 h");
  });

  it("writes the text of the provider error rule", () => {
    const signal = signalOf({ unit: "count", bounds: boundsOf("executing.turn_rate_limited", 2) });

    expect(boundText(signal, "warn")).toBe("warn > 6 a day and ≥ 10");
  });

  it("answers null for ok and for a missing bound", () => {
    const signal = signalOf({ unit: "ratio", bounds: boundsOf("verification.fail") });

    expect(boundText(signal, "ok")).toBeNull();
    expect(boundText(signal, "bad")).toBeNull();
    expect(boundText(signalOf({ bounds: null }), "warn")).toBeNull();
  });
});
