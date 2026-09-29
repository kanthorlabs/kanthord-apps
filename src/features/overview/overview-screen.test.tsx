import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { BlockedNode, Execution, Overview } from "@/api/types";
import { NODE_STATES } from "@/api/types";
import { OverviewScreen } from "./overview-screen";

vi.mock("@/features/projects/project-context", () => ({
  useProjectId: () => "prj-test",
}));

vi.mock("@/api/resources/projects", () => ({
  readOverview: vi.fn(),
}));

vi.mock("@/api/resources/mission", () => ({
  listBlocked: vi.fn(),
}));

vi.mock("@/api/resources/scheduler", () => ({
  listExecutions: vi.fn(),
}));

import { readOverview } from "@/api/resources/projects";
import { listBlocked } from "@/api/resources/mission";
import { listExecutions } from "@/api/resources/scheduler";

const mockOverview: Overview = {
  projectId: "prj-test",
  tallies: [],
  blockedCount: 0,
  liveExecutionCount: 0,
  instanceCapacity: 4,
  instancesHealthy: 3,
  inboxDepth: 2,
};

const mockBlockedTime = new Date().toISOString();

const mockBlockedNode: BlockedNode = {
  node: {
    id: "node-1",
    kind: "objective",
    title: "Add password reset",
    state: "Blocked",
    parentId: null,
    dependsOn: [],
    goal: "A user resets a forgotten password.",
    steps: [],
    validationCriteria: [],
    verificationCommand: null,
    repositoryBindingId: null,
    priority: 0,
    attemptCounter: 2,
    currentRevisionId: "rev-1",
  },
  closedAttempt: {
    id: "att-1",
    nodeId: "node-1",
    ordinal: 1,
    pinnedRevisionId: "rev-1",
    open: false,
    openedAt: new Date().toISOString(),
    closedAt: new Date().toISOString(),
    evidence: [],
    assessments: [
      {
        id: "as-1-human",
        attemptId: "att-1",
        nodeRevisionId: "rev-1",
        evidenceIds: [],
        childOutcomeIds: [],
        verdict: "neither established",
        method: "human block",
        actor: { kind: "human", account: "ulrich", name: "ulrich" },
        time: mockBlockedTime,
        currency: null,
      },
    ],
    outcome: {
      id: "oc-1",
      attemptId: "att-1",
      assertedResult: "nothing established",
      closingEvent: "Blocked by a human.",
      stoppingReason: "The signing key rotation landed first.",
      assessmentId: "as-1-human",
      evidenceIds: [],
      previousOutcomeId: null,
      actor: "ulrich",
      time: mockBlockedTime,
    },
    externalObjects: [],
  },
  condition: "a human reason on a paused node",
};

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
  it("renders the blocked section first and shows the stopping reason", async () => {
    vi.mocked(readOverview).mockResolvedValue(mockOverview);
    vi.mocked(listBlocked).mockResolvedValue([mockBlockedNode]);
    vi.mocked(listExecutions).mockResolvedValue([mockExecution]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("The signing key rotation landed first.")).toBeDefined();
    });

    const needsHuman = screen.getByText("Needs a human");
    const running = screen.getByText("Running");

    expect(
      needsHuman.compareDocumentPosition(running) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows a plain message when there are no blocked nodes", async () => {
    vi.mocked(readOverview).mockResolvedValue(mockOverview);
    vi.mocked(listBlocked).mockResolvedValue([]);
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
    vi.mocked(readOverview).mockResolvedValue({ ...mockOverview, tallies });
    vi.mocked(listBlocked).mockResolvedValue([]);
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
