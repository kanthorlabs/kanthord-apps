import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BOARD_WIDTH } from "@/lib/board-width";

import { useBoardWidth } from "./use-board-width";

type Callback = (entries: readonly { contentRect: { width: number } }[]) => void;

const observers: FakeResizeObserver[] = [];

class FakeResizeObserver {
  readonly observed: Element[] = [];
  disconnected = false;

  constructor(private readonly callback: Callback) {
    observers.push(this);
  }

  observe(element: Element) {
    this.observed.push(element);
  }

  unobserve() {}

  disconnect() {
    this.disconnected = true;
  }

  measure(width: number) {
    this.callback([{ contentRect: { width } }]);
  }
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function render() {
  const element = document.createElement("div");
  const view = renderHook(() => useBoardWidth({ current: element }));
  return { view, element, observer: observers[0] as FakeResizeObserver };
}

describe("useBoardWidth", () => {
  it("answers expanded before the first measure", () => {
    const { view, element, observer } = render();

    expect(view.result.current).toBe(BOARD_WIDTH.Expanded);
    expect(observer.observed).toEqual([element]);
  });

  it.each([
    [599, BOARD_WIDTH.Compact],
    [600, BOARD_WIDTH.Medium],
    [959, BOARD_WIDTH.Medium],
    [960, BOARD_WIDTH.Expanded],
  ])("answers the class of %i px", (width, expected) => {
    const { view, observer } = render();

    act(() => observer.measure(100));
    act(() => observer.measure(width));

    expect(view.result.current).toBe(expected);
  });

  it("follows a later measure", () => {
    const { view, observer } = render();

    act(() => observer.measure(400));
    expect(view.result.current).toBe(BOARD_WIDTH.Compact);
    act(() => observer.measure(1200));

    expect(view.result.current).toBe(BOARD_WIDTH.Expanded);
  });

  it("stops observing on unmount", () => {
    const { view, observer } = render();

    view.unmount();

    expect(observer.disconnected).toBe(true);
  });

  it("observes nothing without an element", () => {
    renderHook(() => useBoardWidth({ current: null }));

    expect(observers).toHaveLength(0);
  });
});
