import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { Project } from "@/api/types";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";
import type { CoolingFact } from "@/lib/overview-summary";

import { BoardSummary } from "./board-summary";

const ATLAS: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const SUMMARY = {
  long: "2 acts wait for you. 3 nodes wait on them. Start here: Ship the release in Rule.",
  short: "2 acts · 3 nodes wait · Start: Ship the release",
};

const COOLING: CoolingFact = {
  key: "prj-1:b1:swe@1",
  agent: "swe@1",
  binding: "main",
  project: ATLAS,
  availableAt: Date.UTC(2026, 0, 2, 3, 4),
};

function renderSummary(
  widthClass: BoardWidth,
  cooling: readonly CoolingFact[] = [],
  startSubject: string | null = "Ship the release",
) {
  const onStart = vi.fn();
  render(
    <MemoryRouter>
      <BoardSummary
        summary={SUMMARY}
        widthClass={widthClass}
        startSubject={startSubject}
        workforce="1 execution runs · 2 jobs wait"
        cooling={cooling}
        showProject
        onStart={onStart}
      />
    </MemoryRouter>,
  );
  return onStart;
}

describe("BoardSummary", () => {
  it("shows the long form on expanded width", () => {
    renderSummary(BOARD_WIDTH.Expanded);

    expect(screen.getByText(/Start here:/)).toHaveTextContent(SUMMARY.long);
  });

  it("shows the long form on medium width", () => {
    renderSummary(BOARD_WIDTH.Medium);

    expect(screen.getByText(/Start here:/)).toHaveTextContent(SUMMARY.long);
  });

  it("shows the short form on compact width", () => {
    renderSummary(BOARD_WIDTH.Compact);

    expect(screen.getByText(/Start:/)).toHaveTextContent(SUMMARY.short);
    expect(screen.queryByText(/Start here:/)).not.toBeInTheDocument();
  });

  it("makes the Start here subject a button", async () => {
    const onStart = renderSummary(BOARD_WIDTH.Expanded);

    await userEvent.setup().click(screen.getByRole("button", { name: "Ship the release" }));

    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("shows plain text when no subject starts", () => {
    renderSummary(BOARD_WIDTH.Expanded, [], null);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(SUMMARY.long)).toBeVisible();
  });

  it("shows the workforce fact", () => {
    renderSummary(BOARD_WIDTH.Expanded);

    expect(screen.getByText("1 execution runs · 2 jobs wait")).toBeVisible();
  });

  it("shows a cooling line with the agent link", () => {
    renderSummary(BOARD_WIDTH.Expanded, [COOLING]);

    expect(screen.getByRole("link", { name: "swe@1" })).toHaveAttribute("href", "/agents/swe%401");
    expect(screen.getByText(/every model cools down until/)).toHaveTextContent(
      "swe@1 in main of atlas: every model cools down until",
    );
  });
});
