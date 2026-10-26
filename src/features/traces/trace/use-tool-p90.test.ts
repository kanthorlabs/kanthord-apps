import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/tracking", () => ({
  readAnalyticsDuration: vi.fn(),
}));

import { ApiError } from "@/api/errors";
import { readAnalyticsDuration } from "@/api/resources/tracking";
import type { AnalyticsDurationItem } from "@/api/types";

import { useToolP90 } from "./use-tool-p90";

const DAY_MS = 24 * 60 * 60 * 1000;

function item(key: string, bucketStart: number | null, p90: number): AnalyticsDurationItem {
  return { key, bucket_start: bucketStart, count: 3, p50: 1, p90, p99: p90, mean: 1, max: p90 };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("useToolP90", () => {
  it("asks for one item for each tool and answers the p90 of the tool", async () => {
    vi.mocked(readAnalyticsDuration).mockResolvedValue({
      items: [item("read_file", null, 50), item("bash", null, 4000)],
      truncated: false,
    });

    const { result } = renderHook(() => useToolP90("project-1", "bash"));

    await waitFor(() => expect(result.current).toBe(4000));
    expect(readAnalyticsDuration).toHaveBeenCalledTimes(1);
    const query = vi.mocked(readAnalyticsDuration).mock.calls[0]?.[0];
    expect(query).toMatchObject({
      measure: "tool_latency",
      group_by: "tool_name",
      bucket: "none",
      project_id: "project-1",
    });
    expect((query?.to ?? 0) - (query?.from ?? 0)).toBe(7 * DAY_MS);
  });

  it("asks for bucket none so that the engine does not answer one item for each day", async () => {
    vi.mocked(readAnalyticsDuration).mockImplementation(async (query) => ({
      items:
        query.bucket === "none"
          ? [item("bash", null, 4000)]
          : [item("bash", 1_000, 100), item("bash", 1_000 + DAY_MS, 200)],
      truncated: false,
    }));

    const { result } = renderHook(() => useToolP90("project-1", "bash"));

    await waitFor(() => expect(result.current).toBe(4000));
    expect(vi.mocked(readAnalyticsDuration).mock.calls[0]?.[0]).toMatchObject({ bucket: "none" });
  });

  it("does not read again when the component renders again", async () => {
    vi.mocked(readAnalyticsDuration).mockResolvedValue({
      items: [item("bash", null, 4000)],
      truncated: false,
    });

    const { result, rerender } = renderHook(() => useToolP90("project-1", "bash"));
    await waitFor(() => expect(result.current).toBe(4000));
    rerender();

    expect(readAnalyticsDuration).toHaveBeenCalledTimes(1);
  });

  it("answers null when the tool has no item", async () => {
    vi.mocked(readAnalyticsDuration).mockResolvedValue({
      items: [item("read_file", null, 50)],
      truncated: false,
    });

    const { result } = renderHook(() => useToolP90("project-1", "bash"));

    await waitFor(() => expect(readAnalyticsDuration).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });

  it("reads nothing when the project or the tool is null", () => {
    renderHook(() => useToolP90(null, "bash"));
    renderHook(() => useToolP90("project-1", null));

    expect(readAnalyticsDuration).not.toHaveBeenCalled();
  });

  it("answers null when the read fails", async () => {
    vi.mocked(readAnalyticsDuration).mockRejectedValue(new ApiError("unavailable", "boom", 503));

    const { result } = renderHook(() => useToolP90("project-1", "bash"));

    await waitFor(() => expect(readAnalyticsDuration).toHaveBeenCalled());
    expect(result.current).toBeNull();
  });
});
