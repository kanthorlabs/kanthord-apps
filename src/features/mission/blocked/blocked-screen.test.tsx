import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BlockedNode, MissionNode } from "@/api/types";
import { ProjectProvider } from "@/features/projects/project-context";

vi.mock("@/api/resources/mission", () => ({
  listBlocked: vi.fn(),
  listNodes: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  block: vi.fn(),
  unblock: vi.fn(),
  overrideSuccess: vi.fn(),
  discard: vi.fn(),
  setPriority: vi.fn(),
}));

vi.mock("@/api/resources/projects", () => ({
  listProjects: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

import { listBlocked, listNodes } from "@/api/resources/mission";
import { listProjects } from "@/api/resources/projects";
import { BlockedScreen } from "./blocked-screen";

const PROJECT = { id: "prj-1", name: "Test", missionRevision: "mr-1" };

const BASE_NODE: MissionNode = {
  id: "node-blocked",
  kind: "objective",
  title: "Add password reset",
  state: "Blocked",
  parentId: null,
  dependsOn: [],
  goal: "A password reset flow.",
  steps: [],
  validationCriteria: [],
  verificationCommand: null,
  repositoryBindingId: null,
  priority: 0,
  attemptCounter: 2,
  currentRevisionId: "rev-2",
};

const BLOCKED_WITH_OUTCOME: BlockedNode = {
  node: BASE_NODE,
  closedAttempt: {
    id: "att-1",
    nodeId: "node-blocked",
    ordinal: 2,
    pinnedRevisionId: "rev-2",
    open: false,
    openedAt: "2025-01-01T00:00:00Z",
    closedAt: "2025-01-01T01:00:00Z",
    evidence: [],
    assessments: [],
    outcome: {
      id: "oc-1",
      attemptId: "att-1",
      basis: "assessment",
      assertedResult: "criteria not met",
      closingEvent: "The current assessment does not pass.",
      stoppingReason: "The reset link accepted a second password change.",
      assessmentId: "as-1",
      evidenceIds: [],
      previousOutcomeId: null,
      actor: "re@1",
      time: "2025-01-01T01:00:00Z",
    },
    externalObjects: [
      {
        id: "eo-1",
        attemptId: "att-1",
        action: "open a pull request",
        actionKind: "request-reply action",
        repositoryBindingId: "bnd-repo",
        address: "https://github.com/org/repo/pull/42",
        label: "pull request 42",
        expectedEndState: "merged",
        observedState: "open",
        resolved: false,
      },
    ],
  },
  condition: "a current assessment that does not pass",
};

const BLOCKED_NO_EXTERNAL: BlockedNode = {
  node: { ...BASE_NODE, id: "node-blocked-2", title: "Harden the token store" },
  closedAttempt: {
    id: "att-2",
    nodeId: "node-blocked-2",
    ordinal: 1,
    pinnedRevisionId: "rev-1",
    open: false,
    openedAt: "2025-01-01T00:00:00Z",
    closedAt: "2025-01-01T02:00:00Z",
    evidence: [],
    assessments: [],
    outcome: {
      id: "oc-2",
      attemptId: "att-2",
      basis: "human assertion",
      assertedResult: "nothing established",
      closingEvent: "A human blocked the paused node.",
      stoppingReason: "The signing key rotation landed first.",
      assessmentId: null,
      evidenceIds: [],
      previousOutcomeId: null,
      actor: "ulrich",
      time: "2025-01-01T02:00:00Z",
    },
    externalObjects: [],
  },
  condition: "a human reason on a paused node",
};

function renderScreen() {
  return render(
    <MemoryRouter>
      <ProjectProvider>
        <BlockedScreen />
      </ProjectProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(listProjects).mockResolvedValue([PROJECT]);
  vi.mocked(listNodes).mockResolvedValue([]);
});

describe("BlockedScreen", () => {
  it("renders the stopping reason and closing event of the closed attempt", async () => {
    vi.mocked(listBlocked).mockResolvedValue([BLOCKED_WITH_OUTCOME]);

    renderScreen();

    expect(
      await screen.findByText("The reset link accepted a second password change."),
    ).toBeDefined();
    expect(screen.getByText("The current assessment does not pass.")).toBeDefined();
    expect(screen.getByText("criteria not met")).toBeDefined();
    expect(screen.getByText("assessment")).toBeDefined();
  });

  it("renders the external objects with observed and expected states", async () => {
    vi.mocked(listBlocked).mockResolvedValue([BLOCKED_WITH_OUTCOME]);

    renderScreen();

    await screen.findByText("The reset link accepted a second password change.");

    expect(screen.getByText("External actions")).toBeDefined();
    expect(screen.getByText("open a pull request")).toBeDefined();
    expect(screen.getByText("open")).toBeDefined();
    expect(screen.getByText("merged")).toBeDefined();
  });

  it("shows no external actions section when the attempt requested none", async () => {
    vi.mocked(listBlocked).mockResolvedValue([BLOCKED_NO_EXTERNAL]);

    renderScreen();

    await screen.findByText("The signing key rotation landed first.");

    expect(screen.queryByText("External actions")).toBeNull();
  });

  it("links each node to its mission route", async () => {
    vi.mocked(listBlocked).mockResolvedValue([BLOCKED_WITH_OUTCOME]);

    renderScreen();

    const link = (await screen.findByRole("link", {
      name: "Add password reset",
    })) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/mission/node-blocked");
  });

  it("renders an empty state when no blocked nodes exist", async () => {
    vi.mocked(listBlocked).mockResolvedValue([]);

    renderScreen();

    expect(await screen.findByText("No blocked nodes.")).toBeDefined();
  });
});
