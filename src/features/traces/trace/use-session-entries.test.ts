import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

vi.mock("@/api/resources/tracking", () => ({
  listSessionEntryPage: vi.fn(),
}));

import { listSessionEntryPage } from "@/api/resources/tracking";
import type { Page, TraceSessionEntry } from "@/api/types";

import { ENTRY_PAGE_LIMIT, ENTRY_PAGES_MAX, useSessionEntries } from "./use-session-entries";

function entry(sequence: number): TraceSessionEntry {
  return {
    trace_id: "trace-1",
    session_id: "session",
    entry_id: `entry-${sequence}`,
    parent_entry_id: null,
    sequence,
    entry_type: "message",
    entry_time: 0,
    tool_call_id: null,
    truncated: false,
    entry: {},
    created_at: 0,
  };
}

function page(sequences: readonly number[], next: string | null): Page<TraceSessionEntry> {
  return { items: sequences.map(entry), next_cursor: next };
}

function sequencesOf(entries: readonly TraceSessionEntry[]): readonly number[] {
  return entries.map((item) => item.sequence);
}

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("useSessionEntries", () => {
  it("reads the three pages in order", async () => {
    vi.mocked(listSessionEntryPage)
      .mockResolvedValueOnce(page([1, 2], "c1"))
      .mockResolvedValueOnce(page([3, 4], "c2"))
      .mockResolvedValueOnce(page([5], null));

    const { result } = renderHook(() => useSessionEntries("trace-1", "session", false));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(sequencesOf(result.current.entries)).toEqual([1, 2, 3, 4, 5]);
    expect(vi.mocked(listSessionEntryPage).mock.calls).toEqual([
      ["trace-1", "session", null, ENTRY_PAGE_LIMIT],
      ["trace-1", "session", "c1", ENTRY_PAGE_LIMIT],
      ["trace-1", "session", "c2", ENTRY_PAGE_LIMIT],
    ]);
  });

  it("stops after the page bound", async () => {
    vi.mocked(listSessionEntryPage).mockImplementation(async (_trace, _session, cursor) =>
      page([Number(cursor ?? 0)], String(Number(cursor ?? 0) + 1)),
    );

    const { result } = renderHook(() => useSessionEntries("trace-1", "session", false));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listSessionEntryPage).toHaveBeenCalledTimes(ENTRY_PAGES_MAX);
    expect(result.current.entries).toHaveLength(ENTRY_PAGES_MAX);
  });

  it("reads from the cursor of the last page after 5 seconds and adds each entry once", async () => {
    vi.useFakeTimers();
    vi.mocked(listSessionEntryPage)
      .mockResolvedValueOnce(page([1, 2], "c1"))
      .mockResolvedValueOnce(page([3], null))
      .mockResolvedValueOnce(page([3, 4], "c3"))
      .mockResolvedValueOnce(page([5], null));

    const { result } = renderHook(() => useSessionEntries("trace-1", "session", true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(sequencesOf(result.current.entries)).toEqual([1, 2, 3]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(sequencesOf(result.current.entries)).toEqual([1, 2, 3, 4, 5]);
    expect(vi.mocked(listSessionEntryPage).mock.calls.slice(2)).toEqual([
      ["trace-1", "session", "c1", ENTRY_PAGE_LIMIT],
      ["trace-1", "session", "c3", ENTRY_PAGE_LIMIT],
    ]);
  });

  it("reads once when the trace is not live", async () => {
    vi.useFakeTimers();
    vi.mocked(listSessionEntryPage).mockResolvedValue(page([1], null));

    renderHook(() => useSessionEntries("trace-1", "session", false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(20_000);
    });

    expect(listSessionEntryPage).toHaveBeenCalledTimes(1);
  });

  it("keeps the entries that it read after a failure and retries from the failed page", async () => {
    vi.mocked(listSessionEntryPage)
      .mockResolvedValueOnce(page([1], "c1"))
      .mockRejectedValueOnce(new ApiError("unavailable", "Daemon down.", 503))
      .mockResolvedValueOnce(page([1], "c1"))
      .mockResolvedValueOnce(page([2], null));

    const { result } = renderHook(() => useSessionEntries("trace-1", "session", false));

    await waitFor(() => expect(result.current.error?.message).toBe("Daemon down."));
    expect(sequencesOf(result.current.entries)).toEqual([1]);

    act(() => result.current.retry());

    await waitFor(() => expect(result.current.error).toBeNull());
    expect(sequencesOf(result.current.entries)).toEqual([1, 2]);
    expect(vi.mocked(listSessionEntryPage).mock.calls[2]).toEqual([
      "trace-1",
      "session",
      null,
      ENTRY_PAGE_LIMIT,
    ]);
  });
});
