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
});
