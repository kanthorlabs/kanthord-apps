import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { listMissionNodes, readMission } from "@/api/resources/mission";
import { listProjectEnvironments, listProjects } from "@/api/resources/projects";
import { listProjectExecutionPage, listQueueJobs } from "@/api/resources/scheduler";
import { listWorkbenchSessions } from "@/api/resources/workbench";
import { listWorkerRegistrations } from "@/api/resources/workers";
import type { Project, WorkbenchSessionListItem } from "@/api/types";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/scheduler");
vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");

import { readOverviewSnapshot } from "./read-overview-snapshot";

const ATLAS: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const SESSION: WorkbenchSessionListItem = {
  id: "s1",
  agent_name: "swe@1",
  name: null,
  created: 1,
  modified: 2,
  message_count: 1,
  first_message: "Create",
  run_active: true,
  pending_approval: { tool_call_id: "c1", operation_id: "project.create" },
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listProjects).mockResolvedValue([ATLAS]);
  vi.mocked(readMission).mockResolvedValue({ id: "mission_1", project_id: "prj-1", version: 1 });
  vi.mocked(listMissionNodes).mockResolvedValue([]);
  vi.mocked(listQueueJobs).mockResolvedValue([]);
  vi.mocked(listWorkerRegistrations).mockResolvedValue([]);
  vi.mocked(listProjectEnvironments).mockResolvedValue([]);
  vi.mocked(listProjectExecutionPage).mockResolvedValue({ items: [], next_cursor: null });
  vi.mocked(listWorkbenchSessions).mockResolvedValue([SESSION]);
});

describe("readOverviewSnapshot sessions", () => {
  it("reads the sessions with no project filter", async () => {
    const snapshot = await readOverviewSnapshot(null, null);

    expect(listWorkbenchSessions).toHaveBeenCalledWith(null);
    expect(snapshot.sessions).toEqual([SESSION]);
  });

  it("reads the sessions under a project filter", async () => {
    const snapshot = await readOverviewSnapshot(null, "prj-1");

    expect(listWorkbenchSessions).toHaveBeenCalledTimes(1);
    expect(listWorkbenchSessions).toHaveBeenCalledWith(null);
    expect(snapshot.sessions).toEqual([SESSION]);
    expect(snapshot.faults).toEqual([]);
  });

  it("keeps the last sessions and names the fault when the read fails", async () => {
    const previous = await readOverviewSnapshot(null, "prj-1");
    vi.mocked(listWorkbenchSessions).mockRejectedValue(
      new ApiError("unreachable", "No answer.", 0),
    );

    const snapshot = await readOverviewSnapshot(previous, "prj-1");

    expect(snapshot.sessions).toEqual([SESSION]);
    expect(snapshot.faults.map((fault) => fault.source)).toEqual(["workbench sessions"]);
  });
});
