import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/mission", () => ({
  readMissionNode: vi.fn(),
}));

import { ApiError } from "@/api/errors";
import { readMissionNode } from "@/api/resources/mission";
import type { MissionNodeRecord } from "@/api/types";

import { useNodeNames } from "./use-node-names";

function record(name: string): MissionNodeRecord {
  return { content: { name } } as MissionNodeRecord;
}

beforeEach(() => {
  vi.mocked(readMissionNode).mockReset();
  vi.mocked(readMissionNode).mockImplementation((id: string) =>
    Promise.resolve(record(`name of ${id}`)),
  );
});

describe("useNodeNames", () => {
  it("reads only the new id on a second call", async () => {
    const { result, rerender } = renderHook(({ ids }) => useNodeNames(ids), {
      initialProps: { ids: ["node-1", "node-2"] },
    });
    await waitFor(() => expect(result.current.size).toBe(2));

    rerender({ ids: ["node-2", "node-3"] });

    await waitFor(() => expect(result.current.get("node-3")).toBe("name of node-3"));
    expect(vi.mocked(readMissionNode).mock.calls.map(([id]) => id)).toEqual([
      "node-1",
      "node-2",
      "node-3",
    ]);
    expect(result.current.get("node-1")).toBe("name of node-1");
  });

  it("reads a repeated id once", async () => {
    const { result, rerender } = renderHook(({ ids }) => useNodeNames(ids), {
      initialProps: { ids: ["node-1", "node-1"] },
    });
    await waitFor(() => expect(result.current.size).toBe(1));

    rerender({ ids: ["node-2"] });
    await waitFor(() => expect(result.current.size).toBe(2));
    rerender({ ids: ["node-1"] });

    expect(readMissionNode).toHaveBeenCalledTimes(2);
  });

  it("does not read a pending id again", async () => {
    vi.mocked(readMissionNode).mockImplementation(() => new Promise(() => undefined));
    const { rerender } = renderHook(({ ids }) => useNodeNames(ids), {
      initialProps: { ids: ["node-1"] },
    });

    rerender({ ids: ["node-2", "node-1"] });

    await waitFor(() => expect(readMissionNode).toHaveBeenCalledTimes(2));
  });

  it("does not read a failed id again", async () => {
    vi.mocked(readMissionNode).mockImplementation((id: string) =>
      id === "node-1"
        ? Promise.reject(new ApiError("not_found", "No node.", 404))
        : Promise.resolve(record(`name of ${id}`)),
    );
    const { result, rerender } = renderHook(({ ids }) => useNodeNames(ids), {
      initialProps: { ids: ["node-1"] },
    });
    await waitFor(() => expect(readMissionNode).toHaveBeenCalledTimes(1));

    rerender({ ids: ["node-1", "node-2"] });
    await waitFor(() => expect(result.current.get("node-2")).toBe("name of node-2"));
    rerender({ ids: ["node-1"] });

    expect(readMissionNode).toHaveBeenCalledTimes(2);
    expect(result.current.has("node-1")).toBe(false);
  });
});
