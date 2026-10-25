import { describe, expect, it } from "vitest";

import type { SpanAttributeValue, SpanStatus, TraceSpan } from "@/api/types";

import { ErrorRole } from "./causal-span";
import { errorNeighbours, errorTrailOf } from "./error-trail";

function span(
  id: string,
  parent: string | null,
  operation: string,
  end: number,
  status: SpanStatus = "Ok",
  attributes: Record<string, SpanAttributeValue> = {},
): TraceSpan {
  return {
    trace_id: "trace_1",
    span_id: id,
    parent_span_id: parent,
    producer: "worker",
    origin: "observed",
    operation,
    start_time: 1,
    end_time: end,
    status,
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: 1,
  };
}

const failedRoot = (attributes: Record<string, SpanAttributeValue>) =>
  span("root", null, "scheduler.execution", 100, "Error", attributes);

describe("errorTrailOf", () => {
  it("takes the provider failure from the root stop detail of the causal turn", () => {
    const trail = errorTrailOf([
      failedRoot({
        "kanthord.stop.reason": "provider_failed",
        "kanthord.stop.code": "rate_limited",
        "kanthord.stop.detail": "429 Too Many Requests",
      }),
      span("turn", "root", "agent.turn", 50, "Error", { "error.type": "rate_limited" }),
    ]);

    expect(trail.providerFailure).toEqual({ spanId: "turn", detail: "429 Too Many Requests" });
    expect(trail.roles.get("turn")).toBe(ErrorRole.Causal);
    expect(trail.steps).toEqual(["turn", "root"]);
  });

  it("holds no provider failure for another stop or a missing detail", () => {
    const turn = span("turn", "root", "agent.turn", 50, "Error", { "error.type": "rate_limited" });

    expect(
      errorTrailOf([failedRoot({ "kanthord.stop.reason": "no_progress" }), turn]).providerFailure,
    ).toBeNull();
    expect(
      errorTrailOf([
        failedRoot({
          "kanthord.stop.reason": "provider_failed",
          "kanthord.stop.code": "rate_limited",
        }),
        turn,
      ]).providerFailure,
    ).toBeNull();
  });

  it("holds an empty trail for no spans", () => {
    const trail = errorTrailOf([]);

    expect(trail.steps).toEqual([]);
    expect(trail.providerFailure).toBeNull();
  });
});

describe("errorNeighbours", () => {
  const steps = ["a", "b", "c"];

  it("gives the steps around a step", () => {
    expect(errorNeighbours(steps, "b")).toEqual({ previous: "a", next: "c" });
  });

  it("gives no previous at the first step and no next at the last", () => {
    expect(errorNeighbours(steps, "a")).toEqual({ previous: null, next: "b" });
    expect(errorNeighbours(steps, "c")).toEqual({ previous: "b", next: null });
  });

  it("gives the ends for a span outside the steps", () => {
    expect(errorNeighbours(steps, "x")).toEqual({ previous: "c", next: "a" });
    expect(errorNeighbours([], "x")).toEqual({ previous: null, next: null });
  });
});
