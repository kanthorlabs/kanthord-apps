import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import {
  listMissionNodes,
  listProjectFollowups,
  listUndecidedFindings,
  readMission,
} from "@/api/resources/mission";
import { listProjectEnvironments, listProjects } from "@/api/resources/projects";
import { listProjectExecutionPage, listQueueJobs } from "@/api/resources/scheduler";
import { listWorkbenchSessions } from "@/api/resources/workbench";
import { listWorkerRegistrations } from "@/api/resources/workers";
import type { MissionFinding, Project, WorkbenchSessionListItem } from "@/api/types";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/scheduler");
vi.mock("@/api/resources/workbench");
vi.mock("@/api/resources/workers");

import { MAX_READS_IN_FLIGHT } from "./limit-reads";
import { readOverviewSnapshot, retryFaults } from "./read-overview-snapshot";

function missionFinding(overrides: Partial<MissionFinding> = {}): MissionFinding {
  const human = overrides.source === "human";
  return {
    id: "finding_1",
    node_id: "n1",
    attempt: 1,
    round: human ? null : 2,
    assessment_id: "assessment_1",
    source: "reviewer",
    label: human ? "H1" : "S1",
    kind: "suggestion",
    action: "yes",
    task_id: null,
    ground: null,
    name: "Trim the email",
    description: "The form keeps the spaces around the email address.",
    fix: "Trim the email address before the check.",
    why: "A pasted address often holds a trailing space.",
    route: "report",
    status: "open",
    fixed_assessment_id: null,
    cause_owner: human ? "reviewer" : null,
    created_by: human ? { kind: "human", account: "ulrich", name: "Ulrich" } : null,
    created_at: 1,
    decision: null,
    decision_reason: null,
    decided_by: null,
    decided_at: null,
    ...overrides,
  };
}

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
  vi.mocked(listUndecidedFindings).mockResolvedValue([]);
  vi.mocked(listProjectFollowups).mockResolvedValue([]);
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

describe("readOverviewSnapshot undecided findings", () => {
  it("reads the undecided findings of each project with a mission", async () => {
    const finding = missionFinding();
    vi.mocked(listUndecidedFindings).mockResolvedValue([finding]);

    const snapshot = await readOverviewSnapshot(null, null);

    expect(listUndecidedFindings).toHaveBeenCalledWith("prj-1");
    expect(snapshot.reads[0]?.findings).toEqual([finding]);
  });

  it("reads no finding for a project without a mission", async () => {
    vi.mocked(readMission).mockRejectedValue(
      new ApiError("not_found", "No such mission.", 404, "mission.mission.not_found"),
    );

    const snapshot = await readOverviewSnapshot(null, null);

    expect(listUndecidedFindings).not.toHaveBeenCalled();
    expect(snapshot.reads[0]?.findings).toBeNull();
  });

  it("keeps the last findings and names the fault when the read fails", async () => {
    const finding = missionFinding();
    vi.mocked(listUndecidedFindings).mockResolvedValue([finding]);
    const previous = await readOverviewSnapshot(null, null);
    vi.mocked(listUndecidedFindings).mockRejectedValue(
      new ApiError("unreachable", "No answer.", 0),
    );

    const snapshot = await readOverviewSnapshot(previous, null);

    expect(snapshot.reads[0]?.findings).toEqual([finding]);
    expect(snapshot.faults.map((fault) => fault.source)).toEqual(["undecided findings"]);
  });
});

