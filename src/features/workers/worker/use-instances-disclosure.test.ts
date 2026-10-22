import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Resource } from "@/hooks/use-resource";

import { useInstancesDisclosure } from "./use-instances-disclosure";

function resource(data: readonly string[] | null): Resource<readonly string[]> {
  return { data, error: null, loading: data === null, reload: () => undefined };
}

describe("useInstancesDisclosure", () => {
  it("collapses a worker with no instances until the human opens it", () => {
    const { result } = renderHook(() => useInstancesDisclosure(resource([])));

    expect(result.current).toMatchObject({ collapsible: true, open: false });
    act(() => result.current.setOpen(true));
    expect(result.current.open).toBe(true);
  });

  it("keeps the section open while instances exist", () => {
    const { result } = renderHook(() => useInstancesDisclosure(resource(["mac-studio"])));

    expect(result.current).toMatchObject({ collapsible: false, open: true });
    act(() => result.current.setOpen(false));
    expect(result.current.open).toBe(true);
  });

  it("keeps the section open while the first read runs", () => {
    const { result } = renderHook(() => useInstancesDisclosure(resource(null)));

    expect(result.current).toMatchObject({ collapsible: false, open: true });
  });

  it("opens the section when the first instance arrives", () => {
    const { result, rerender } = renderHook(({ data }) => useInstancesDisclosure(resource(data)), {
      initialProps: { data: [] as readonly string[] },
    });

    expect(result.current.open).toBe(false);
    rerender({ data: ["mac-studio"] });
    expect(result.current).toMatchObject({ collapsible: false, open: true });
  });
});
