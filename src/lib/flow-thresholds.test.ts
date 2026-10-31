import { describe, expect, it } from "vitest";

import {
  boundsOf,
  FLOW_THRESHOLDS,
  MIN_MODEL_TURNS,
  MIN_SETTLED,
  MIN_SUCCESS,
} from "./flow-thresholds";

const HOUR = 3_600_000;
const MINUTE = 60_000;

describe("FLOW_THRESHOLDS", () => {
  it("holds the minimum counts", () => {
    expect([MIN_SETTLED, MIN_SUCCESS, MIN_MODEL_TURNS]).toEqual([5, 10, 50]);
  });

  it("holds every id of the table", () => {
    expect(Object.keys(FLOW_THRESHOLDS)).toHaveLength(26);
  });
});

describe("boundsOf", () => {
  it("answers a fixed bound", () => {
    expect(boundsOf("queued.wait")).toEqual({
      direction: "high",
      warn: 15 * MINUTE,
      bad: HOUR,
      floor: null,
    });
    expect(boundsOf("outcome.rework")).toMatchObject({ warn: 0.25, bad: 0.4 });
    expect(boundsOf("evaluation.review")).toMatchObject({ warn: HOUR, bad: 4 * HOUR });
    expect(boundsOf("data.awaiting")).toMatchObject({ warn: 0, bad: null });
  });

  it("answers the direction low", () => {
    expect(boundsOf("tile.cache_hit")).toEqual({
      direction: "low",
      warn: 0.6,
      bad: 0.4,
      floor: null,
    });
    expect(boundsOf("data.completeness")).toMatchObject({ direction: "low", warn: 0.98 });
  });

  it("answers a bound from the raw previous value", () => {
    expect(boundsOf("executing.time", 4_020_000)).toMatchObject({ warn: 6_030_000, bad: null });
    expect(boundsOf("tile.cost_per_success", 2)).toMatchObject({ warn: 2.5, bad: 3 });
    expect(boundsOf("tile.tokens_per_success", 1000)).toMatchObject({ warn: 1250, bad: 1500 });
  });

  it("answers a provider bound of 3 times the median with a floor of 10", () => {
    expect(boundsOf("executing.turn_unavailable", 2)).toEqual({
      direction: "high",
      warn: 6,
      bad: null,
      floor: 10,
    });
  });

  it("answers no bound for a missing previous value", () => {
    expect(boundsOf("executing.time")).toBeNull();
    expect(boundsOf("tile.cost_per_success", null)).toBeNull();
    expect(boundsOf("executing.turn_rate_limited")).toBeNull();
  });
});
