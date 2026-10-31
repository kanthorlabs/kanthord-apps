import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readProject, resumeProject } from "@/api/resources/projects";
import type { Project } from "@/api/types";
import { fixItemsOf, type ProjectPausedItem } from "@/lib/fix-attention";

import { useFixActs } from "./use-fix-acts";

vi.mock("@/api/resources/projects", () => ({
  pauseProject: vi.fn(),
  readProject: vi.fn(),
  resumeProject: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const PROJECT: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: 5,
  workspace_directory: "/state/prj-1",
};

const [ITEM] = fixItemsOf(
  [
    {
      project: PROJECT,
      missionVersion: 1,
      nodes: [],
      jobs: [],
      registrations: [],
      executions: [],
      bindings: [],
      environments: null,
    },
  ],
  { now: 10, catalog: [], credentials: [], sessions: null },
) as readonly [ProjectPausedItem];

beforeEach(() => {
  vi.mocked(readProject).mockReset().mockResolvedValue(PROJECT);
  vi.mocked(resumeProject)
    .mockReset()
    .mockResolvedValue({ ...PROJECT, paused_at: null });
});

describe("useFixActs", () => {
  it("resumes the project, marks the item acted and reads the inbox again", async () => {
    const context = { reload: vi.fn(), markActed: vi.fn() };
    const { result } = renderHook(() => useFixActs(ITEM, context));

    await act(async () => result.current.toggle());

    expect(resumeProject).toHaveBeenCalledWith("prj-1");
    expect(context.markActed).toHaveBeenCalledWith("project_paused:prj-1");
    expect(context.reload).toHaveBeenCalledTimes(1);
  });
});
