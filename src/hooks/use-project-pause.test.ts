import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { pauseProject, resumeProject } from "@/api/resources/projects";
import type { Project } from "@/api/types";

import { useProjectPause } from "./use-project-pause";

vi.mock("@/api/resources/projects", () => ({ pauseProject: vi.fn(), resumeProject: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
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
});

describe("useProjectPause", () => {
  it("resumes a paused project, names it in a toast and reports the change", async () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => useProjectPause(project(5), onChanged));

    await act(async () => result.current.toggle());

    expect(resumeProject).toHaveBeenCalledWith("prj-1");
    expect(toast.success).toHaveBeenCalledWith("Resumed atlas.", {
      description: "Workers can claim its nodes.",
    });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("pauses an active project without a toast", async () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => useProjectPause(project(null), onChanged));

    await act(async () => result.current.toggle());

    expect(pauseProject).toHaveBeenCalledWith("prj-1");
    expect(toast.success).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("shows a toast with Retry when the call fails", async () => {
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
});
