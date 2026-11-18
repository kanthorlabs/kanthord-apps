import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNow } from "./use-now";

const START = Date.UTC(2026, 4, 2, 10, 30);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNow", () => {
  it("advances every second while active", () => {
    const { result } = renderHook(() => useNow(true));

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current).toBe(START + 3000);
  });

  it("holds the time while inactive", () => {
    const { result } = renderHook(() => useNow(false));

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current).toBe(START);
  });

  it("advances at the tick that the caller gives", () => {
    const { result } = renderHook(() => useNow(true, 60_000));

    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(result.current).toBe(START);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(START + 60_000);
  });
});
