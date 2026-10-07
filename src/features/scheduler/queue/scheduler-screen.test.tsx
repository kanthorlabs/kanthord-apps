import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/scheduler", () => ({
  listQueueJobs: vi.fn(),
}));

vi.mock("@/api/resources/mission", () => ({
  readMission: vi.fn(),
  listMissionNodes: vi.fn(),
}));

vi.mock("@/features/projects/project-context", () => ({
  useProjectId: () => "prj-test",
}));

import { listMissionNodes, readMission } from "@/api/resources/mission";
import { listQueueJobs } from "@/api/resources/scheduler";
import type { MissionNodeRecord, SchedulerJob } from "@/api/types";

import { SchedulerScreen } from "./scheduler-screen";

function job(jobId: string, nodeId: string, priority: number): SchedulerJob {
  return { job_id: jobId, project_id: "prj-test", node_id: nodeId, priority };
}

function objective(id: string, name: string): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    parent_id: null,
    visible_revision: 1,
    content: { name, requirement: "", criterion: "", verifications: [], bindings: [] },
    retired_at: null,
    pinned_by_attempts: [],
    kind: "objective",
    state: "Available",
    attempt: 0,
    priority: 0,
    depends_on: [],
  };
}

function mockQueue(jobs: readonly SchedulerJob[], nodes: readonly MissionNodeRecord[]) {
  vi.mocked(listQueueJobs).mockResolvedValue(jobs);
  vi.mocked(readMission).mockResolvedValue({ id: "mission_1", project_id: "prj-test", version: 1 });
  vi.mocked(listMissionNodes).mockResolvedValue(nodes);
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <SchedulerScreen />
    </MemoryRouter>,
  );
}

describe("SchedulerScreen", () => {
  it("keeps the queue order that the Scheduler answers", async () => {
    mockQueue(
      [job("job_1", "node_b", 3), job("job_2", "node_a", 3), job("job_3", "node_c", 1)],
      [
        objective("node_a", "Add password reset"),
        objective("node_b", "Add recovery codes"),
        objective("node_c", "Audit the lockout log"),
      ],
    );

    renderScreen();

    const links = await screen.findAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual([
      "Add recovery codes",
      "Add password reset",
      "Audit the lockout log",
    ]);
    expect(links[0]?.getAttribute("href")).toBe("/projects/prj-test");
  });

  it("names the priority and the job identity", async () => {
    mockQueue([job("job_1", "node_a", 7)], [objective("node_a", "Add password reset")]);

    renderScreen();

    expect(await screen.findByText("Priority 7 · job_1")).toBeDefined();
  });

  it("falls back to the node identity when the node list omits the node", async () => {
    mockQueue([job("job_1", "node_retired", 0)], []);

    renderScreen();

    expect(await screen.findByRole("link", { name: "node_retired" })).toBeDefined();
  });

  it("shows a plain message for an empty queue", async () => {
    mockQueue([], []);

    renderScreen();

    expect(await screen.findByText("No jobs in the queue.")).toBeDefined();
  });
});
