import { describe, expect, it } from "vitest";

import type { TraceSpan } from "@/api/types";

import { spanHeadline } from "./span-headline";

function span(overrides: Partial<TraceSpan> = {}): TraceSpan {
  return {
    trace_id: "trace_1",
    span_id: "span_1",
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation: "agent.turn",
    start_time: 1000,
    end_time: 1250,
    status: "Ok",
    attributes: {},
    events: [],
    links: [],
    text_ids: [],
    created_at: 1,
    ...overrides,
  };
}

describe("spanHeadline", () => {
  it("shows a duration under one second in ms", () => {
    expect(spanHeadline(span(), undefined, "ok")).toBe("OK · 250 ms");
  });

  it("shows the status, the error type, the duration and the estimated cost", () => {
    const failed = span({
      status: "Error",
      end_time: 1000 + 360_000,
      attributes: { "error.type": "rate_limited" },
    });

    expect(spanHeadline(failed, { tokens: 10, costUsd: 0.015 }, "error")).toBe(
      "Error · rate_limited · 6 m · API price $0.0150",
    );
  });

  it("names a running span and a span without a start or an end", () => {
    expect(spanHeadline(span({ end_time: null }), undefined, "open")).toBe("OK · Running");
    expect(spanHeadline(span({ end_time: null }), undefined, "ok")).toBe("OK · No end recorded");
    expect(spanHeadline(span({ start_time: null, status: "Unset" }), undefined, "ok")).toBe(
      "Unset · No start recorded",
    );
  });
});