describe("readOverviewSnapshot follow-up proposals", () => {
  it("lists an absent follow-up route as absent and gives no fault", async () => {
    vi.mocked(listProjectFollowups).mockRejectedValue(
      new ApiError("not_found", "No route.", 404, "gateway.routing.not_found"),
    );

    const snapshot = await readOverviewSnapshot(null, null);

    expect(snapshot.faults).toEqual([]);
    expect(snapshot.absent).toEqual(["follow-up proposals"]);
    expect(snapshot.reads[0]?.absent).toEqual(["follow-up proposals"]);
  });

  it("drops the earlier follow-ups when a later read finds the route absent", async () => {
    vi.mocked(listProjectFollowups).mockResolvedValue([
      {
        id: "followup_n1",
        node_id: "n1",
        attempt: 1,
        assessment_id: null,
        content: { name: "Reply on the issue", requirement: "r", criterion: "c" },
        created_node_id: null,
        approved_at: null,
        rejected_at: null,
        created_at: 1,
      },
    ]);
    const previous = await readOverviewSnapshot(null, null);
    expect(previous.reads[0]?.followups).toHaveLength(1);
    vi.mocked(listProjectFollowups).mockRejectedValue(
      new ApiError("not_found", "No route.", 404, "gateway.routing.not_found"),
    );

    const snapshot = await readOverviewSnapshot(previous, null);

    expect(snapshot.reads[0]?.followups).toBeNull();
    expect(snapshot.absent).toEqual(["follow-up proposals"]);
  });

  it("names a fault when the follow-up read answers 500", async () => {
    vi.mocked(listProjectFollowups).mockRejectedValue(
      new ApiError("malformed", "Broken.", 500, "gateway.internal"),
    );

    const snapshot = await readOverviewSnapshot(null, null);

    expect(snapshot.faults.map((fault) => fault.source)).toEqual(["follow-up proposals"]);
    expect(snapshot.absent).toEqual([]);
  });

  it("keeps a 404 with another code as a fault", async () => {
    vi.mocked(listProjectFollowups).mockRejectedValue(
      new ApiError("not_found", "No project.", 404, "project.project.not_found"),
    );

    const snapshot = await readOverviewSnapshot(null, null);

    expect(snapshot.faults.map((fault) => fault.source)).toEqual(["follow-up proposals"]);
    expect(snapshot.absent).toEqual([]);
  });
});

const UNREACHABLE = new ApiError("unreachable", "No answer.", 0);

function clearReadCalls() {
  for (const read of [
    listProjects,
    readMission,
    listMissionNodes,
    listUndecidedFindings,
    listProjectFollowups,
    listQueueJobs,
    listWorkerRegistrations,
    listProjectEnvironments,
    listProjectExecutionPage,
    listWorkbenchSessions,
  ]) {
    vi.mocked(read).mockClear();
  }
}

