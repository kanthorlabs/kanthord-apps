import { describe, expect, it } from "vitest";

import type { SpanAttributeValue, TraceSpan } from "@/api/types";

import { spanGroup, spanLabel } from "./span-labels";

function span(operation: string, attributes: Record<string, SpanAttributeValue> = {}): TraceSpan {
  return {
    trace_id: "trace_1",
    span_id: "span_1",
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation,
    start_time: 1,
    end_time: 2,
    status: "Ok",
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: 1,
  };
}

describe("spanLabel", () => {
  it.each([
    ["scheduler.execution", {}, "Execution"],
    ["worker.phase", { "kanthord.phase": "build" }, "Phase build"],
    ["worker.task", { "kanthord.task.id": "node_7" }, "Task node_7"],
    ["worker.verification", { "kanthord.verification.index": 2 }, "Verification 2"],
    ["worker.judgement", {}, "Judgement"],
    ["worker.evaluation", {}, "Evaluation"],
    ["worker.git", { "kanthord.git.step": "commit" }, "Git commit"],
    ["agent.session", { "kanthord.agent.name": "coder" }, "Session coder"],
    ["agent.turn", { "kanthord.turn.index": 3 }, "Turn 3"],
    ["agent.tool", { "gen_ai.tool.name": "bash" }, "bash"],
    ["agent.progress", {}, "Progress"],
    ["custom.operation", {}, "custom.operation"],
  ] satisfies [string, Record<string, SpanAttributeValue>, string][])(
    "labels %s",
    (operation, attributes, label) => {
      expect(spanLabel(span(operation, attributes))).toBe(label);
    },
  );

  it("leaves the label without its value when the attribute is absent", () => {
    expect(spanLabel(span("worker.phase"))).toBe("Phase");
    expect(spanLabel(span("agent.turn"))).toBe("Turn");
  });
});

describe("spanGroup", () => {
  it.each([
    ["agent.session", "agent"],
    ["agent.turn", "agent"],
    ["agent.progress", "agent"],
    ["agent.tool", "tools"],
    ["worker.verification", "checks"],
    ["worker.judgement", "checks"],
    ["worker.evaluation", "checks"],
    ["worker.git", "git"],
    ["worker.task", "other"],
    ["scheduler.execution", "other"],
  ] as const)("groups %s as %s", (operation, group) => {
    expect(spanGroup(span(operation))).toBe(group);
  });
});
