import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/scheduler", () => ({
  listProjectExecutions: vi.fn(),
}));

vi.mock("@/api/resources/mission", () => ({
  readMission: vi.fn(),
  listMissionNodes: vi.fn(),
}));

vi.mock("@/features/projects/project-context", () => ({
  useProjectId: () => "prj-test",
}));

import { listMissionNodes, readMission } from "@/api/resources/mission";
import { listProjectExecutions } from "@/api/resources/scheduler";
import type { SchedulerExecutionRecord } from "@/api/types";
import { utcDateTime } from "@/lib/format";

import { ExecutionsScreen } from "./executions-screen";

const now = Date.now();

function execution(
  executionId: string,
  overrides: Partial<SchedulerExecutionRecord> = {},
): SchedulerExecutionRecord {
  return {
    executionId,
    projectId: "prj-test",
    nodeId: "node_reset",
    claimant: {
      workerBindingId: "binding_tdd_main",
      resourceIdentity: "worker:kanthord:tdd-main",
      runtimeIdentity: "worker_instance_01",
    },
    attempt: 2,
    pinnedRevision: 3,
    credentials: [],
    claimState: "running",
    expiredAt: now + 120_000,
    createdAt: now - 600_000,
    endedAt: null,
    traceId: "0".repeat(31) + "1",
    rootSpanId: "0".repeat(15) + "1",
    ...overrides,
  };
}

function mockExecutions(executions: readonly SchedulerExecutionRecord[]) {
  vi.mocked(listProjectExecutions).mockResolvedValue(executions);
  vi.mocked(readMission).mockResolvedValue({ id: "mission_1", projectId: "prj-test", version: 1 });
  vi.mocked(listMissionNodes).mockResolvedValue([
    {
      id: "node_reset",
      filename: "add-password-reset.md",
      missionId: "mission_1",
      parentId: null,
      visibleRevision: 3,
      content: {
        name: "Add password reset",
        requirement: "",
        criterion: "",
        verifications: [],
        bindings: [],
      },
      retiredAt: null,
      pinnedByAttempts: [2],
      kind: "objective",
      state: "Executing",
      attempt: 2,
      priority: 0,
    },
  ]);
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <ExecutionsScreen />
    </MemoryRouter>,
  );
}

describe("ExecutionsScreen", () => {
  it("defaults to live scope and shows every claim state under all", async () => {
    const user = userEvent.setup();
    mockExecutions([
      execution("execution_live"),
      execution("execution_done", { claimState: "finished", endedAt: now - 60_000 }),
    ]);

    renderScreen();

    expect(await screen.findByText("Execution execution_live")).toBeInTheDocument();
    expect(screen.queryByText("Execution execution_done")).toBeNull();
    expect(screen.getByRole("button", { name: "Live", pressed: true })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "All" }));

    expect(await screen.findByText("Execution execution_done")).toBeInTheDocument();
    expect(listProjectExecutions).toHaveBeenCalledWith("prj-test");
  });

  it("names a running claim with its node, claimant and fixed deadline", async () => {
    mockExecutions([execution("execution_run")]);

    renderScreen();

    const item = await screen.findByRole("listitem");
    expect(within(item).getByRole("link", { name: "Add password reset" })).toHaveAttribute(
      "href",
      "/projects/prj-test",
    );
    expect(within(item).getByText("Running")).toBeInTheDocument();
    expect(within(item).getByText(`Deadline ${utcDateTime(now + 120_000)}`)).toBeInTheDocument();
    expect(
      within(item).getByText("Binding binding_tdd_main · runtime worker_instance_01"),
    ).toBeInTheDocument();
    expect(within(item).getByText("Attempt 2 · pinned revision 3")).toBeInTheDocument();
    expect(within(item).queryByText(/renew/i)).toBeNull();
  });

  it("names a lost claim without claiming the runtime failed", async () => {
    const user = userEvent.setup();
    mockExecutions([execution("execution_lost", { claimState: "lost", endedAt: now })]);

    renderScreen();
    await user.click(await screen.findByRole("button", { name: "All" }));

    expect(await screen.findByText("Lost")).toBeInTheDocument();
    expect(screen.getByText("Expiry is not proof that the runtime stopped.")).toBeInTheDocument();
    expect(screen.queryAllByText(/failed/i)).toHaveLength(0);
  });

  it("names a finished claim with its end time and the claimant name", async () => {
    const user = userEvent.setup();
    mockExecutions([
      execution("execution_done", {
        claimState: "finished",
        endedAt: now - 60_000,
        claimant: {
          workerBindingId: "binding_tdd_main",
          resourceIdentity: "worker:kanthord:tdd-main",
          runtimeIdentity: "worker_instance_02",
          name: "claude-code",
        },
      }),
    ]);

    renderScreen();
    await user.click(await screen.findByRole("button", { name: "All" }));

    expect(await screen.findByText("Finished")).toBeInTheDocument();
    expect(screen.getByText(`Ended ${utcDateTime(now - 60_000)}`)).toBeInTheDocument();
    expect(screen.getByText("Binding binding_tdd_main · runtime claude-code")).toBeInTheDocument();
  });
});
