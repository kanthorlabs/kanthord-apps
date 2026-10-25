import { describe, expect, it } from "vitest";

import type { SpanAttributeValue, SpanStatus, TraceSpan } from "@/api/types";

import { diagnoseSpans } from "./trace-diagnosis";

const NODE_ID = "node_1";
const NODE_NAME = "Check that a failed verification records its cause";
const NO_TASK_NAMES: ReadonlyMap<string, string> = new Map();

function span(
  spanId: string,
  operation: string,
  attributes: Readonly<Record<string, SpanAttributeValue>> = {},
  overrides: Partial<TraceSpan> = {},
): TraceSpan {
  return {
    trace_id: "trace_1",
    span_id: spanId,
    parent_span_id: "root",
    producer: "worker",
    origin: "observed",
    operation,
    start_time: 1000,
    end_time: 2000,
    status: "Unset" as SpanStatus,
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: 2000,
    ...overrides,
  };
}

function failedVerificationSpans(): readonly TraceSpan[] {
  return [
    span(
      "root",
      "scheduler.execution",
      {
        "kanthord.cause.category": "worker_action",
        "kanthord.cause.assigner": "rule",
      },
      { parent_span_id: null, status: "Error", end_time: 5000 },
    ),
    span("task", "worker.task", { "kanthord.task.id": NODE_ID }, { status: "Error" }),
    span(
      "check",
      "worker.verification",
      { "kanthord.verification.index": 0, "process.exit.code": 1 },
      { parent_span_id: "task", status: "Error", end_time: 4000 },
    ),
  ];
}

describe("diagnoseSpans", () => {
  it("names the node for a failed verification of an implicit task", () => {
    const diagnosis = diagnoseSpans(
      failedVerificationSpans(),
      "root",
      new Map([[NODE_ID, NODE_NAME]]),
    );

    expect(diagnosis.sentence).toBe(`Verification 0 of ${NODE_NAME} failed.`);
  });

  it("names the task by its task name when the map holds the task id", () => {
    const diagnosis = diagnoseSpans(
      failedVerificationSpans(),
      "root",
      new Map([[NODE_ID, "Write code"]]),
    );

    expect(diagnosis.sentence).toBe("Verification 0 of Write code failed.");
  });

  it("keeps the task id when the map holds no entry for it", () => {
    const diagnosis = diagnoseSpans(failedVerificationSpans(), "root", NO_TASK_NAMES);

    expect(diagnosis.sentence).toBe(`Verification 0 of Task ${NODE_ID} failed.`);
  });

  it("names the node in the evidence lines of a task", () => {
    const spans = [
      span(
        "root",
        "scheduler.execution",
        {
          "kanthord.cause.category": "plan",
          "kanthord.cause.assigner": "rule",
        },
        { parent_span_id: null, status: "Error", end_time: 5000 },
      ),
      span("task", "worker.task", { "kanthord.task.id": NODE_ID }, { status: "Error" }),
      span("turn", "agent.turn", { "kanthord.turn.index": 1 }, { parent_span_id: "task" }),
    ];

    const diagnosis = diagnoseSpans(spans, "root", new Map([[NODE_ID, NODE_NAME]]));

    expect(diagnosis.evidence).toContainEqual({ text: `${NODE_NAME}: 1 turn`, spanId: "task" });
  });
});
