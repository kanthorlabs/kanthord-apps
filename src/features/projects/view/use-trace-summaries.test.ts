import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { readTrace } from "@/api/resources/tracking";
import type { SchedulerExecutionRecord, TraceSummary } from "@/api/types";
import { useTraceSummaries } from "./use-trace-summaries";

vi.mock("@/api/resources/tracking", () => ({
  readTrace: vi.fn(),
}));

const readMock = vi.mocked(readTrace);

function executionOf(traceId: string): SchedulerExecutionRecord {
  return { execution_id: `execution_${traceId}`, trace_id: traceId } as SchedulerExecutionRecord;
}

function summaryOf(turns: number): TraceSummary {
  return {
    turn_count: turns,
    total_tokens: 1_500,
    cost_usd: 2,
    error_count: 0,
  } as TraceSummary;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("useTraceSummaries", () => {
  it("reads each trace once and words its line", async () => {
    readMock.mockImplementation(async (traceId) => summaryOf(traceId === "trace_a" ? 3 : 4));

    const { result } = renderHook(() =>
      useTraceSummaries([executionOf("trace_a"), executionOf("trace_b"), executionOf("trace_a")]),
    );

    await waitFor(() => expect(result.current.size).toBe(2));
    expect(readMock).toHaveBeenCalledTimes(2);
    expect(result.current.get("trace_a")).toBe(
      "3 turns · 1.5k tokens · Est. cost $2.00 · 0 errors",
    );
    expect(result.current.get("trace_b")).toBe(
      "4 turns · 1.5k tokens · Est. cost $2.00 · 0 errors",
    );
  });

  it("keeps the other rows when a read fails", async () => {
    readMock.mockImplementation(async (traceId) => {
      if (traceId === "trace_gone") throw new ApiError("not_found", "No such trace.", 404);
      if (traceId === "trace_down") throw new ApiError("unreachable", "No answer.", 0);
      return summaryOf(1);
    });

    const { result } = renderHook(() =>
      useTraceSummaries([
        executionOf("trace_ok"),
        executionOf("trace_gone"),
        executionOf("trace_down"),
      ]),
    );

    await waitFor(() => expect(result.current.size).toBe(2));
    expect(result.current.get("trace_ok")).toBe(
      "1 turns · 1.5k tokens · Est. cost $2.00 · 0 errors",
    );
    expect(result.current.get("trace_gone")).toBe("Trace expired");
    expect(result.current.has("trace_down")).toBe(false);
  });

  it("reads nothing before the executions are known", () => {
    const { result } = renderHook(() => useTraceSummaries(null));

    expect(result.current.size).toBe(0);
    expect(readMock).not.toHaveBeenCalled();
  });
});
