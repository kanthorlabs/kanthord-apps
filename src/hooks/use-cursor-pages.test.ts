import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import type { Page } from "@/api/types";
import { useCursorPages } from "./use-cursor-pages";

interface Deferred {
  readonly promise: Promise<Page<string>>;
  readonly resolve: (page: Page<string>) => void;
  readonly reject: (cause: unknown) => void;
}

function deferred(): Deferred {
  let resolve: (page: Page<string>) => void = () => undefined;
  let reject: (cause: unknown) => void = () => undefined;
  const promise = new Promise<Page<string>>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const PAGES: Record<string, Page<string>> = {
  first: { items: ["a", "b"], nextCursor: "c-1" },
  "c-1": { items: ["c", "d"], nextCursor: "c-2" },
  "c-2": { items: ["e"], nextCursor: null },
};

function pagesOf(cursor: string | null): Promise<Page<string>> {
  const page = PAGES[cursor ?? "first"];
  return page === undefined ? Promise.reject(new Error("unknown cursor")) : Promise.resolve(page);
}

describe("useCursorPages", () => {
  it("commits the first page and reports the edges", async () => {
    const { result } = renderHook(() => useCursorPages(pagesOf, ["p-1"]));

    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.items).toEqual(["a", "b"]);
    expect(result.current.hasPrevious).toBe(false);
    expect(result.current.hasNext).toBe(true);
    expect(result.current.position).toBe(0);
  });

  it("moves forward and back with the cursor stack", async () => {
    const read = vi.fn(pagesOf);
    const { result } = renderHook(() => useCursorPages(read, ["p-1"]));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.next());
    await waitFor(() => expect(result.current.items).toEqual(["c", "d"]));
    act(() => result.current.next());
    await waitFor(() => expect(result.current.items).toEqual(["e"]));
    expect(result.current.hasNext).toBe(false);

    act(() => result.current.previous());
    await waitFor(() => expect(result.current.items).toEqual(["c", "d"]));
    expect(result.current.hasPrevious).toBe(true);
    expect(result.current.position).toBe(3);
    expect(read.mock.calls.map(([cursor]) => cursor)).toEqual([null, "c-1", "c-2", "c-1"]);
  });

  it("keeps the committed page when Next fails and retries the failed target", async () => {
    const failure = new ApiError("unavailable", "The daemon is unavailable.", 503);
    const read = vi
      .fn(pagesOf)
      .mockImplementationOnce(pagesOf)
      .mockImplementationOnce(() => Promise.reject(failure));
    const { result } = renderHook(() => useCursorPages(read, ["p-1"]));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.next());
    await waitFor(() => expect(result.current.error).toBe(failure));
    expect(result.current.items).toEqual(["a", "b"]);
    expect(result.current.hasPrevious).toBe(false);
    expect(result.current.position).toBe(0);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.items).toEqual(["c", "d"]));
    expect(result.current.error).toBeNull();
    expect(read).toHaveBeenLastCalledWith("c-1");
  });

  it("reports an error status when the first page fails", async () => {
    const read = vi.fn(() => Promise.reject(new Error("socket closed")));
    const { result } = renderHook(() => useCursorPages(read, ["p-1"]));

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error?.code).toBe("malformed");
  });

  it("clears the committed page and discards a stale answer when the scope changes", async () => {
    const atlasNext = deferred();
    const read = vi.fn((cursor: string | null) =>
      cursor === "c-1" ? atlasNext.promise : pagesOf(cursor),
    );
    const { result, rerender } = renderHook(({ scope }) => useCursorPages(read, [scope]), {
      initialProps: { scope: "atlas" },
    });
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.next());
    rerender({ scope: "boreal" });
    expect(result.current.status).toBe("loading");
    expect(result.current.items).toEqual([]);
    await waitFor(() => expect(result.current.status).toBe("ready"));

    await act(async () => atlasNext.resolve({ items: ["stale"], nextCursor: null }));
    expect(result.current.items).toEqual(["a", "b"]);
    expect(result.current.hasPrevious).toBe(false);
  });

  it("lets a reload supersede a pending Next and re-read the committed cursor", async () => {
    const pendingNext = deferred();
    const read = vi.fn((cursor: string | null) =>
      cursor === "c-1" ? pendingNext.promise : pagesOf(cursor),
    );
    const { result } = renderHook(() => useCursorPages(read, ["p-1"]));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => result.current.next());
    expect(result.current.pending).toBe(true);
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.pending).toBe(false));

    await act(async () => pendingNext.resolve({ items: ["late"], nextCursor: null }));
    expect(result.current.items).toEqual(["a", "b"]);
    expect(result.current.position).toBe(0);
    expect(read).toHaveBeenLastCalledWith(null);
  });

  it("ignores Next while a transition is pending", async () => {
    const pendingNext = deferred();
    const read = vi.fn((cursor: string | null) =>
      cursor === "c-1" ? pendingNext.promise : pagesOf(cursor),
    );
    const { result } = renderHook(() => useCursorPages(read, ["p-1"]));
    await waitFor(() => expect(result.current.status).toBe("ready"));

    act(() => {
      result.current.next();
      result.current.next();
    });

    expect(read).toHaveBeenCalledTimes(2);
    await act(async () => pendingNext.resolve(PAGES["c-1"] ?? { items: [], nextCursor: null }));
  });
});
