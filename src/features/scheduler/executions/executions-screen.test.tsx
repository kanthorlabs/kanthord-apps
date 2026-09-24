import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/scheduler", () => ({
  listQueue: vi.fn(),
  readEligibility: vi.fn(),
  listExecutions: vi.fn(),
}));

vi.mock("@/features/projects/project-context", () => ({
  useProjectId: () => "prj-test",
}));

import { listExecutions } from "@/api/resources/scheduler";
import type { Execution } from "@/api/types";

import { ExecutionsScreen } from "./executions-screen";

const now = Date.now();
const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

function execution(id: string, overrides: Partial<Execution> = {}): Execution {
  return {
    id,
    projectId: "prj-test",
    claimantKind: "worker binding",
    claimantId: "bnd-wkr-general",
    instanceRuntimeId: "rt-0001",
    nodeId: `node-${id}`,
    nodeTitle: `Node ${id}`,
    attemptId: `att-${id}`,
    pinnedRevisionId: `rev-${id}`,
    claimKind: "steps",
    lease: {
      expiresAt: new Date(now + 120_000).toISOString(),
      renewedAt: at(0.5),
    },
    live: true,
    startedAt: at(10),
    endedAt: null,
    turnsUsed: 10,
    turnBudget: 200,
    wallTimeUsedSeconds: 600,
    wallTimeBudgetSeconds: 7200,
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <ExecutionsScreen />
    </MemoryRouter>,
  );
}

describe("ExecutionsScreen", () => {
  it("defaults to live scope and switches to all on toggle", async () => {
    const user = userEvent.setup();

    vi.mocked(listExecutions).mockResolvedValue([execution("live1")]);

    renderScreen();

    await screen.findAllByText("Node live1");

    expect(vi.mocked(listExecutions)).toHaveBeenCalledWith("prj-test", "live");

    const allBtn = screen.getByRole("button", { name: "All" });
    await user.click(allBtn);

    await waitFor(() => {
      expect(vi.mocked(listExecutions)).toHaveBeenCalledWith("prj-test", "all");
    });
  });

  it("renders expired lease as at risk", async () => {
    vi.mocked(listExecutions).mockResolvedValue([
      execution("expired", {
        lease: {
          expiresAt: new Date(now - 30_000).toISOString(),
          renewedAt: at(5),
        },
        live: true,
      }),
    ]);

    renderScreen();

    await screen.findAllByText("Node expired");
    expect(screen.getAllByText(/Lease expired/)).not.toHaveLength(0);
    expect(screen.queryAllByText(/at risk/i)).toHaveLength(0);
  });

  it("expired-lease badge names the observable fact without claiming the execution failed or stopped", async () => {
    vi.mocked(listExecutions).mockResolvedValue([
      execution("fact", {
        lease: {
          expiresAt: new Date(now - 30_000).toISOString(),
          renewedAt: at(5),
        },
        live: true,
      }),
    ]);

    renderScreen();

    await screen.findAllByText("Node fact");

    expect(screen.queryAllByText(/at risk/i)).toHaveLength(0);
    expect(screen.queryAllByText(/failed/i)).toHaveLength(0);
    expect(screen.queryAllByText(/stopped/i)).toHaveLength(0);
    expect(screen.getAllByText(/Lease expired/)).not.toHaveLength(0);
  });

  it("marks over-budget execution and caps the progress bar at 100", async () => {
    vi.mocked(listExecutions).mockResolvedValue([
      execution("over", {
        turnsUsed: 88,
        turnBudget: 200,
        wallTimeUsedSeconds: 8400,
        wallTimeBudgetSeconds: 7200,
        live: false,
        lease: null,
        endedAt: at(0),
      }),
    ]);

    renderScreen();

    await screen.findAllByText("Node over");

    expect(screen.getAllByText(/Over budget/)).not.toHaveLength(0);

    const bars = screen.getAllByRole("progressbar", {
      name: /Wall time used:/i,
    });
    for (const bar of bars) {
      expect(Number(bar.getAttribute("aria-valuenow"))).toBeLessThanOrEqual(100);
    }
  });
});
