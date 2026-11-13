import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useElapsedSeconds } from "./use-elapsed-seconds";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useElapsedSeconds", () => {
  it("counts the seconds of an active run and restarts from zero for the next run", () => {
    const { result, rerender } = renderHook(
      ({ active, runKey }) => useElapsedSeconds(active, runKey),
      {
        initialProps: { active: true, runKey: "u1" },
      },
    );
    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(3);

    rerender({ active: false, runKey: "u1" });
    expect(result.current).toBe(0);
    rerender({ active: true, runKey: "u1" });
    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(1);
  });

  it("restarts from zero when the next run starts with no idle state between", () => {
    const { result, rerender } = renderHook(
      ({ active, runKey }) => useElapsedSeconds(active, runKey),
      {
        initialProps: { active: true, runKey: "u1" },
      },
    );
    act(() => {
      vi.advanceTimersByTime(85000);
    });
    expect(result.current).toBe(85);

    rerender({ active: true, runKey: "u2" });
    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(2);
  });
});
