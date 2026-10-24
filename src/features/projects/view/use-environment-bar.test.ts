import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EnvironmentState, EnvironmentStatus } from "@/api/types";

import { useEnvironmentBar } from "./use-environment-bar";

function state(status: EnvironmentStatus, bindingId = "binding_1"): EnvironmentState {
  return {
    binding_id: bindingId,
    binding_name: bindingId === "binding_1" ? "engine" : "worker",
    resource_identity: "resource_1",
    target: "image",
    source: "repository",
    status,
    digest: null,
    tag: null,
    run_started_at: 1_000,
    step_started_at: 1_000,
    reason: null,
    reason_started_at: null,
    failure: null,
    checks: [],
    repairs: 0,
    repairing: false,
  };
}

function render(initial: readonly EnvironmentState[] | null) {
  return renderHook(
    (props: { readonly states: readonly EnvironmentState[] | null }) =>
      useEnvironmentBar(props.states),
    { initialProps: { states: initial } },
  );
}

describe("useEnvironmentBar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers null before the first read", () => {
    const { result } = render(null);

    expect(result.current).toBeNull();
  });

  it("answers the shown state with the count of the others", () => {
    const { result } = render([state("building"), state("pending", "binding_2")]);

    expect(result.current?.state.status).toBe("building");
    expect(result.current?.more).toBe(1);
    expect(result.current?.ready).toBe(false);
  });

  it("gives no bar to states that open with every status ready", () => {
    const { result, rerender } = render([state("ready"), state("none", "binding_2")]);

    expect(result.current).toBeNull();
    rerender({ states: [state("ready"), state("none", "binding_2")] });
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(result.current).toBeNull();
  });

  it("shows Ready for 10 seconds after building ends, then hides", () => {
    const { result, rerender } = render([state("building")]);

    rerender({ states: [state("ready")] });

    expect(result.current?.ready).toBe(true);
    expect(result.current?.state.binding_name).toBe("engine");
    expect(result.current?.state.status).toBe("ready");
    expect(result.current?.more).toBe(0);
    act(() => {
      vi.advanceTimersByTime(9_999);
    });
    expect(result.current?.ready).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBeNull();
  });

  it("keeps the hide time through a poll that changes nothing", () => {
    const { result, rerender } = render([state("building")]);
    rerender({ states: [state("ready")] });
    act(() => {
      vi.advanceTimersByTime(6_000);
    });

    rerender({ states: [state("ready")] });
    act(() => {
      vi.advanceTimersByTime(4_000);
    });

    expect(result.current).toBeNull();
  });

  it("shows Ready for 10 seconds after a failed state becomes ready", () => {
    const { result, rerender } = render([state("failed")]);
    expect(result.current?.state.status).toBe("failed");

    rerender({ states: [state("ready")] });

    expect(result.current?.ready).toBe(true);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBeNull();
  });

  it("restarts the display when a new state shows after the Ready display ended", () => {
    const { result, rerender } = render([state("building")]);
    rerender({ states: [state("ready")] });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current).toBeNull();

    rerender({ states: [state("pending")] });
    expect(result.current?.ready).toBe(false);
    rerender({ states: [state("ready")] });

    expect(result.current?.ready).toBe(true);
  });

  it("cancels the timer when a new state shows during the Ready display", () => {
    const { result, rerender } = render([state("building")]);
    rerender({ states: [state("ready")] });
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    rerender({ states: [state("building")] });
    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current?.state.status).toBe("building");
    expect(result.current?.ready).toBe(false);
  });

  it("clears the timer on unmount", () => {
    const { rerender, unmount } = render([state("building")]);
    rerender({ states: [state("ready")] });

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
