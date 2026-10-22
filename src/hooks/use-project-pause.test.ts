import { act, renderHook } from "@testing-library/react";
import { toast, type Action } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { pauseProject, readProject, resumeProject } from "@/api/resources/projects";
import type { Project } from "@/api/types";

import { useProjectPause } from "./use-project-pause";

vi.mock("@/api/resources/projects", () => ({
  pauseProject: vi.fn(),
  readProject: vi.fn(),
  resumeProject: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

function project(pausedAt: number | null): Project {
  return {
    id: "prj-1",
    name: "atlas",
    binding_set_version: 1,
    created_at: 1,
    paused_at: pausedAt,
    workspace_directory: "/state/prj-1",
  };
}

beforeEach(() => {
  vi.mocked(pauseProject).mockReset().mockResolvedValue(project(5));
  vi.mocked(resumeProject).mockReset().mockResolvedValue(project(null));
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  vi.mocked(toast.info).mockReset();
});

describe("useProjectPause", () => {
  it("resumes a paused project, names it in a toast and reports the change", async () => {
    const onChanged = vi.fn();
    vi.mocked(readProject).mockReset().mockResolvedValue(project(5));
    const { result } = renderHook(() => useProjectPause(project(5), onChanged));

    await act(async () => result.current.toggle());

    expect(readProject).toHaveBeenCalledWith("prj-1");
    expect(resumeProject).toHaveBeenCalledWith("prj-1");
    expect(toast.success).toHaveBeenCalledWith("Resumed atlas.", {
      description: "Workers can claim its nodes.",
    });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("asks for a confirmation before a pause and reads nothing yet", async () => {
    vi.mocked(readProject).mockReset().mockResolvedValue(project(null));
    const { result } = renderHook(() => useProjectPause(project(null), vi.fn()));

    await act(async () => result.current.toggle());

    expect(result.current.confirming).toBe(true);
    expect(readProject).not.toHaveBeenCalled();
    expect(pauseProject).not.toHaveBeenCalled();
  });

  it("writes nothing when the pause is cancelled", async () => {
    vi.mocked(readProject).mockReset().mockResolvedValue(project(null));
    const onChanged = vi.fn();
    const { result } = renderHook(() => useProjectPause(project(null), onChanged));

    await act(async () => result.current.toggle());
    await act(async () => result.current.cancel());

    expect(result.current.confirming).toBe(false);
    expect(readProject).not.toHaveBeenCalled();
    expect(pauseProject).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("reads the project again on the confirmation, pauses it and names it in a toast", async () => {
    vi.mocked(readProject).mockReset().mockResolvedValue(project(null));
    const onChanged = vi.fn();
    const { result } = renderHook(() => useProjectPause(project(null), onChanged));

    await act(async () => result.current.toggle());
    await act(async () => result.current.confirm());

    expect(readProject).toHaveBeenCalledWith("prj-1");
    expect(pauseProject).toHaveBeenCalledWith("prj-1");
    expect(toast.success).toHaveBeenCalledWith("Paused atlas.", {
      description: "No worker claims a node of it until a resume.",
    });
    expect(result.current.confirming).toBe(false);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("writes nothing on the confirmation when another actor already paused the project", async () => {
    vi.mocked(readProject).mockReset().mockResolvedValue(project(5));
    const onChanged = vi.fn();
    const { result } = renderHook(() => useProjectPause(project(null), onChanged));

    await act(async () => result.current.toggle());
    await act(async () => result.current.confirm());

    expect(pauseProject).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith("atlas did not change.", {
      description: "atlas is already paused. The view now shows its current state.",
    });
    expect(result.current.confirming).toBe(false);
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("shows a toast with Retry when the call fails", async () => {
    vi.mocked(readProject).mockReset().mockResolvedValue(project(5));
    vi.mocked(resumeProject).mockRejectedValue(new ApiError("unreachable", "No answer.", 0));
    const onChanged = vi.fn();
    const { result } = renderHook(() => useProjectPause(project(5), onChanged));

    await act(async () => result.current.toggle());

    expect(toast.error).toHaveBeenCalledWith("Resuming the project failed.", {
      description: "No answer.",
      action: { label: "Retry", onClick: expect.any(Function) },
    });
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("reads the project again before the Retry of a failed write", async () => {
    vi.mocked(readProject).mockReset().mockResolvedValue(project(5));
    vi.mocked(resumeProject)
      .mockReset()
      .mockRejectedValue(new ApiError("unreachable", "No answer.", 0));
    const { result } = renderHook(() => useProjectPause(project(5), vi.fn()));

    await act(async () => result.current.toggle());
    const retry = vi.mocked(toast.error).mock.calls[0]![1]!.action as Action;
    vi.mocked(readProject).mockResolvedValue(project(null));
    await act(async () => retry.onClick({} as Parameters<Action["onClick"]>[0]));

    expect(readProject).toHaveBeenCalledTimes(2);
    expect(resumeProject).toHaveBeenCalledTimes(1);
  });

  it("writes nothing and reports the change when another actor already resumed the project", async () => {
    vi.mocked(readProject).mockReset().mockResolvedValue(project(null));
    const onChanged = vi.fn();
    const { result } = renderHook(() => useProjectPause(project(5), onChanged));

    await act(async () => result.current.toggle());

    expect(resumeProject).not.toHaveBeenCalled();
    expect(pauseProject).not.toHaveBeenCalled();
    expect(toast.info).toHaveBeenCalledWith("atlas did not change.", {
      description: "atlas is already active. The view now shows its current state.",
    });
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(result.current.busy).toBe(false);
  });

  it("writes nothing when the project cannot be read again", async () => {
    vi.mocked(readProject)
      .mockReset()
      .mockRejectedValue(new ApiError("unreachable", "No answer.", 0));
    const onChanged = vi.fn();
    const { result } = renderHook(() => useProjectPause(project(null), onChanged));

    await act(async () => result.current.toggle());
    await act(async () => result.current.confirm());

    expect(pauseProject).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith("atlas was not read.", {
      description: "No answer.",
      action: { label: "Retry", onClick: expect.any(Function) },
    });
    expect(onChanged).not.toHaveBeenCalled();
  });
});
