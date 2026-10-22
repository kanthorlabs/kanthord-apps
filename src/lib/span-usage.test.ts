import { describe, expect, it } from "vitest";

import type { SpanAttributeValue, TraceSpan } from "@/api/types";

import { usageBySpan } from "./span-usage";

function span(
  id: string,
  parent: string | null,
  operation: string,
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
    end_time: 2,
    status: "Ok",
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: 1,
  };
}

function turn(
  id: string,
  parent: string,
  conversation: string,
  input: number,
  output: number,
  cost: number,
): TraceSpan {
  return span(id, parent, "agent.turn", {
    "gen_ai.conversation.id": conversation,
    "gen_ai.usage.input_tokens": input,
    "gen_ai.usage.output_tokens": output,
    "kanthord.usage.cost_usd": cost,
  });
}

describe("usageBySpan", () => {
  const spans = [
    span("exec", null, "scheduler.execution"),
    span("task", "exec", "worker.task"),
    span("session", "exec", "agent.session"),
    turn("t1", "task", "session", 100, 20, 0.5),
    turn("t2", "task", "session", 50, 5, 0.25),
    span("judge", "exec", "worker.judgement"),
    turn("t3", "judge", "session", 10, 1, 0.125),
    span("git", "exec", "worker.git"),
  ];
  const usage = usageBySpan(spans);

  it("gives a turn the sum of input and output tokens and the cost", () => {
    expect(usage.get("t1")).toEqual({ tokens: 120, costUsd: 0.5 });
  });

  it("gives a task the sum of the turns below it", () => {
    expect(usage.get("task")).toEqual({ tokens: 175, costUsd: 0.75 });
  });

  it("gives a judgement the sum of the turns below it", () => {
    expect(usage.get("judge")).toEqual({ tokens: 11, costUsd: 0.125 });
  });

  it("gives a session the sum of the turns of its conversation", () => {
    expect(usage.get("session")).toEqual({ tokens: 186, costUsd: 0.875 });
  });

  it("gives any other span no entry", () => {
    expect(usage.has("exec")).toBe(false);
    expect(usage.has("git")).toBe(false);
  });

  it("counts a missing number as 0", () => {
    const partial = usageBySpan([
      span("task", null, "worker.task"),
      span("t", "task", "agent.turn", { "gen_ai.usage.output_tokens": 7 }),
    ]);
    expect(partial.get("t")).toEqual({ tokens: 7, costUsd: 0 });
    expect(partial.get("task")).toEqual({ tokens: 7, costUsd: 0 });
  });

  it("sums the turns below a task at any depth", () => {
    const deep = usageBySpan([
      span("task", null, "worker.task"),
      span("phase", "task", "worker.phase"),
      turn("t", "phase", "none", 1, 2, 0.1),
    ]);
    expect(deep.get("task")).toEqual({ tokens: 3, costUsd: 0.1 });
  });

  it("gives a task and a session without turns a zero entry", () => {
    const empty = usageBySpan([
      span("task", null, "worker.task"),
      span("s", null, "agent.session"),
    ]);
    expect(empty.get("task")).toEqual({ tokens: 0, costUsd: 0 });
    expect(empty.get("s")).toEqual({ tokens: 0, costUsd: 0 });
  });
});
