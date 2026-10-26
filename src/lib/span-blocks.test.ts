import { describe, expect, it } from "vitest";

import type { SpanAttributeValue, TraceSpan } from "@/api/types";

import { spanBlocks } from "./span-blocks";

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

const texts = ["command", "output", "error", "rationale"].map((name) => ({ name }));

function shape(target: TraceSpan) {
  return spanBlocks(target, texts).map((block) => ({
    title: block.title,
    items: block.items.map((item) =>
      item.kind === "text" ? item.text.name : item.facts.map((fact) => fact.name),
    ),
  }));
}

describe("spanBlocks", () => {
  it("orders a verification as output, exit code, timed out, then command", () => {
    const verification = span("worker.verification", {
      "kanthord.verification.timed_out": true,
      "process.exit.code": 1,
    });

    expect(shape(verification)).toEqual([
      {
        title: "Result",
        items: ["output", ["process.exit.code", "kanthord.verification.timed_out"]],
      },
      { title: "Command", items: ["command"] },
    ]);
  });

  it("shows the facts of an affected span in the Affected tests block", () => {
    const affected = span("worker.verification", {
      "kanthord.verification.kind": "affected",
      "kanthord.affected.verdict": "failed",
      "kanthord.affected.selection": "all",
      "kanthord.affected.reason": "config changed",
      "kanthord.affected.changed_count": 3,
      "kanthord.affected.test_count": 12,
      "kanthord.affected.failed_count": 1,
      "kanthord.affected.flaky_count": 0,
      "kanthord.affected.excluded_e2e_count": 2,
      "kanthord.affected.tests": ["a.test.ts", "b.test.ts"],
      "kanthord.affected.failed": ["a.test.ts > adds"],
    });

    expect(shape(affected)).toEqual([
      { title: "Result", items: ["output", ["kanthord.verification.kind"]] },
      {
        title: "Affected tests",
        items: [
          [
            "kanthord.affected.verdict",
            "kanthord.affected.selection",
            "kanthord.affected.reason",
            "kanthord.affected.changed_count",
            "kanthord.affected.test_count",
            "kanthord.affected.failed_count",
            "kanthord.affected.flaky_count",
            "kanthord.affected.excluded_e2e_count",
            "kanthord.affected.failed",
          ],
        ],
      },
      { title: "Command", items: ["command"] },
    ]);
  });

  it("shows the kind and no affected fact for a listed span", () => {
    const listed = span("worker.verification", { "kanthord.verification.kind": "listed" });

    expect(shape(listed).map((block) => block.title)).toEqual(["Result", "Command"]);
    expect(shape(listed)[0]?.items).toEqual(["output", ["kanthord.verification.kind"]]);
  });

  it("shows the affected verdict of an evaluation after the stage", () => {
    const evaluation = span("worker.evaluation", {
      "kanthord.evaluation.affected": "passed",
      "kanthord.evaluation.stage": "review",
    });

    expect(shape(evaluation)[0]?.items[0]).toEqual([
      "kanthord.evaluation.stage",
      "kanthord.evaluation.affected",
    ]);
  });

  it("shows the affected verdict of a release gate", () => {
    const gate = span("worker.release_gate", {
      "kanthord.release_gate.affected": "base_red",
      "kanthord.release_gate.result": "failed",
      "kanthord.release_gate.unit_id": "unit_1",
    });

    expect(shape(gate)).toEqual([
      {
        title: "Release gate",
        items: [
          [
            "kanthord.release_gate.result",
            "kanthord.release_gate.unit_id",
            "kanthord.release_gate.affected",
          ],
        ],
      },
    ]);
  });

  it("orders a gate as error, violation, then step facts", () => {
    const gate = span("worker.gate", {
      "kanthord.gate.changed": ["a.ts", "b.ts"],
      "kanthord.gate.mode": "strict",
      "kanthord.gate.violation": "outside scope",
    });

    expect(shape(gate)).toEqual([
      { title: "Failure", items: ["error", ["kanthord.gate.violation"]] },
      { title: "Step", items: [["kanthord.gate.mode", "kanthord.gate.changed"]] },
    ]);
    const changed = spanBlocks(gate, texts)[1]?.items[0];
    expect(changed).toEqual({
      kind: "facts",
      facts: [
        { name: "kanthord.gate.mode", value: "strict" },
        { name: "kanthord.gate.changed", value: "a.ts, b.ts" },
      ],
    });
  });

  it("orders a task as the stop facts, then the revision count", () => {
    const task = span("worker.task", {
      "kanthord.task.revision_count": 2,
      "kanthord.stop.detail": "d",
      "kanthord.stop.reason": "no_progress",
    });

    expect(shape(task)).toEqual([
      { title: "Stop", items: [["kanthord.stop.detail", "kanthord.stop.reason"]] },
      { title: "Task", items: [["kanthord.task.revision_count"]] },
    ]);
  });

  it("orders an evaluation with the rationale text last", () => {
    const evaluation = span("worker.evaluation", {
      "kanthord.evaluation.unmet_grounds": "stated",
      "kanthord.evaluation.stage": "review",
      "kanthord.evaluation.result": "criterion-not-met",
    });

    expect(shape(evaluation)).toEqual([
      {
        title: "Evaluation",
        items: [
          [
            "kanthord.evaluation.result",
            "kanthord.evaluation.stage",
            "kanthord.evaluation.unmet_grounds",
          ],
          "rationale",
        ],
      },
    ]);
  });

  it("orders an execution as cause, stop, end, then the queue wait", () => {
    const execution = span("scheduler.execution", {
      "kanthord.queue.wait_ms": 40,
      "kanthord.execution.end": "failed",
      "kanthord.stop.reason": "provider_failed",
      "kanthord.cause.category": "llm_provider",
    });

    expect(shape(execution)).toEqual([
      {
        title: "Cause and stop",
        items: [["kanthord.cause.category", "kanthord.stop.reason", "kanthord.execution.end"]],
      },
      { title: "Queue", items: [["kanthord.queue.wait_ms"]] },
    ]);
  });

  it("shows the revocation label beside the end of a revoked execution", () => {
    const execution = span("scheduler.execution", {
      "kanthord.execution.end": "revoked",
      "kanthord.revoke.cause": "human",
    });

    expect(spanBlocks(execution, texts)[0]?.items[0]).toEqual({
      kind: "facts",
      facts: [{ name: "kanthord.execution.end", value: "revoked - Revoked by a human" }],
    });
  });

  it("answers no block for an operation without a layout", () => {
    expect(spanBlocks(span("agent.turn", { "kanthord.stop.reason": "x" }), texts)).toEqual([]);
    expect(spanBlocks(span("toString"), texts)).toEqual([]);
  });
});
