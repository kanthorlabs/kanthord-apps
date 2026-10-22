import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";
import { toast } from "sonner";

import { archiveWorkerInstance, readWorkerInstance } from "@/api/resources/worker-instances";
import type { WorkerInstance, WorkerInstanceDetail } from "@/api/types";
import { archiveBlockOf, useInstanceArchive, type ArchiveSubject } from "./use-instance-archive";

vi.mock("@/api/resources/worker-instances", () => ({
  archiveWorkerInstance: vi.fn(),
  readWorkerInstance: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const FREE: ArchiveSubject = {
  name: "mac-studio",
  revision: 2,
  bindingCount: 0,
  liveExecutions: [],
};

const DETAIL: WorkerInstanceDetail = {
  id: "worker_instance_1",
  name: "mac-studio",
  worker: "coder@1",
  revision: 3,
  public_key: "k",
  fingerprint: "f",
  created_at: 0,
  ended_at: null,
  connection: null,
  bindings: [],
  registrations: [],
  credentials: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readWorkerInstance).mockResolvedValue(DETAIL);
});

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
    const { result } = renderHook(() =>
      useInstanceArchive({ ...FREE, bindingCount: 1 }, vi.fn(), vi.fn(), { current: null }),
    );
    act(() => result.current.request());
    expect(result.current.open).toBe(false);
  });

  it("archives at the revision that it reads again and calls onArchived", async () => {
    vi.mocked(archiveWorkerInstance).mockResolvedValue({} as WorkerInstance);
    const onArchived = vi.fn();
    const { result } = renderHook(() =>
      useInstanceArchive(FREE, onArchived, vi.fn(), { current: null }),
    );
    act(() => result.current.request());
    await waitFor(() => expect(result.current.open).toBe(true));
    expect(readWorkerInstance).toHaveBeenCalledWith("mac-studio");
    act(() => result.current.confirm());
    await waitFor(() => expect(onArchived).toHaveBeenCalled());
    expect(archiveWorkerInstance).toHaveBeenCalledWith("mac-studio", 3);
    expect(result.current.open).toBe(false);
  });

  it("opens no dialog when the read again shows a listing binding", async () => {
    vi.mocked(readWorkerInstance).mockResolvedValue({
      ...DETAIL,
      bindings: [{ project_id: "prj-a", binding: "mac-main" }],
    });
    const onStale = vi.fn();
    const { result } = renderHook(() =>
      useInstanceArchive(FREE, vi.fn(), onStale, { current: null }),
    );
    act(() => result.current.request());
    await waitFor(() => expect(onStale).toHaveBeenCalled());
    expect(result.current.open).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("mac-studio was not archived.", {
      description: expect.anything(),
    });
    const notice = vi.mocked(toast.error).mock.calls[0]![1]!.description as ReactNode;
    const { container } = render(<p>{notice}</p>);
    expect(container.textContent).toBe(
      "A binding lists mac-studio. Detach mac-studio from each listing binding first.",
    );
    expect(screen.getAllByText("mac-studio", { selector: "strong" })).toHaveLength(2);
    expect(archiveWorkerInstance).not.toHaveBeenCalled();
  });
});
