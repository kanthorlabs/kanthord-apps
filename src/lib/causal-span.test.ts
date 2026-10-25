import { describe, expect, it } from "vitest";

import type { SpanAttributeValue, SpanStatus, TraceSpan } from "@/api/types";

import { ErrorRole, errorRolesOf, errorSteps, pickCausalSpan } from "./causal-span";

const ROOT = "root";

interface SpanOptions {
  readonly parent?: string | null;
  readonly start?: number;
  readonly end?: number;
  readonly status?: SpanStatus;
  readonly attributes?: Record<string, SpanAttributeValue>;
}

function span(id: string, operation: string, options: SpanOptions = {}): TraceSpan {
  return {
    trace_id: "trace_1",
    span_id: id,
    parent_span_id: options.parent === undefined ? ROOT : options.parent,
    producer: "worker",
    origin: "observed",
    operation,
    start_time: options.start ?? 1,
    end_time: options.end ?? 2,
    status: options.status ?? "Ok",
    attributes: options.attributes ?? {},
    events: [],
    links: [],
    text_ids: [],
    created_at: 1,
  };
}

const root = (attributes: Record<string, SpanAttributeValue> = {}, end = 100) =>
  span(ROOT, "scheduler.execution", { parent: null, start: 0, end, attributes });

const idOf = (picked: TraceSpan | null) => picked?.span_id ?? null;

describe("pickCausalSpan", () => {
  it("answers null when the trace holds no root span", () => {
    expect(pickCausalSpan([span("a", "agent.turn")], ROOT)).toBeNull();
  });

  it("picks the last turn whose error type equals the stop code", () => {
    const spans = [
      root({ "kanthord.stop.reason": "provider_failed", "kanthord.stop.code": "rate_limited" }),
      span("turn_1", "agent.turn", { start: 1, attributes: { "error.type": "rate_limited" } }),
      span("turn_2", "agent.turn", { start: 5, attributes: { "error.type": "rate_limited" } }),
      span("turn_3", "agent.turn", { start: 9, attributes: { "error.type": "overloaded" } }),
    ];

    expect(idOf(pickCausalSpan(spans, ROOT))).toBe("turn_2");
  });

  it("picks the last verification with exit code 127 for a missing command", () => {
    const spans = [
      root({
        "kanthord.stop.reason": "environment_failed",
        "kanthord.stop.code": "command_absent",
      }),
      span("check_1", "worker.verification", {
        start: 1,
        attributes: { "process.exit.code": 127 },
      }),
      span("check_2", "worker.verification", {
        start: 4,
        attributes: { "process.exit.code": 127 },
      }),
      span("check_3", "worker.verification", { start: 8, attributes: { "process.exit.code": 1 } }),
    ];

    expect(idOf(pickCausalSpan(spans, ROOT))).toBe("check_2");
  });

  it("picks the task that holds the stop reason for no progress", () => {
    const spans = [
      root({ "kanthord.stop.reason": "no_progress" }),
      span("task_1", "worker.task"),
      span("task_2", "worker.task", { attributes: { "kanthord.stop.reason": "no_progress" } }),
    ];

    expect(idOf(pickCausalSpan(spans, ROOT))).toBe("task_2");
  });

  it("picks the evaluation that did not meet the criterion", () => {
    const spans = [
      root(),
      span("turn_1", "agent.turn", { status: "Error", end: 50 }),
      span("evaluation_1", "worker.evaluation", {
        attributes: { "kanthord.evaluation.result": "criterion-not-met" },
      }),
    ];

    expect(idOf(pickCausalSpan(spans, ROOT))).toBe("evaluation_1");
  });

  it("skips an evaluation that met the criterion", () => {
    const spans = [
      root(),
      span("turn_1", "agent.turn", { status: "Error", end: 50 }),
      span("evaluation_1", "worker.evaluation", {
        attributes: { "kanthord.evaluation.result": "success" },
      }),
    ];

    expect(idOf(pickCausalSpan(spans, ROOT))).toBe("turn_1");
  });

  it("picks the Error leaf with the latest end time and skips stopped spans", () => {
    const spans = [
      root(),
      span("tool_1", "agent.tool", { status: "Error", end: 30 }),
      span("turn_1", "agent.turn", { status: "Error", end: 60 }),
      span("turn_2", "agent.turn", {
        status: "Error",
        end: 90,
        attributes: { "error.type": "stopped" },
      }),
    ];

    expect(idOf(pickCausalSpan(spans, ROOT))).toBe("turn_1");
  });

  it("skips an Error span that has an Error child", () => {
    const spans = [
      root(),
      span("task_1", "worker.task", { status: "Error", end: 90 }),
      span("turn_1", "agent.turn", { parent: "task_1", status: "Error", end: 40 }),
    ];

    expect(idOf(pickCausalSpan(spans, ROOT))).toBe("turn_1");
  });

  it("picks the deeper span on an end time tie", () => {
    const spans = [
      root(),
      span("task_1", "worker.task", { status: "Error", end: 50 }),
      span("task_2", "worker.task", { status: "Error", end: 50 }),
      span("turn_1", "agent.turn", { parent: "task_2", status: "Error", end: 50 }),
    ];

    expect(idOf(pickCausalSpan(spans, ROOT))).toBe("turn_1");
  });

  it("picks the root span when no rule matches", () => {
    expect(idOf(pickCausalSpan([root(), span("turn_1", "agent.turn")], ROOT))).toBe(ROOT);
  });
});

