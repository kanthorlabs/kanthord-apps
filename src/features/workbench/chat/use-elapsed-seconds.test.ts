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
    const { result, rerender } = renderHook(({ active }) => useElapsedSeconds(active), {
      initialProps: { active: true },
    });
    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current).toBe(3);

    rerender({ active: false });
    expect(result.current).toBe(0);
    rerender({ active: true });
    expect(result.current).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(1);
  });
});
