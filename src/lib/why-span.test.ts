import { describe, expect, it } from "vitest";

import type { SpanStatus, TraceSpan } from "@/api/types";

import { ErrorRole } from "./causal-span";
import { whySpanLines } from "./why-span";

function span(id: string, parent: string | null, status: SpanStatus = "Ok"): TraceSpan {
  return {
    trace_id: "trace_1",
    span_id: id,
    parent_span_id: parent,
    producer: "worker",
    origin: "observed",
    operation: "worker.task",
    start_time: 1,
    end_time: 2,
    status,
    attributes: { "kanthord.task.id": id },
    events: [],
    links: [],
    text_ids: [],
    created_at: 1,
  };
}

const parent = span("t2", "root", "Error");
const child = span("turn", "t2", "Error");

describe("whySpanLines", () => {
  it.each([
    [ErrorRole.Causal, "Causal span of this trace."],
    [ErrorRole.Consequence, "Consequence of the stop."],
    [ErrorRole.Recovered, "Recovered error."],
  ])("states the %s role and the status of the parent", (role, text) => {
    const lines = whySpanLines(child, [parent, child], new Map([["turn", role]]));

    expect(lines).toEqual([text, "Parent Task t2 ended Error."]);
  });

  it("states only the parent for a span without a role", () => {
    expect(whySpanLines(child, [parent, child], new Map())).toEqual([
      "Parent Task t2 ended Error.",
    ]);
  });

  it("names an unset parent and a parent that is not stored", () => {
    expect(whySpanLines(child, [span("t2", null, "Unset"), child], new Map())).toEqual([
      "Parent Task t2 ended with no status.",
    ]);
    expect(whySpanLines(child, [child], new Map())).toEqual(["Parent span not stored."]);
  });

  it("states no parent for a root span", () => {
    expect(whySpanLines(span("root", null), [], new Map())).toEqual([]);
  });
});
