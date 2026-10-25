import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { listTracePage } from "@/api/resources/tracking";
import type { EffectiveCause, SchedulerExecutionRecord, TraceListItem } from "@/api/types";
import { useTraceSummaries } from "./use-trace-summaries";

vi.mock("@/api/resources/tracking", () => ({
  listTracePage: vi.fn(),
}));

const listMock = vi.mocked(listTracePage);

function executionOf(traceId: string): SchedulerExecutionRecord {
  return { execution_id: `execution_${traceId}`, trace_id: traceId } as SchedulerExecutionRecord;
}

function traceOf(traceId: string, turns: number, cause: EffectiveCause | null): TraceListItem {
  return {
    trace_id: traceId,
    turn_count: turns,
    total_tokens: 1_500,
    cost_usd: 2,
    error_count: 0,
    cause,
  } as TraceListItem;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useTraceSummaries", () => {
  it("reads the traces of the node once and answers the line and the cause of each", async () => {
    const rateLimited: EffectiveCause = {
      category: "llm_provider",
      assigner: "rule",
      subcategory: "rate_limited",
    };
    listMock.mockResolvedValue({
      items: [traceOf("trace_a", 3, rateLimited), traceOf("trace_b", 4, null)],
      next_cursor: null,
    });

    const { result } = renderHook(() =>
      useTraceSummaries("node_1", [
        executionOf("trace_a"),
        executionOf("trace_b"),
        executionOf("trace_a"),
      ]),
    );

    await waitFor(() => expect(result.current.size).toBe(2));
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(listMock).toHaveBeenCalledWith({ node_id: "node_1" }, null, 100);
    expect(result.current.get("trace_a")).toEqual({
      line: "3 turns · 1.5k tokens · Est. cost $2.00 · 0 errors",
      cause: rateLimited,
    });
    expect(result.current.get("trace_b")).toEqual({
      line: "4 turns · 1.5k tokens · Est. cost $2.00 · 0 errors",
      cause: null,
    });
  });

  it("words a trace that the list does not answer as expired", async () => {
    listMock.mockResolvedValue({ items: [traceOf("trace_ok", 1, null)], next_cursor: null });

    const { result } = renderHook(() =>
      useTraceSummaries("node_1", [executionOf("trace_ok"), executionOf("trace_gone")]),
    );

    await waitFor(() => expect(result.current.size).toBe(2));
    expect(result.current.get("trace_gone")).toEqual({ line: "Trace expired", cause: null });
  });

  it("answers nothing when the list read fails", async () => {
    listMock.mockRejectedValue(new ApiError("unreachable", "No answer.", 0));

    const { result } = renderHook(() => useTraceSummaries("node_1", [executionOf("trace_a")]));

    await waitFor(() => expect(listMock).toHaveBeenCalledTimes(1));
    expect(result.current.size).toBe(0);
  });

  it("reads nothing before the executions are known", () => {
    const { result } = renderHook(() => useTraceSummaries("node_1", null));

    expect(result.current.size).toBe(0);
    expect(listMock).not.toHaveBeenCalled();
  });
});
