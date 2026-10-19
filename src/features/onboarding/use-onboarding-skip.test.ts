import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useOnboardingSkip } from "./use-onboarding-skip";

const SKIP_KEY = "kanthord.onboarding.skipped";

function denyStorage() {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new DOMException("The storage is blocked.", "SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new DOMException("The storage is blocked.", "SecurityError");
  });
}

describe("useOnboardingSkip", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts without a skip mark", () => {
    const { result } = renderHook(() => useOnboardingSkip());

    expect(result.current.skipped).toBe(false);
  });

  it("sets the skip mark of the browser", () => {
    const { result } = renderHook(() => useOnboardingSkip());

    act(() => result.current.skip());

    expect(result.current.skipped).toBe(true);
    expect(window.localStorage.getItem(SKIP_KEY)).not.toBeNull();
    expect(renderHook(() => useOnboardingSkip()).result.current.skipped).toBe(true);
  });

  it("clears the skip mark on resume", () => {
    window.localStorage.setItem(SKIP_KEY, "1");
    const { result } = renderHook(() => useOnboardingSkip());
    expect(result.current.skipped).toBe(true);

    act(() => result.current.resume());

    expect(result.current.skipped).toBe(false);
    expect(window.localStorage.getItem(SKIP_KEY)).toBeNull();
  });

  it("keeps Onboarding when the storage throws on the read", () => {
    window.localStorage.setItem(SKIP_KEY, "1");
    denyStorage();

    const { result } = renderHook(() => useOnboardingSkip());

    expect(result.current.skipped).toBe(false);
  });

  it("skips for the current page when the storage throws on the write", () => {
    denyStorage();
    const { result } = renderHook(() => useOnboardingSkip());

    act(() => result.current.skip());

    expect(result.current.skipped).toBe(true);
  });
});
