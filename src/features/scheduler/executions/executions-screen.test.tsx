import { render, screen, waitFor, within } from "@testing-library/react";
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

    expect(screen.getByRole("radio", { name: "Live" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "All" }));

    await waitFor(() => {
      expect(vi.mocked(listExecutions)).toHaveBeenCalledWith("prj-test", "all");
    });
  });

  it("names a running claim with its fixed deadline and no renewal", async () => {
    vi.mocked(listExecutions).mockResolvedValue([execution("run")]);

    renderScreen();

    const item = await screen.findByRole("listitem");
    expect(within(item).getByText("Running")).toBeInTheDocument();
    expect(within(item).getByText("Deadline in 2m")).toBeInTheDocument();
    expect(within(item).getByText("Execution run")).toBeInTheDocument();
    expect(within(item).getByText("Binding bnd-wkr-general · runtime rt-0001")).toBeInTheDocument();
    expect(
      within(item).getByText("steps claim · attempt att-run · pinned revision rev-run"),
    ).toBeInTheDocument();
    expect(within(item).queryByText(/renew/i)).toBeNull();
  });

  it("names a claim past its deadline as lost without claiming the runtime failed", async () => {
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

    expect(await screen.findByText("Lost")).toBeInTheDocument();
    expect(screen.getByText("Expiry is not proof that the runtime stopped.")).toBeInTheDocument();
    expect(screen.queryAllByText(/failed/i)).toHaveLength(0);
    expect(screen.queryAllByText(/at risk/i)).toHaveLength(0);
  });

  it("names a claim that ended before its deadline as finished", async () => {
    vi.mocked(listExecutions).mockResolvedValue([
      execution("done", {
        live: false,
        endedAt: at(1),
        claimantKind: "client identity",
        claimantId: "client-1",
        instanceRuntimeId: null,
      }),
    ]);

    renderScreen();

    expect(await screen.findByText("Finished")).toBeInTheDocument();
    expect(screen.getByText("Client identity client-1")).toBeInTheDocument();
  });

  it("marks over-budget execution and caps the reported percentage at 100", async () => {
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

    const item = await screen.findByRole("listitem");
    expect(within(item).getByRole("link", { name: "Node over" })).toBeInTheDocument();

    expect(screen.getByText("Over budget")).toBeInTheDocument();
    expect(screen.getByText("Wall time 2h 20m / 2h 0m (100%, over budget)")).toBeInTheDocument();
    expect(screen.getByText("Turns 88 / 200 (44%)")).toBeInTheDocument();
  });
});
