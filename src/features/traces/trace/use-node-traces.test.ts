import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/tracking", () => ({
  listTracePage: vi.fn(),
  listTraceSpans: vi.fn(),
}));
vi.mock("@/api/resources/mission", () => ({
  listNodeAttempts: vi.fn(),
}));

import { ApiError } from "@/api/errors";
import { listNodeAttempts } from "@/api/resources/mission";
import { listTracePage, listTraceSpans } from "@/api/resources/tracking";
import type {
  EffectiveCause,
  MissionAttempt,
  TraceListItem,
  TraceSpan,
  TraceState,
} from "@/api/types";

import { useNodeTraces } from "./use-node-traces";

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

function readsNode(items: readonly TraceListItem[]) {
  vi.mocked(listTracePage).mockResolvedValue({ items, next_cursor: null });
  vi.mocked(listNodeAttempts).mockResolvedValue([attempt(1, 1), attempt(2, 2)]);
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("useNodeTraces", () => {
  it("reads the traces and the attempts of the node", async () => {
    readsNode([FIRST, SECOND, THIRD]);
    vi.mocked(listTraceSpans).mockResolvedValue([]);

    const { result } = renderHook(() => useNodeTraces(THIRD));

    await waitFor(() => expect(result.current.items).toHaveLength(3));
    expect(listTracePage).toHaveBeenCalledWith({ node_id: "node-1" }, null, 100);
    expect(listNodeAttempts).toHaveBeenCalledWith("node-1");
  });

  it("groups two attempts and marks the repeat in the first one", async () => {
    readsNode([FIRST, SECOND, THIRD]);
    vi.mocked(listTraceSpans).mockResolvedValue([]);

    const { result } = renderHook(() => useNodeTraces(THIRD));

    await waitFor(() => expect(result.current.groups).toHaveLength(2));
    const [latest, earliest] = result.current.groups;
    expect(latest?.attempt).toBe(2);
    expect(latest?.executions.map((execution) => execution.isRepeat)).toEqual([false]);
    expect(earliest?.executions.map((execution) => execution.isRepeat)).toEqual([false, true]);
    expect(result.current.repeatedAttempts).toBe(1);
    expect(result.current.repeatedExecutions).toBe(1);
  });

  it("marks the plan change of the second attempt", async () => {
    readsNode([FIRST, SECOND, THIRD]);
    vi.mocked(listTraceSpans).mockResolvedValue([]);

    const { result } = renderHook(() => useNodeTraces(THIRD));

    await waitFor(() => expect(result.current.groups).toHaveLength(2));
    expect(result.current.groups.map((group) => group.planChanged)).toEqual([true, false]);
    expect(result.current.groups.map((group) => group.nodeRevision)).toEqual([2, 1]);
  });

  it("marks the changed prompt on the current execution only", async () => {
    readsNode([FIRST, SECOND, THIRD]);
    vi.mocked(listTraceSpans).mockImplementation(async (traceId) => [
      promptSpan(traceId === "t3" ? "new" : "old"),
    ]);

    const { result } = renderHook(() => useNodeTraces(THIRD));

    await waitFor(() => {
      const executions = result.current.groups.flatMap((group) => group.executions);
      expect(executions.find((execution) => execution.traceId === "t3")?.promptChanged).toBe(true);
    });
    const marked = result.current.groups
      .flatMap((group) => group.executions)
      .filter((execution) => execution.promptChanged);
    expect(marked.map((execution) => execution.traceId)).toEqual(["t3"]);
    expect(listTraceSpans).toHaveBeenCalledWith("t2");
    expect(listTraceSpans).toHaveBeenCalledTimes(2);
  });

  it("reads nothing for a trace with no node", async () => {
    const { result } = renderHook(() => useNodeTraces({ ...FIRST, node_id: null, attempt: null }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.groups).toEqual([]);
    expect(listTracePage).not.toHaveBeenCalled();
    expect(listNodeAttempts).not.toHaveBeenCalled();
    expect(listTraceSpans).not.toHaveBeenCalled();
  });

  it("answers the ApiError of a failed read and retries it", async () => {
    const failure = new ApiError("unavailable", "The daemon is down.", 503);
    vi.mocked(listTracePage).mockRejectedValueOnce(failure);
    vi.mocked(listNodeAttempts).mockResolvedValue([attempt(1, 1), attempt(2, 2)]);
    vi.mocked(listTraceSpans).mockResolvedValue([]);

    const { result } = renderHook(() => useNodeTraces(THIRD));

    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(result.current.groups).toEqual([]);

    vi.mocked(listTracePage).mockResolvedValue({
      items: [FIRST, SECOND, THIRD],
      next_cursor: null,
    });
    result.current.retry();

    await waitFor(() => expect(result.current.groups).toHaveLength(2));
    expect(result.current.error).toBeNull();
  });
});
