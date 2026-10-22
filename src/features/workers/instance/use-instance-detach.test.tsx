import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { exportMissionJson, readMission } from "@/api/resources/mission";
import { listProjects, readBindingSet, writeBindingSet } from "@/api/resources/projects";
import { readWorkerInstance } from "@/api/resources/worker-instances";
import type { BindingSet, Project, WorkerInstanceDetail } from "@/api/types";
import { renderedText } from "../../../../test/text-content";
import { DETACH_ALL, useInstanceDetach } from "./use-instance-detach";

vi.mock("@/api/resources/projects", () => ({
  listProjects: vi.fn(),
  readBindingSet: vi.fn(),
  writeBindingSet: vi.fn(),
}));
vi.mock("@/api/resources/worker-instances", () => ({ readWorkerInstance: vi.fn() }));
vi.mock("@/api/resources/mission", () => ({ readMission: vi.fn(), exportMissionJson: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const project = (id: string, name: string): Project => ({
  id,
  name,
  binding_set_version: 1,
  created_at: 0,
  paused_at: null,
  workspace_directory: "/w",
});

const MAC: WorkerInstanceDetail = {
  id: "worker_instance_1",
  name: "mac-studio",
  worker: "coder@1",
  revision: 1,
  public_key: "k",
  fingerprint: "f",
  created_at: 0,
  ended_at: null,
  connection: null,
  bindings: [
    { project_id: "prj-a", binding: "mac-main" },
    { project_id: "prj-b", binding: "solo" },
  ],
  registrations: [],
  credentials: [],
};

const SET_A: BindingSet = {
  version: 4,
  bindings: {
    "mac-main": {
      kind: "worker",
      config: { worker: "coder@1", placement: "worker", worker_instances: ["mac-studio", "b-1"] },
    },
  },
};

const SET_B: BindingSet = {
  version: 7,
  bindings: {
    solo: {
      kind: "worker",
      config: { worker: "coder@1", placement: "worker", worker_instances: ["mac-studio"] },
    },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readWorkerInstance).mockResolvedValue(MAC);
  vi.mocked(listProjects).mockResolvedValue([
    project("prj-a", "atlas"),
    project("prj-b", "beacon"),
  ]);
  vi.mocked(readBindingSet).mockImplementation((id) =>
    Promise.resolve(id === "prj-a" ? SET_A : SET_B),
  );
  vi.mocked(writeBindingSet).mockResolvedValue({
    project_id: "prj-a",
    binding_set_version: 5,
    changes: [],
  });
  vi.mocked(readMission).mockResolvedValue({ id: "mission-b", project_id: "prj-b", version: 1 });
  vi.mocked(exportMissionJson).mockResolvedValue({
    mission_id: "mission-b",
    entries: [
      {
        filename: "build.md",
        intent: "implement",
        name: "Build",
        requirement: "r",
        criterion: "c",
        verifications: [],
        bindings: ["solo"],
      },
    ],
  } as unknown as Awaited<ReturnType<typeof exportMissionJson>>);
});

describe("useInstanceDetach", () => {
  it("asks which binding when several bindings list the instance", async () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => useInstanceDetach(onChanged));
    act(() => result.current.request("mac-studio", null));
    await waitFor(() => expect(result.current.phase).toBe("choose"));
    expect(result.current.choices.map((choice) => choice.key)).toEqual([
      "prj-a/mac-main",
      "prj-b/solo",
    ]);
    expect(result.current.selection).toBeNull();
    expect(result.current.writable).toBe(false);
    expect(readBindingSet).not.toHaveBeenCalled();
  });

  it("detaches from the one chosen binding only", async () => {
    const onChanged = vi.fn();
    const { result } = renderHook(() => useInstanceDetach(onChanged));
    act(() => result.current.request("mac-studio", null));
    await waitFor(() => expect(result.current.phase).toBe("choose"));
    act(() => result.current.select("prj-a/mac-main"));
    act(() => result.current.proceed());
    await waitFor(() => expect(result.current.phase).toBe("confirm"));
    expect(result.current.steps.map((step) => step.kind)).toEqual(["revise"]);
    act(() => result.current.confirm());
    await waitFor(() => expect(result.current.phase).toBe("closed"));
    expect(writeBindingSet).toHaveBeenCalledTimes(1);
    expect(writeBindingSet).toHaveBeenCalledWith("prj-a", 4, {
      "mac-main": {
        kind: "worker",
        config: { worker: "coder@1", placement: "worker", worker_instances: ["b-1"] },
      },
    });
    expect(toast.success).toHaveBeenCalledWith("Detached mac-studio.", expect.anything());
    expect(onChanged).toHaveBeenCalled();
  });

  it("detaches from all bindings and guards the last instance with the mission nodes", async () => {
    const { result } = renderHook(() => useInstanceDetach(vi.fn()));
    act(() => result.current.request("mac-studio", null));
    await waitFor(() => expect(result.current.phase).toBe("choose"));
    act(() => result.current.select(DETACH_ALL));
    act(() => result.current.proceed());
    await waitFor(() => expect(result.current.phase).toBe("confirm"));
    const [revise, disable] = result.current.steps;
    expect(revise?.kind).toBe("revise");
    expect(disable?.kind).toBe("disable");
    expect(disable?.nodes?.map((node) => node.name)).toEqual(["Build"]);
    expect(renderedText(disable?.consequence).text).toContain(
      "Making solo unavailable refuses every use of it",
    );
    act(() => result.current.confirm());
    await waitFor(() => expect(result.current.phase).toBe("closed"));
    expect(writeBindingSet).toHaveBeenCalledWith("prj-b", 7, {
      solo: {
        kind: "worker",
        config: { worker: "coder@1", placement: "worker", worker_instances: [] },
      },
    });
    expect(writeBindingSet).toHaveBeenCalledTimes(2);
  });

  it("goes straight to the confirmation for one scoped binding", async () => {
    const { result } = renderHook(() => useInstanceDetach(vi.fn()));
    act(() => result.current.request("mac-studio", { projectId: "prj-a", binding: "mac-main" }));
    await waitFor(() => expect(result.current.phase).toBe("confirm"));
    expect(result.current.steps).toHaveLength(1);
    expect(result.current.writable).toBe(true);
  });

  it("reports both facts when one project write succeeds and the other conflicts", async () => {
    vi.mocked(writeBindingSet).mockImplementation((id) =>
      id === "prj-a"
        ? Promise.resolve({ project_id: "prj-a", binding_set_version: 5, changes: [] })
        : Promise.reject(
            new ApiError(
              "conflict",
              "The submitted binding-set version differs from the current version.",
              409,
              "project.binding_set.version_conflict",
            ),
          ),
    );
    const { result } = renderHook(() => useInstanceDetach(vi.fn()));
    act(() => result.current.request("mac-studio", null));
    await waitFor(() => expect(result.current.phase).toBe("choose"));
    act(() => result.current.select(DETACH_ALL));
    act(() => result.current.proceed());
    await waitFor(() => expect(result.current.phase).toBe("confirm"));
    act(() => result.current.confirm());
    await waitFor(() => expect(result.current.phase).toBe("closed"));
    const call = vi.mocked(toast.error).mock.calls[0];
    expect(call?.[0]).toBe("Detaching mac-studio failed in part.");
    const report = renderedText((call?.[1] as { description: React.ReactNode }).description).text;
    expect(report).toContain("Detached from mac-main of atlas.");
    expect(report).toContain(
      "Not detached from solo of beacon: Someone else saved the binding set of beacon after this read. Nothing changed in beacon.",
    );
  });

  it("offers no write when the binding no longer lists the instance", async () => {
    vi.mocked(readBindingSet).mockResolvedValue({ version: 4, bindings: {} });
    const { result } = renderHook(() => useInstanceDetach(vi.fn()));
    act(() => result.current.request("mac-studio", { projectId: "prj-a", binding: "mac-main" }));
    await waitFor(() => expect(result.current.phase).toBe("confirm"));
    expect(result.current.steps.map((step) => step.kind)).toEqual(["gone"]);
    expect(result.current.writable).toBe(false);
  });

  it("stays closed when the read ends after a cancel", async () => {
    let finish: (detail: WorkerInstanceDetail) => void = () => undefined;
    vi.mocked(readWorkerInstance).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useInstanceDetach(vi.fn()));
    act(() => result.current.request("mac-studio", null));
    expect(result.current.phase).toBe("reading");
    act(() => result.current.cancel());
    await act(async () => {
      finish(MAC);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current.phase).toBe("closed");
  });

  it("shows the read failure as the ApiError message", async () => {
    vi.mocked(readWorkerInstance).mockRejectedValue(
      new ApiError("not_found", "The worker instance does not exist.", 404),
    );
    const { result } = renderHook(() => useInstanceDetach(vi.fn()));
    act(() => result.current.request("mac-studio", null));
    await waitFor(() => expect(result.current.error).toBe("The worker instance does not exist."));
    expect(result.current.writable).toBe(false);
  });
});
