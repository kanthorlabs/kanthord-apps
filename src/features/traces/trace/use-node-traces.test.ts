import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/tracking", () => ({
  listTraceSpans: vi.fn(),
}));

import { ApiError } from "@/api/errors";
import { listTraceSpans } from "@/api/resources/tracking";
import type {
  EffectiveCause,
  MissionAttempt,
  TraceListItem,
  TraceSpan,
  TraceState,
} from "@/api/types";

import { useNodeTraces } from "./use-node-traces";
import type { TraceNode } from "./use-trace-node";

const PLAN_CAUSE: EffectiveCause = {
  category: "plan",
  subcategory: "decomposition",
  assigner: "rule",
};

function item(
  traceId: string,
  attempt: number,
  createdAt: number,
  state: TraceState,
  cause: EffectiveCause | null,
): TraceListItem {
  return {
    trace_id: traceId,
    project_id: "project-1",
    execution_id: null,
    node_id: "node-1",
    attempt,
    root_span_id: `${traceId}-root`,
    created_at: createdAt,
    state,
    started_at: createdAt,
    ended_at: createdAt + 5,
    duration_ms: 1500,
    stop_reason: null,
    worker_name: null,
    agent_names: [],
    models: [],
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    total_tokens: 0,
    cost_usd: 0,
    span_count: 0,
    turn_count: 0,
    tool_count: 0,
    error_count: 0,
    error_types: [],
    first_error_span_id: null,
    root_operation: null,
    root_attributes: { "kanthord.execution.kind": "steps" },
    cause,
  };
}

function attempt(number: number, revision: number): MissionAttempt {
  return {
    node_id: "node-1",
    attempt: number,
    node_revision: revision,
    start_point: "base_branch",
    required_external_actions: [],
    opened_at: number,
    closed_at: null,
    outcome_ids: [],
    opened_by: { kind: "human", account: "ada", name: "Ada" },
  };
}

function promptSpan(digest: string): TraceSpan {
  return {
    trace_id: "trace",
    span_id: "prompt",
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation: "agent.prompt",
    start_time: 1,
    end_time: 2,
    status: "Ok",
    attributes: {
      "kanthord.agent.name": "coder",
      "kanthord.prompt.parts": [`system:coder:${digest}`],
    },
    events: [],
    links: [],
    text_ids: [],
    created_at: 1,
  };
}

const FIRST = item("t1", 1, 10, "error", PLAN_CAUSE);
const SECOND = item("t2", 1, 20, "error", PLAN_CAUSE);
const THIRD = item("t3", 2, 30, "error", { ...PLAN_CAUSE, subcategory: "oversized" });

function traceNode(
  items: readonly TraceListItem[],
  attempts: readonly MissionAttempt[] = [attempt(1, 1), attempt(2, 2)],
  overrides: Partial<TraceNode> = {},
): TraceNode {
  return {
    items,
    attempts,
    revision: null,
    revisionError: null,
    taskNames: new Map(),
    loading: false,
    error: null,
    retry: vi.fn(),
    ...overrides,
  };
}

const NO_SPANS: readonly TraceSpan[] = [];

afterEach(() => {
  vi.resetAllMocks();
});

describe("useNodeTraces", () => {
  it("groups two attempts and marks the repeat in the first one", () => {
    vi.mocked(listTraceSpans).mockResolvedValue([]);
    const node = traceNode([FIRST, SECOND, THIRD]);

    const { result } = renderHook(() => useNodeTraces(THIRD, NO_SPANS, node));

    expect(result.current.items).toBe(node.items);
    expect(result.current.groups).toHaveLength(2);
    const [latest, earliest] = result.current.groups;
    expect(latest?.attempt).toBe(2);
    expect(latest?.executions.map((execution) => execution.isRepeat)).toEqual([false]);
    expect(earliest?.executions.map((execution) => execution.isRepeat)).toEqual([false, true]);
    expect(result.current.repeatedAttempts).toBe(1);
    expect(result.current.repeatedExecutions).toBe(1);
  });

  it("marks the plan change of the second attempt", () => {
    vi.mocked(listTraceSpans).mockResolvedValue([]);
    const node = traceNode([FIRST, SECOND, THIRD]);

    const { result } = renderHook(() => useNodeTraces(THIRD, NO_SPANS, node));

    expect(result.current.groups.map((group) => group.planChanged)).toEqual([true, false]);
    expect(result.current.groups.map((group) => group.nodeRevision)).toEqual([2, 1]);
  });

  it("marks the changed prompt on the current execution only", async () => {
    vi.mocked(listTraceSpans).mockResolvedValue([promptSpan("old")]);
    const node = traceNode([FIRST, SECOND, THIRD]);
    const spans = [promptSpan("new")];

    const { result } = renderHook(() => useNodeTraces(THIRD, spans, node));

    await waitFor(() => {
      const executions = result.current.groups.flatMap((group) => group.executions);
      expect(executions.find((execution) => execution.traceId === "t3")?.promptChanged).toBe(true);
    });
    const marked = result.current.groups
      .flatMap((group) => group.executions)
      .filter((execution) => execution.promptChanged);
    expect(marked.map((execution) => execution.traceId)).toEqual(["t3"]);
    expect(listTraceSpans).toHaveBeenCalledWith("t2");
    expect(listTraceSpans).toHaveBeenCalledTimes(1);
  });

  it("reads no span for a trace with no node", async () => {
    const node = traceNode([], []);

    const { result } = renderHook(() =>
      useNodeTraces({ ...FIRST, node_id: null, attempt: null }, NO_SPANS, node),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.groups).toEqual([]);
    expect(listTraceSpans).not.toHaveBeenCalled();
  });

  it("answers the loading and the error of the trace node and retries it", () => {
    const failure = new ApiError("unavailable", "The daemon is down.", 503);
    const node = traceNode([], [], { loading: true, error: failure });

    const { result } = renderHook(() => useNodeTraces(THIRD, NO_SPANS, node));

    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBe(failure);
    expect(result.current.groups).toEqual([]);

    result.current.retry();

    expect(node.retry).toHaveBeenCalledTimes(1);
  });
});
