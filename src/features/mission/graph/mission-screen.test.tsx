import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { MissionNode } from "@/api/types";

vi.mock("@/api/resources/mission", () => ({
  listNodes: vi.fn(),
}));

vi.mock("@/features/projects/project-context", () => ({
  useProjectId: () => "prj-test",
}));

import { listNodes } from "@/api/resources/mission";
import { MissionScreen } from "./mission-screen";

const initiative: MissionNode = {
  id: "ini-1",
  kind: "initiative",
  title: "Onboarding",
  state: "Completed",
  parentId: null,
  dependsOn: [],
  goal: "Reach workspace.",
  steps: [],
  validationCriteria: [],
  verificationCommand: null,
  repositoryBindingId: null,
  priority: 0,
  attemptCounter: 1,
  currentRevisionId: "rev-1",
};

const objective: MissionNode = {
  id: "obj-1",
  kind: "objective",
  title: "Add recovery codes",
  state: "Blocked",
  parentId: "ini-1",
  dependsOn: ["ini-1"],
  goal: "Store codes.",
  steps: [],
  validationCriteria: [],
  verificationCommand: null,
  repositoryBindingId: null,
  priority: 0,
  attemptCounter: 1,
  currentRevisionId: "rev-2",
};

const task: MissionNode = {
  id: "tsk-1",
  kind: "task",
  title: "Generate codes",
  state: null,
  parentId: "obj-1",
  dependsOn: [],
  goal: "Generate ten codes.",
  steps: [],
  validationCriteria: [],
  verificationCommand: null,
  repositoryBindingId: null,
  priority: 0,
  attemptCounter: 0,
  currentRevisionId: "rev-3",
};

const completedRoot: MissionNode = {
  id: "ini-done",
  kind: "initiative",
  title: "Completed initiative",
  state: "Completed",
  parentId: null,
  dependsOn: [],
  goal: "Done.",
  steps: [],
  validationCriteria: [],
  verificationCommand: null,
  repositoryBindingId: null,
  priority: 0,
  attemptCounter: 0,
  currentRevisionId: "rev-done",
};

const blockedRoot: MissionNode = {
  id: "ini-blk",
  kind: "initiative",
  title: "Blocked initiative",
  state: "Blocked",
  parentId: null,
  dependsOn: [],
  goal: "Blocked.",
  steps: [],
  validationCriteria: [],
  verificationCommand: null,
  repositoryBindingId: null,
  priority: 0,
  attemptCounter: 1,
  currentRevisionId: "rev-blk",
};

function renderScreen() {
  render(
    <MemoryRouter>
      <MissionScreen />
    </MemoryRouter>,
  );
}

describe("MissionScreen tree nesting", () => {
  it("renders initiative, its objective child, and the task grandchild", async () => {
    vi.mocked(listNodes).mockResolvedValue([initiative, objective, task]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Onboarding")).toBeInTheDocument();
    });

    expect(screen.getByText("Add recovery codes")).toBeInTheDocument();
    expect(screen.getByText("Generate codes")).toBeInTheDocument();
  });

  it("links each node to /mission/:nodeId", async () => {
    vi.mocked(listNodes).mockResolvedValue([initiative]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Onboarding" })).toHaveAttribute(
        "href",
        "/mission/ini-1",
      );
    });
  });

  it("shows no state badge for a task", async () => {
    vi.mocked(listNodes).mockResolvedValue([initiative, objective, task]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Generate codes")).toBeInTheDocument();
    });

    const taskLink = screen.getByRole("link", { name: "Generate codes" });
    const taskRow = taskLink.closest("div");
    expect(taskRow).not.toBeNull();
    expect(taskRow?.textContent).not.toMatch(/Blocked|Completed/);
  });
});

describe("MissionScreen dependency overlay", () => {
  it("shows dependency info for a node with dependsOn", async () => {
    vi.mocked(listNodes).mockResolvedValue([initiative, objective]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Add recovery codes")).toBeInTheDocument();
    });

    expect(screen.getByLabelText("Depends on")).toBeInTheDocument();
  });

  it("shows no dependency overlay when dependsOn is empty", async () => {
    vi.mocked(listNodes).mockResolvedValue([initiative]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Onboarding")).toBeInTheDocument();
    });

    expect(screen.queryByLabelText("Depends on")).toBeNull();
  });

  it("marks a Completed dependency as satisfied and a non-Completed one as not done", async () => {
    const pendingDep: MissionNode = {
      ...initiative,
      id: "ini-2",
      title: "Pending dep",
      state: "Pending",
    };
    const node: MissionNode = {
      ...objective,
      dependsOn: ["ini-1", "ini-2"],
    };

    vi.mocked(listNodes).mockResolvedValue([initiative, pendingDep, node]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByLabelText("Depends on")).toBeInTheDocument();
    });

    expect(screen.getByText(/Onboarding.*✓/)).toBeInTheDocument();
    expect(screen.getByText(/Pending dep.*not Completed/)).toBeInTheDocument();
  });
});

describe("MissionScreen state filter", () => {
  it("shows all nodes when no state filter is active", async () => {
    vi.mocked(listNodes).mockResolvedValue([completedRoot, blockedRoot]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("Completed initiative")).toBeInTheDocument();
    });

    expect(screen.getByText("Blocked initiative")).toBeInTheDocument();
  });

  it("hides root nodes that do not match the active state filter", async () => {
    vi.mocked(listNodes).mockResolvedValue([completedRoot, blockedRoot]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Blocked/ })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Blocked/ }));

    expect(screen.getByText("Blocked initiative")).toBeInTheDocument();
    expect(screen.queryByText("Completed initiative")).not.toBeInTheDocument();
  });

  it("keeps ancestor visible when a descendant matches the filter", async () => {
    vi.mocked(listNodes).mockResolvedValue([initiative, objective]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Blocked/ })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /Blocked/ }));

    expect(screen.getByText("Add recovery codes")).toBeInTheDocument();
    expect(screen.getByText("Onboarding")).toBeInTheDocument();
  });

  it("filters by title text and hides non-matching root nodes", async () => {
    vi.mocked(listNodes).mockResolvedValue([completedRoot, blockedRoot]);
    renderScreen();

    await waitFor(() => {
      expect(screen.getByRole("searchbox", { name: "Filter by title" })).toBeInTheDocument();
    });

    await userEvent.type(screen.getByRole("searchbox", { name: "Filter by title" }), "Blocked");

    expect(screen.getByText("Blocked initiative")).toBeInTheDocument();
    expect(screen.queryByText("Completed initiative")).not.toBeInTheDocument();
  });
});
