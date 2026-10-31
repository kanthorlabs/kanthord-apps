import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import { useScrollToEnd } from "./use-scroll-to-end";

let scrollTo: MockInstance<Window["scrollTo"]>;

beforeEach(() => {
  scrollTo = vi.spyOn(window, "scrollTo");
  vi.spyOn(document.documentElement, "scrollHeight", "get").mockReturnValue(840);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useScrollToEnd", () => {
  it("scrolls to the end of the document on mount", () => {
    renderHook(() => useScrollToEnd([], null));

    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 840 });
  });

  it("scrolls to the end again when the items or the approval change", () => {
    const items = ["first"];
    const { rerender } = renderHook(({ items, approval }) => useScrollToEnd(items, approval), {
      initialProps: { items, approval: null as unknown },
    });
    scrollTo.mockClear();

    const nextItems = ["first", "second"];
    rerender({ items: nextItems, approval: null });
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 840 });

    rerender({ items: nextItems, approval: { id: "approval-1" } });
    expect(scrollTo).toHaveBeenCalledTimes(2);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 840 });
  });

  it("does not scroll again when the items and the approval keep their identity", () => {
    const items = ["first"];
    const approval = { id: "approval-1" };
    const { rerender } = renderHook(({ items, approval }) => useScrollToEnd(items, approval), {
      initialProps: { items, approval },
    });
    scrollTo.mockClear();

    rerender({ items, approval });

    expect(scrollTo).not.toHaveBeenCalled();
  });
});
