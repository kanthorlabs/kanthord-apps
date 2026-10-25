import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStickyOffset } from "./use-sticky-offset";

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  disconnected = false;
  constructor(private readonly callback: () => void) {
    FakeResizeObserver.instances.push(this);
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
  trigger() {
    this.callback();
  }
}

function Probe() {
  const ref = useStickyOffset();
  return (
    <div>
      <div ref={ref}>Sticky</div>
    </div>
  );
}

beforeEach(() => {
  FakeResizeObserver.instances = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(120);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useStickyOffset", () => {
  it("writes the height of the sticky block into its parent and clears it on unmount", () => {
    const { container, unmount } = render(<Probe />);
    const scope = container.firstElementChild as HTMLElement;
    expect(scope.style.getPropertyValue("--trace-sticky-height")).toBe("120px");

    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(160);
    FakeResizeObserver.instances[0]?.trigger();
    expect(scope.style.getPropertyValue("--trace-sticky-height")).toBe("160px");

    unmount();
    expect(FakeResizeObserver.instances[0]?.disconnected).toBe(true);
  });
});
