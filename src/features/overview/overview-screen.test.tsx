import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type {
  MissionNodeRecord,
  MissionOutcome,
  NodeState,
  SchedulerExecutionRecord,
} from "@/api/types";
import { NODE_STATES } from "@/api/types";
import { closingEventText } from "@/lib/mission-labels";
import { OverviewScreen } from "./overview-screen";

vi.mock("@/features/projects/project-context", () => ({
  useProjectId: () => "prj-test",
}));

vi.mock("@/api/resources/mission", () => ({
  readMission: vi.fn(),
  listMissionNodes: vi.fn(),
}));

vi.mock("@/api/resources/scheduler", () => ({
  listProjectExecutions: vi.fn(),
}));

import { listMissionNodes, readMission } from "@/api/resources/mission";
import { listProjectExecutions } from "@/api/resources/scheduler";

const blockedOutcome: MissionOutcome = {
  id: "outcome_1",
  nodeId: "node_1",
  attempt: 2,
  nodeRevision: 1,
  closingEvent: "human-block",
  result: "undetermined",
  assessmentId: "assessment_1",
  evidenceIds: [],
  createdAt: Date.now(),
};

function objective(id: string, name: string, state: NodeState): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    missionId: "mission_1",
    parentId: null,
    visibleRevision: 1,
    content: { name, requirement: "", criterion: "", verifications: [], bindings: [] },
    retiredAt: null,
    pinnedByAttempts: [],
    kind: "objective",
    state,
    attempt: 2,
    priority: 0,
    ...(state === "Blocked" ? { blockedContext: { outcome: blockedOutcome, requests: [] } } : {}),
  };
}

function mockNodes(nodes: readonly MissionNodeRecord[]) {
  vi.mocked(readMission).mockResolvedValue({ id: "mission_1", projectId: "prj-test", version: 1 });
  vi.mocked(listMissionNodes).mockResolvedValue(nodes);
}

function execution(
  executionId: string,
  nodeId: string,
  claimState: SchedulerExecutionRecord["claimState"],
): SchedulerExecutionRecord {
  return {
    executionId,
    projectId: "prj-test",
    nodeId,
    claimant: {
      workerBindingId: "binding_tdd_main",
      resourceIdentity: "worker:kanthord:tdd-main",
      runtimeIdentity: "worker_instance_01",
    },
    attempt: 1,
    pinnedRevision: 1,
    credentials: [],
    claimState,
    expiredAt: Date.now() + 60_000,
    createdAt: Date.now(),
    endedAt: claimState === "running" ? null : Date.now(),
    traceId: "0".repeat(31) + "1",
    rootSpanId: "0".repeat(15) + "1",
  };
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <OverviewScreen />
    </MemoryRouter>,
  );
}

describe("OverviewScreen", () => {
  it("renders the blocked section first and shows the closing event", async () => {
    mockNodes([objective("node_1", "Add password reset", "Blocked")]);
    vi.mocked(listProjectExecutions).mockResolvedValue([
      execution("execution_1", "node_9", "running"),
    ]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Add password reset")).toBeDefined();
      expect(screen.getByText(closingEventText("human-block"))).toBeDefined();
    });

    const needsHuman = screen.getByText("Needs a human");
    const running = screen.getByText("Running");

    expect(
      needsHuman.compareDocumentPosition(running) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows a plain message when there are no blocked nodes", async () => {
    mockNodes([objective("node_2", "Add recovery codes", "Pending")]);
    vi.mocked(listProjectExecutions).mockResolvedValue([]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("No blocked nodes.")).toBeDefined();
    });
  });

  it("orders tallies by NODE_STATES lifecycle order", async () => {
    const tallies = [
      { state: "Completed" as const, count: 5 },
      { state: "Pending" as const, count: 2 },
      { state: "Executing" as const, count: 1 },
      { state: "Available" as const, count: 3 },
    ];
    mockNodes(
      tallies.flatMap((tally) =>
        Array.from({ length: tally.count }, (_, index) =>
          objective(`node_${tally.state}_${index}`, `${tally.state} ${index}`, tally.state),
        ),
      ),
    );
    vi.mocked(listProjectExecutions).mockResolvedValue([]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Pending")).toBeDefined();
    });

    const stateLabels = screen
      .getAllByText((text) => tallies.some((t) => t.state === text))
      .map((el) => el.textContent ?? "");

    const expectedOrder = NODE_STATES.filter((s) => tallies.some((t) => t.state === s));
    expect(stateLabels).toEqual(expectedOrder);
  });

  it("lists only running executions under their node name", async () => {
    mockNodes([
      objective("node_2", "Add recovery codes", "Executing"),
      objective("node_3", "Audit the lockout log", "Completed"),
    ]);
    vi.mocked(listProjectExecutions).mockResolvedValue([
      execution("execution_2", "node_2", "running"),
      execution("execution_3", "node_3", "finished"),
    ]);

    renderScreen();

    const list = await screen.findByRole("list", { name: "Live executions" });
    expect(within(list).getByText("Add recovery codes")).toBeDefined();
    expect(within(list).queryByText("Audit the lockout log")).toBeNull();
  });
});
