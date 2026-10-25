import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/mission", () => ({
  listNodeAttempts: vi.fn(),
  readNodeRevision: vi.fn(),
}));

import { listNodeAttempts, readNodeRevision } from "@/api/resources/mission";
import type { MissionAttempt, MissionRevision, TraceSummary } from "@/api/types";

import { PlanBlock } from "./plan-block";

const SUMMARY = {
  trace_id: "trace-1",
  project_id: "project_1",
  node_id: "node_1",
  attempt: 1,
} as TraceSummary;

const REVISION = {
  node_id: "node_1",
  revision: 2,
  content: {
    name: "Ship it",
    requirement: "Build the thing",
    criterion: "The thing works",
    verifications: [],
  },
  tasks: [{ id: "task_a", filename: "a.md", content: { name: "Write code" } }],
} as unknown as MissionRevision;

afterEach(() => {
  vi.resetAllMocks();
});

describe("PlanBlock", () => {
  it("shows the node at its revision with the task states and the node link", async () => {
    vi.mocked(listNodeAttempts).mockResolvedValue([
      { node_id: "node_1", attempt: 1, node_revision: 2 } as MissionAttempt,
    ]);
    vi.mocked(readNodeRevision).mockResolvedValue(REVISION);
    render(
      <MemoryRouter>
        <PlanBlock summary={SUMMARY} spans={[]} />
      </MemoryRouter>,
    );
    expect(await screen.findByText("The plan Ship it (v2)")).toBeInTheDocument();
    expect(screen.getByText("Write code open")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open node" })).toHaveAttribute(
      "href",
      "/projects/project_1?node=node_1",
    );
  });

  it("reveals the whole requirement on More", async () => {
    vi.mocked(listNodeAttempts).mockResolvedValue([
      { node_id: "node_1", attempt: 1, node_revision: 2 } as MissionAttempt,
    ]);
    vi.mocked(readNodeRevision).mockResolvedValue(REVISION);
    render(
      <MemoryRouter>
        <PlanBlock summary={SUMMARY} spans={[]} />
      </MemoryRouter>,
    );
    const more = await screen.findByRole("button", { name: "More requirement" });
    await userEvent.click(more);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Less requirement" })).toHaveAttribute(
        "aria-expanded",
        "true",
      ),
    );
  });
});
