import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { exportMissionJson, readMission } from "@/api/resources/mission";
import { readBindingSet, writeBindingSet } from "@/api/resources/projects";
import type { BindingSet } from "@/api/types";
import { useBindingRemove } from "./use-binding-remove";

vi.mock("@/api/resources/projects", () => ({
  readBindingSet: vi.fn(),
  writeBindingSet: vi.fn(),
}));
vi.mock("@/api/resources/mission", () => ({ readMission: vi.fn(), exportMissionJson: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const SET: BindingSet = {
  version: 3,
  bindings: {
    "mac-main": {
      kind: "worker",
      config: { worker: "coder@1", placement: "worker", worker_instances: ["mac-studio"] },
    },
    evidence: {
      kind: "storage",
      config: {
        available: true,
        endpoint: "https://s3.example.com",
        bucket: "b",
        region: "r",
        prefix: "",
        credential: "c",
      },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readBindingSet).mockResolvedValue(SET);
  vi.mocked(writeBindingSet).mockResolvedValue({
    project_id: "prj-a",
    binding_set_version: 4,
    changes: [],
  });
  vi.mocked(readMission).mockResolvedValue({ id: "m", project_id: "prj-a", version: 1 });
  vi.mocked(exportMissionJson).mockResolvedValue({
    mission_id: "m",
    entries: [],
  } as unknown as Awaited<ReturnType<typeof exportMissionJson>>);
});

async function opened(onChanged = vi.fn()) {
  const hook = renderHook(() => useBindingRemove("prj-a", "mac-main", onChanged));
  act(() => hook.result.current.request());
  await waitFor(() => expect(hook.result.current.guard.change).not.toBeNull());
  return hook;
}

describe("useBindingRemove", () => {
  it("opens the same guard as the bindings tab before any write", async () => {
    const { result } = await opened();
    expect(result.current.guard.change?.kind).toBe("remove");
    expect(result.current.guard.confirmLabel).toBe("Remove binding");
    expect(result.current.guard.saferLabel).toBe("Make unavailable instead");
    await waitFor(() => expect(result.current.guard.nodes).toEqual([]));
    expect(writeBindingSet).not.toHaveBeenCalled();
  });

  it("removes the binding at the version it read", async () => {
    const onChanged = vi.fn();
    const { result } = await opened(onChanged);
    act(() => result.current.confirm());
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(writeBindingSet).toHaveBeenCalledWith("prj-a", 3, { evidence: SET.bindings.evidence });
    expect(toast.success).toHaveBeenCalledWith("Removed mac-main.");
    expect(result.current.guard.change).toBeNull();
  });

  it("takes the safer path and makes the binding unavailable", async () => {
    const { result } = await opened();
    act(() => result.current.takeSaferPath());
    await waitFor(() => expect(writeBindingSet).toHaveBeenCalled());
    expect(writeBindingSet).toHaveBeenCalledWith("prj-a", 3, {
      ...SET.bindings,
      "mac-main": {
        kind: "worker",
        config: { worker: "coder@1", placement: "worker", worker_instances: [] },
      },
    });
  });

  it("closes the guard and reloads on a version conflict", async () => {
    vi.mocked(writeBindingSet).mockRejectedValue(
      new ApiError("conflict", "conflict", 409, "project.binding_set.version_conflict"),
    );
    const onChanged = vi.fn();
    const { result } = await opened(onChanged);
    act(() => result.current.confirm());
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(
      "Someone else saved the binding set.",
      expect.anything(),
    );
    expect(result.current.guard.change).toBeNull();
  });

  it("keeps the guard open and shows the ApiError message on another refusal", async () => {
    vi.mocked(writeBindingSet).mockRejectedValue(
      new ApiError("refused", "The binding set was refused.", 400, "project.other"),
    );
    const { result } = await opened();
    act(() => result.current.confirm());
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Changing mac-main failed.", {
        description: "The binding set was refused.",
      }),
    );
    expect(result.current.guard.change).not.toBeNull();
  });

  it("opens no guard when the binding left the set", async () => {
    vi.mocked(readBindingSet).mockResolvedValue({ version: 3, bindings: {} });
    const onChanged = vi.fn();
    const { result } = renderHook(() => useBindingRemove("prj-a", "mac-main", onChanged));
    act(() => result.current.request());
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(toast.info).toHaveBeenCalledWith("mac-main is no longer in the binding set.");
    expect(result.current.guard.change).toBeNull();
  });
});
