import { describe, expect, it } from "vitest";

import type { TraceSpan } from "@/api/types";

import { nowFactsOf, slowToolText } from "./trace-now";

const POLL_MS = 1000;

function runningVerification(index: number): TraceSpan {
  return {
    trace_id: "trace_1",
    span_id: "span_1",
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation: "worker.verification",
    start_time: 1000,
    end_time: null,
    status: "Unset",
    attributes: { "kanthord.verification.index": index },
    events: [],
    links: [],
    text_ids: [],
    created_at: 1000,
  };
}

describe("nowFactsOf", () => {
  it("numbers the first running verification from 1", () => {
    const facts = nowFactsOf([runningVerification(0)], 2000, POLL_MS);

    expect(facts.runningLabel).toBe("Verification 1");
  });
});

describe("slowToolText", () => {
  it("answers the text when the age exceeds the p90", () => {
    expect(slowToolText(61_000, 60_000)).toBe(
      "Longer than 90% of the runs of this tool in 7 days (p90 1 m).",
    );
  });

  it("answers null when the age equals or is below the p90", () => {
    expect(slowToolText(60_000, 60_000)).toBeNull();
    expect(slowToolText(1000, 60_000)).toBeNull();
  });

  it("answers null when the p90 is unknown", () => {
    expect(slowToolText(61_000, null)).toBeNull();
  });
});