describe("errorRolesOf", () => {
  const spans = [
    root({}, 100),
    span("task_1", "worker.task", { status: "Error", start: 1, end: 100 }),
    span("tool_1", "agent.tool", {
      parent: "task_1",
      status: "Error",
      start: 5,
      end: 20,
      attributes: { "error.type": "tool_error" },
    }),
    span("turn_1", "agent.turn", { parent: "task_1", status: "Error", start: 30, end: 60 }),
    span("turn_2", "agent.turn", {
      parent: "task_1",
      status: "Error",
      start: 70,
      end: 100,
      attributes: { "error.type": "stopped" },
    }),
    span("turn_3", "agent.turn", { parent: "task_1", status: "Ok", start: 10, end: 15 }),
  ];
  const causal = spans[3] ?? null;
  const roles = errorRolesOf(spans, causal);

  it("marks the causal span", () => {
    expect(roles.get("turn_1")).toBe(ErrorRole.Causal);
  });

  it("marks a recovered tool_error", () => {
    expect(roles.get("tool_1")).toBe(ErrorRole.Recovered);
  });

  it("marks a stopped turn and an ancestor task as consequences", () => {
    expect(roles.get("turn_2")).toBe(ErrorRole.Consequence);
    expect(roles.get("task_1")).toBe(ErrorRole.Consequence);
  });

  it("holds no role for a span that did not fail", () => {
    expect(roles.has("turn_3")).toBe(false);
  });

  it("marks an Error span that ends at the stop time as a consequence", () => {
    const late = span("tool_2", "agent.tool", { status: "Error", end: 100 });

    expect(errorRolesOf([root({}, 100), late, ...spans.slice(1)], causal).get("tool_2")).toBe(
      ErrorRole.Consequence,
    );
  });
});

describe("errorSteps", () => {
  it("lists the causal span and the consequences in end time order", () => {
    const spans = [
      root({}, 100),
      span("task_1", "worker.task", { status: "Error", end: 100 }),
      span("tool_1", "agent.tool", { parent: "task_1", status: "Error", end: 20 }),
      span("turn_1", "agent.turn", { parent: "task_1", status: "Error", end: 60 }),
      span("turn_2", "agent.turn", {
        parent: "task_1",
        status: "Error",
        end: 100,
        attributes: { "error.type": "stopped" },
      }),
    ];
    const roles = errorRolesOf(spans, spans[3] ?? null);

    expect(errorSteps(spans, roles)).toEqual(["turn_1", "turn_2", "task_1"]);
  });
});
