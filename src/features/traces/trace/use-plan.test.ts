import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApiError } from "@/api/errors";
import type { MissionRevision, SpanAttributeValue, TraceSpan } from "@/api/types";

import { usePlan } from "./use-plan";
import type { TraceNode } from "./use-trace-node";

const REVISION = {
  node_id: "node_1",
  revision: 3,
  content: {
    name: "Ship it",
    requirement: "Build the thing",
    criterion: "The thing works",
    verifications: ["pnpm test"],
  },
  tasks: [
    { id: "task_a", filename: "a.md", content: { name: "Write code" } },
    { id: "task_b", filename: "b.md", content: { name: "Run tests" } },
    { id: "task_c", filename: "c.md", content: { name: "Publish" } },
  ],
} as unknown as MissionRevision;

function traceNode(overrides: Partial<TraceNode> = {}): TraceNode {
  return {
    items: [],
    attempts: [],
    revision: REVISION,
    revisionError: null,
    taskNames: new Map(),
    loading: false,
    error: null,
    retry: () => undefined,
    ...overrides,
  };
}

function taskSpan(
  id: string,
  taskId: string,
  attributes: Readonly<Record<string, SpanAttributeValue>> = {},
  status: TraceSpan["status"] = "Ok",
): TraceSpan {
  return {
    trace_id: "trace-1",
    span_id: id,
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation: "worker.task",
    start_time: 1000,
    end_time: 2000,
    status,
    attributes: { "kanthord.task.id": taskId, ...attributes },
    events: [],
    links: [],
    text_ids: [],
    created_at: 1000,
  };
}

describe("usePlan", () => {
  it("plans the revision of the trace node", () => {
    const { result } = renderHook(() => usePlan(traceNode(), []));
    expect(result.current.plan).toMatchObject({
      name: "Ship it",
      revision: 3,
      requirement: "Build the thing",
      criterion: "The thing works",
      verifications: ["pnpm test"],
    });
    expect(result.current.error).toBeNull();
  });

  it("derives the task states from the spans", () => {
    const spans = [
      taskSpan("s1", "task_a", { "kanthord.task.result": "complete" }),
      taskSpan("s2", "task_b", {}, "Error"),
    ];
    const { result } = renderHook(() => usePlan(traceNode(), spans));
    expect(result.current.plan?.tasks).toEqual([
      { id: "task_a", name: "Write code", state: "done" },
      { id: "task_b", name: "Run tests", state: "failed" },
      { id: "task_c", name: "Publish", state: "open" },
    ]);
  });

  it("answers no plan for a trace node with no revision", () => {
    const { result } = renderHook(() => usePlan(traceNode({ revision: null }), []));
    expect(result.current.plan).toBeNull();
  });

  it("answers the revision error of the trace node", () => {
    const revisionError = new ApiError("not_found", "Gone.", 404);
    const { result } = renderHook(() => usePlan(traceNode({ revision: null, revisionError }), []));
    expect(result.current.error?.message).toBe("Gone.");
    expect(result.current.plan).toBeNull();
  });
});
