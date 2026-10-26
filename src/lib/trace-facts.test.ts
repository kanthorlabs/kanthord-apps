import { describe, expect, it } from "vitest";

import type { TraceListItem } from "@/api/types";

import { traceFactsOf } from "./trace-facts";

const STARTED_AT = Date.UTC(2026, 4, 2, 10, 30);

function trace(overrides: Partial<TraceListItem> = {}): TraceListItem {
  return {
    trace_id: "trc-1",
    state: "ok",
    started_at: STARTED_AT,
    duration_ms: 90_000,
    worker_name: "general",
    attempt: 2,
    cost_usd: 0.25,
    turn_count: 4,
    error_count: 1,
    ...overrides,
  } as TraceListItem;
}

describe("traceFactsOf", () => {
  it("lists the seven facts with a full and a compact value", () => {
    expect(traceFactsOf(trace())).toEqual([
      { label: "Worker", value: "general", compact: "general" },
      { label: "Attempt", value: "2", compact: "#2" },
      { label: "Duration", value: "1 m", compact: "1 m" },
      { label: "API price", value: "$0.2500", compact: "$0.2500" },
      { label: "Started", value: "2026-05-02 10:30 UTC", compact: "05-02 10:30" },
      { label: "Turns", value: "4", compact: "4 turns" },
      { label: "Errors (incl. recovered)", value: "1", compact: "1 err" },
    ]);
  });

  it("omits an absent worker, attempt and start and shows running", () => {
    const labels = traceFactsOf(
      trace({ worker_name: null, attempt: null, started_at: null, duration_ms: null }),
    ).map((fact) => [fact.label, fact.value]);
    expect(labels).toEqual([
      ["Duration", "running"],
      ["API price", "$0.2500"],
      ["Turns", "4"],
      ["Errors (incl. recovered)", "1"],
    ]);
  });
});
