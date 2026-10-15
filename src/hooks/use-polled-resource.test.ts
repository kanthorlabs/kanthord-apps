import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

import { usePolledResource } from "./use-polled-resource";

const INTERVAL = 15_000;

let visibility: DocumentVisibilityState = "visible";

function show(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event("visibilitychange"));
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function render(
  read: () => Promise<string>,
  options: { readonly hold?: boolean; readonly scope?: string } = {},
) {
  return renderHook(
    (props: { readonly hold: boolean; readonly scope: string }) =>
      usePolledResource(read, [props.scope], { intervalMs: INTERVAL, hold: props.hold }),
    { initialProps: { hold: options.hold ?? false, scope: options.scope ?? "one" } },
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  Reflect.deleteProperty(document, "visibilityState");
  vi.useRealTimers();
});

describe("usePolledResource", () => {
  it("reads at once and then at every interval", async () => {
    const read = vi.fn().mockResolvedValue("a");

    const view = render(read);
    await advance(0);

    expect(read).toHaveBeenCalledTimes(1);
    expect(view.result.current.data).toBe("a");
    expect(view.result.current.loading).toBe(false);

    await advance(INTERVAL);
    expect(read).toHaveBeenCalledTimes(2);
    await advance(INTERVAL);
    expect(read).toHaveBeenCalledTimes(3);
  });

  it("reads nothing while the tab is hidden", async () => {
    const read = vi.fn().mockResolvedValue("a");
    render(read);
    await advance(0);

    show("hidden");
    await advance(INTERVAL * 3);

    expect(read).toHaveBeenCalledTimes(1);
  });

  it("reads at once when the tab becomes visible", async () => {
    const read = vi.fn().mockResolvedValue("a");
    render(read);
    await advance(0);
    show("hidden");
    await advance(INTERVAL * 3);

    await act(async () => {
      show("visible");
    });

    expect(read).toHaveBeenCalledTimes(2);
  });

  it("reads on window focus only when the last read is older than 5 seconds", async () => {
    const read = vi.fn().mockResolvedValue("a");
    render(read);
    await advance(0);

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(read).toHaveBeenCalledTimes(1);

    await advance(5_000);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("starts no read while the previous read runs", async () => {
    let finish: (value: string) => void = () => {};
    const read = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    render(read);

    await advance(INTERVAL * 3);
    expect(read).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish("a");
    });
    await advance(INTERVAL);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("holds the cycle and reads at once when the hold ends", async () => {
    const read = vi.fn().mockResolvedValue("a");
    const view = render(read);
    await advance(0);

    view.rerender({ hold: true, scope: "one" });
    await advance(INTERVAL * 2);
    expect(read).toHaveBeenCalledTimes(1);

    view.rerender({ hold: false, scope: "one" });
    await advance(0);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("keeps the last good data and its time when a read fails", async () => {
    const failure = new ApiError("unavailable", "The daemon is down.", 503);
    const read = vi.fn().mockResolvedValueOnce("a").mockRejectedValueOnce(failure);
    const view = render(read);
    await advance(0);
    const updatedAt = view.result.current.updatedAt;

    await advance(INTERVAL);

    expect(view.result.current.data).toBe("a");
    expect(view.result.current.error).toBe(failure);
    expect(view.result.current.updatedAt).toBe(updatedAt);
    expect(view.result.current.loading).toBe(false);
  });

  it("clears the error at the next good read", async () => {
    const failure = new ApiError("unavailable", "The daemon is down.", 503);
    const read = vi.fn().mockRejectedValueOnce(failure).mockResolvedValueOnce("b");
    const view = render(read);
    await advance(0);
    expect(view.result.current.error).toBe(failure);
    expect(view.result.current.data).toBeNull();

    await advance(INTERVAL);

    expect(view.result.current.error).toBeNull();
    expect(view.result.current.data).toBe("b");
  });

  it("refreshes at once and reads again after a running read", async () => {
    let finish: (value: string) => void = () => {};
    const read = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(read);

    act(() => view.result.current.refresh());
    expect(read).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish("a");
    });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("drops the data of the previous scope", async () => {
    const read = vi.fn().mockResolvedValueOnce("a").mockResolvedValueOnce("b");
    const view = render(read);
    await advance(0);
    expect(view.result.current.data).toBe("a");

    view.rerender({ hold: false, scope: "two" });
    expect(view.result.current.data).toBeNull();
    expect(view.result.current.loading).toBe(true);

    await advance(0);
    expect(view.result.current.data).toBe("b");
  });

  it("starts no read after unmount, also when a read was running", async () => {
    let finish: (value: string) => void = () => {};
    const read = vi.fn().mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(read);
    expect(read).toHaveBeenCalledTimes(1);

    view.unmount();
    await advance(INTERVAL * 3);
    show("hidden");
    show("visible");
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      finish("a");
    });
    await advance(INTERVAL * 3);

    expect(read).toHaveBeenCalledTimes(1);
  });
});
