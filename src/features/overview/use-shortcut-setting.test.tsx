import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useShortcutSetting } from "./use-shortcut-setting";

const KEY = "kd-board-shortcuts";

afterEach(() => {
  vi.restoreAllMocks();
  const { result } = renderHook(() => useShortcutSetting());
  act(() => result.current.setEnabled(true));
});

function Reader() {
  const { enabled } = useShortcutSetting();
  return <p>{enabled ? "shortcuts on" : "shortcuts off"}</p>;
}

describe("useShortcutSetting", () => {
  it("is on by default", () => {
    const { result } = renderHook(() => useShortcutSetting());

    expect(result.current.enabled).toBe(true);
  });

  it("stores off and on under kd-board-shortcuts", () => {
    const { result } = renderHook(() => useShortcutSetting());

    act(() => result.current.setEnabled(false));
    expect(window.localStorage.getItem(KEY)).toBe("off");
    expect(result.current.enabled).toBe(false);

    act(() => result.current.setEnabled(true));
    expect(window.localStorage.getItem(KEY)).toBe("on");
    expect(result.current.enabled).toBe(true);
  });

  it("reads the stored value after a reload", () => {
    window.localStorage.setItem(KEY, "off");

    const { result } = renderHook(() => useShortcutSetting());

    expect(result.current.enabled).toBe(false);
  });

  it("answers on for a failed read", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const { result } = renderHook(() => useShortcutSetting());

    expect(result.current.enabled).toBe(true);
  });

  it("keeps the value for the page after a failed write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    const { result } = renderHook(() => useShortcutSetting());

    act(() => result.current.setEnabled(false));

    expect(result.current.enabled).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it("shares the value between two components", () => {
    const { result } = renderHook(() => useShortcutSetting());
    render(<Reader />);

    act(() => result.current.setEnabled(false));

    expect(screen.getByText("shortcuts off")).toBeInTheDocument();
  });
});
