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
    execution_id: executionId,
    project_id: "prj-test",
    node_id: "node_reset",
    claimant: {
      worker_binding_id: "binding_tdd_main",
      resource_identity: "worker:kanthord:tdd-main",
      runtime_identity: "worker_instance_01",
    },
    attempt: 2,
    pinned_revision: 3,
    credentials: [],
    claim_state: "running",
    expired_at: now + 120_000,
    created_at: now - 600_000,
    ended_at: null,
    trace_id: "0".repeat(31) + "1",
    root_span_id: "0".repeat(15) + "1",
    ...overrides,
  };
}

function mockExecutions(executions: readonly SchedulerExecutionRecord[]) {
  vi.mocked(listProjectExecutions).mockResolvedValue(executions);
  vi.mocked(readMission).mockResolvedValue({ id: "mission_1", project_id: "prj-test", version: 1 });
  vi.mocked(listMissionNodes).mockResolvedValue([
    {
      id: "node_reset",
      filename: "add-password-reset.md",
      mission_id: "mission_1",
      parent_id: null,
      visible_revision: 3,
      content: {
        name: "Add password reset",
        requirement: "",
        criterion: "",
        verifications: [],
        bindings: [],
      },
      retired_at: null,
      pinned_by_attempts: [2],
      kind: "objective",
      state: "Executing",
      attempt: 2,
      priority: 0,
      depends_on: [],
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
      execution("execution_done", { claim_state: "finished", ended_at: now - 60_000 }),
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
    mockExecutions([execution("execution_lost", { claim_state: "lost", ended_at: now })]);

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
        claim_state: "finished",
        ended_at: now - 60_000,
        claimant: {
          worker_binding_id: "binding_tdd_main",
          resource_identity: "worker:kanthord:tdd-main",
          runtime_identity: "worker_instance_02",
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
