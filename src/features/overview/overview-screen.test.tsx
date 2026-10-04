import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { Execution, MissionNodeRecord, MissionOutcome, NodeState } from "@/api/types";
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
  listExecutions: vi.fn(),
}));

import { listMissionNodes, readMission } from "@/api/resources/mission";
import { listExecutions } from "@/api/resources/scheduler";

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

const mockExecution: Execution = {
  id: "exec-1",
  projectId: "prj-test",
  claimantKind: "worker binding",
  claimantId: "bnd-wkr-general-main",
  instanceRuntimeId: "rt-8f21",
  nodeId: "obj-lockout-audit",
  nodeTitle: "Audit the lockout log",
  attemptId: "att-la-1",
  pinnedRevisionId: "rev-la-1",
  claimKind: "steps",
  lease: { expiresAt: new Date().toISOString(), renewedAt: new Date().toISOString() },
  live: true,
  startedAt: new Date().toISOString(),
  endedAt: null,
  turnsUsed: 10,
  turnBudget: 200,
  wallTimeUsedSeconds: 60,
  wallTimeBudgetSeconds: 7200,
};

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
    vi.mocked(listExecutions).mockResolvedValue([mockExecution]);

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
    vi.mocked(listExecutions).mockResolvedValue([]);

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
    vi.mocked(listExecutions).mockResolvedValue([]);

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
});