describe("retryFaults", () => {
  it("reads only the queue of the project of the fault", async () => {
    vi.mocked(listQueueJobs).mockRejectedValueOnce(UNREACHABLE);
    const previous = await readOverviewSnapshot(null, null);
    clearReadCalls();

    await retryFaults(previous);

    expect(listQueueJobs).toHaveBeenCalledTimes(1);
    expect(listQueueJobs).toHaveBeenCalledWith("prj-1");
    expect(listProjects).not.toHaveBeenCalled();
    expect(readMission).not.toHaveBeenCalled();
    expect(listMissionNodes).not.toHaveBeenCalled();
    expect(listUndecidedFindings).not.toHaveBeenCalled();
    expect(listProjectFollowups).not.toHaveBeenCalled();
    expect(listWorkerRegistrations).not.toHaveBeenCalled();
    expect(listProjectEnvironments).not.toHaveBeenCalled();
    expect(listProjectExecutionPage).not.toHaveBeenCalled();
    expect(listWorkbenchSessions).not.toHaveBeenCalled();
  });

  it("removes the fault of a successful retry and keeps the other data", async () => {
    const finding = missionFinding();
    vi.mocked(listUndecidedFindings).mockResolvedValue([finding]);
    vi.mocked(listQueueJobs).mockRejectedValueOnce(UNREACHABLE);
    const previous = await readOverviewSnapshot(null, null);
    const job = { job_id: "job_1", project_id: "prj-1", node_id: "n1", priority: 0, queued_at: 1 };
    vi.mocked(listQueueJobs).mockResolvedValue([job]);

    const snapshot = await retryFaults(previous);

    expect(snapshot.faults).toEqual([]);
    expect(snapshot.reads[0]?.jobs).toEqual([job]);
    expect(snapshot.reads[0]?.findings).toEqual([finding]);
    expect(snapshot.sessions).toEqual([SESSION]);
    expect(snapshot.projects).toEqual([ATLAS]);
  });

  it("keeps the fault with the new message when the retry fails again", async () => {
    vi.mocked(listQueueJobs).mockRejectedValueOnce(UNREACHABLE);
    const previous = await readOverviewSnapshot(null, null);
    vi.mocked(listQueueJobs).mockRejectedValue(new ApiError("unreachable", "Still down.", 0));

    const snapshot = await retryFaults(previous);

    expect(snapshot.faults).toEqual([
      { projectId: "prj-1", projectName: "atlas", source: "queue", message: "Still down." },
    ]);
  });

  it("retries the workbench sessions and not an absent source", async () => {
    vi.mocked(listProjectFollowups).mockRejectedValue(
      new ApiError("not_found", "No route.", 404, "gateway.routing.not_found"),
    );
    vi.mocked(listWorkbenchSessions).mockRejectedValueOnce(UNREACHABLE);
    const previous = await readOverviewSnapshot(null, null);
    clearReadCalls();

    const snapshot = await retryFaults(previous);

    expect(listWorkbenchSessions).toHaveBeenCalledTimes(1);
    expect(listProjectFollowups).not.toHaveBeenCalled();
    expect(snapshot.sessions).toEqual([SESSION]);
    expect(snapshot.faults).toEqual([]);
    expect(snapshot.absent).toEqual(["follow-up proposals"]);
  });

  it("reads the nodes, findings and follow-ups again after a mission retry succeeds", async () => {
    vi.mocked(readMission).mockRejectedValueOnce(UNREACHABLE);
    const previous = await readOverviewSnapshot(null, null);
    expect(previous.faults.map((fault) => fault.source)).toEqual(["mission"]);
    expect(listMissionNodes).not.toHaveBeenCalled();
    clearReadCalls();

    const snapshot = await retryFaults(previous);

    expect(readMission).toHaveBeenCalledTimes(1);
    expect(listMissionNodes).toHaveBeenCalledWith("mission_1");
    expect(listUndecidedFindings).toHaveBeenCalledWith("prj-1");
    expect(listProjectFollowups).toHaveBeenCalledWith("prj-1");
    expect(listQueueJobs).not.toHaveBeenCalled();
    expect(snapshot.faults).toEqual([]);
    expect(snapshot.reads[0]?.mission).toEqual({
      id: "mission_1",
      project_id: "prj-1",
      version: 1,
    });
    expect(snapshot.reads[0]?.nodes).toEqual([]);
  });

  it("reads no dependent source when the mission retry fails again", async () => {
    vi.mocked(readMission).mockRejectedValue(UNREACHABLE);
    const previous = await readOverviewSnapshot(null, null);
    clearReadCalls();

    const snapshot = await retryFaults(previous);

    expect(listMissionNodes).not.toHaveBeenCalled();
    expect(snapshot.faults.map((fault) => fault.source)).toEqual(["mission"]);
  });
});

describe("read limit", () => {
  it("runs no more than the limit of reads at the same time", async () => {
    const projects = Array.from({ length: 10 }, (_, index) => ({
      ...ATLAS,
      id: `prj-${index}`,
    }));
    vi.mocked(listProjects).mockResolvedValue(projects);
    let active = 0;
    let peak = 0;
    const slow =
      <T>(value: T) =>
      async () => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 5));
        active -= 1;
        return value;
      };
    vi.mocked(readMission).mockImplementation(
      slow({ id: "mission_1", project_id: "prj-1", version: 1 }),
    );
    vi.mocked(listMissionNodes).mockImplementation(slow([]));
    vi.mocked(listUndecidedFindings).mockImplementation(slow([]));
    vi.mocked(listProjectFollowups).mockImplementation(slow([]));
    vi.mocked(listQueueJobs).mockImplementation(slow([]));
    vi.mocked(listWorkerRegistrations).mockImplementation(slow([]));
    vi.mocked(listProjectEnvironments).mockImplementation(slow([]));
    vi.mocked(listProjectExecutionPage).mockImplementation(slow({ items: [], next_cursor: null }));
    vi.mocked(listWorkbenchSessions).mockImplementation(slow([SESSION]));

    const snapshot = await readOverviewSnapshot(null, null);

    expect(snapshot.reads).toHaveLength(10);
    expect(peak).toBe(MAX_READS_IN_FLIGHT);
  });
});
