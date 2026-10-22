import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { archiveWorkerInstance } from "@/api/resources/worker-instances";
import type { WorkerInstance } from "@/api/types";
import { archiveBlockOf, useInstanceArchive, type ArchiveSubject } from "./use-instance-archive";

vi.mock("@/api/resources/worker-instances", () => ({ archiveWorkerInstance: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const FREE: ArchiveSubject = {
  name: "mac-studio",
  revision: 2,
  bindingCount: 0,
  liveExecutions: [],
};

beforeEach(() => vi.clearAllMocks());

describe("archiveBlockOf", () => {
  it("names the detach while a binding lists the instance", () => {
    expect(archiveBlockOf({ ...FREE, bindingCount: 2 })).toBe(
      "A binding lists mac-studio. Detach mac-studio from each listing binding first.",
    );
  });

  it("waits for a live execution", () => {
    expect(archiveBlockOf({ ...FREE, liveExecutions: ["exec_1"] })).toBe(
      "A registration of mac-studio holds a live execution. Wait until the execution ends.",
    );
  });

  it("answers null for a free instance", () => {
    expect(archiveBlockOf(FREE)).toBeNull();
  });
});

describe("useInstanceArchive", () => {
  it("opens no dialog for a blocked instance", () => {
    const { result } = renderHook(() => useInstanceArchive({ ...FREE, bindingCount: 1 }, vi.fn()));
    act(() => result.current.request());
    expect(result.current.open).toBe(false);
  });

  it("archives at the expected revision and calls onArchived", async () => {
    vi.mocked(archiveWorkerInstance).mockResolvedValue({} as WorkerInstance);
    const onArchived = vi.fn();
    const { result } = renderHook(() => useInstanceArchive(FREE, onArchived));
    act(() => result.current.request());
    expect(result.current.open).toBe(true);
    act(() => result.current.confirm());
    await waitFor(() => expect(onArchived).toHaveBeenCalled());
    expect(archiveWorkerInstance).toHaveBeenCalledWith("mac-studio", 2);
    expect(result.current.open).toBe(false);
  });
});
