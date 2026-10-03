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

import { listQueue, readEligibility } from "@/api/resources/scheduler";
import type { WorkQueueEntry } from "@/api/types";

import { SchedulerScreen } from "./scheduler-screen";

const now = Date.now();
const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

function entry(id: string, overrides: Partial<WorkQueueEntry> = {}): WorkQueueEntry {
  return {
    id,
    nodeId: `node-${id}`,
    nodeTitle: `Node ${id}`,
    admittedClaimKind: "steps",
    priority: 0,
    createdAt: at(1),
    heldOut: false,
    waitFact: null,
    ...overrides,
  };
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <SchedulerScreen />
    </MemoryRouter>,
  );
}

describe("SchedulerScreen", () => {
  it("renders queue in priority-descending then age-ascending order", async () => {
    vi.mocked(listQueue).mockResolvedValue([
      entry("C", { priority: 1, createdAt: at(5) }),
      entry("B", { priority: 3, createdAt: at(10) }),
      entry("A", { priority: 3, createdAt: at(20) }),
    ]);

    renderScreen();

    const links = await screen.findAllByRole("link");
    expect(links[0]?.textContent).toContain("Node A");
    expect(links[1]?.textContent).toContain("Node B");
    expect(links[2]?.textContent).toContain("Node C");
  });

  it("shows wait fact on a held-out entry", async () => {
    vi.mocked(listQueue).mockResolvedValue([
      entry("held", {
        heldOut: true,
        waitFact: "The landing observation of pull request 42.",
      }),
      entry("free"),
    ]);

    renderScreen();

    const items = await screen.findAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Node held");
    expect(within(items[0]!).getByText("Held out")).toBeInTheDocument();
    expect(
      within(items[0]!).getByText("Waits for: The landing observation of pull request 42."),
    ).toBeInTheDocument();
    expect(within(items[1]!).getByText("Claimable")).toBeInTheDocument();
  });

  it("names priority, claim kind and queue age in that order", async () => {
    vi.mocked(listQueue).mockResolvedValue([
      entry("one", { priority: 2, admittedClaimKind: "evaluation" }),
    ]);

    renderScreen();

    expect(await screen.findByText(/^Priority 2 · evaluation claim · queued /)).toBeInTheDocument();
  });

  it("held-out filter shows only held-out entries", async () => {
    const user = userEvent.setup();

    vi.mocked(listQueue).mockResolvedValue([
      entry("held", { heldOut: true, waitFact: "Wait reason." }),
      entry("free"),
    ]);

    renderScreen();

    await screen.findAllByText("Node held");
    await screen.findAllByText("Node free");

    await user.click(screen.getByText("Held out only", { selector: "label" }));

    await waitFor(() => {
      expect(screen.queryByText("Node free")).toBeNull();
    });
    expect(screen.getAllByText("Node held")).not.toHaveLength(0);
  });

  it("admission conditions dialog names the failing condition first", async () => {
    const user = userEvent.setup();

    vi.mocked(listQueue).mockResolvedValue([entry("revoke", { nodeId: "obj-revoke" })]);

    vi.mocked(readEligibility).mockResolvedValue({
      nodeId: "obj-revoke",
      checks: [
        {
          name: "The entry is not held out",
          holds: true,
          detail: "No wait record.",
        },
        {
          name: "The claimant is below its count",
          holds: false,
          detail: "2 live executions against count of 2.",
        },
      ],
    });

    renderScreen();

    await screen.findAllByText("Node revoke");

    await user.click(
      screen.getByRole("button", { name: "Show admission conditions for Node revoke" }),
    );

    const dialog = await screen.findByRole("dialog");
    const list = within(dialog).getByRole("list", { name: "Admission conditions" });
    const items = within(list).getAllByRole("listitem");

    expect(items[0]?.textContent).toContain("2 live executions against count of 2.");
    expect(items[1]?.textContent).toContain("No wait record.");
  });
});
