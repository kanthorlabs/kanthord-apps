import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { BOARD_TAB, type BoardTabId } from "@/lib/board-tabs";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import type { BoardCounts } from "../use-board";
import { BoardTabs } from "./board-tabs";

const COUNTS: BoardCounts = {
  tabs: { tool: 1, setup: 2, paused: 3, proposal: 0, blocked: 4, outside: 5 },
  held: { tool: 1, setup: 2, paused: 3, proposal: 0, blocked: 4, outside: 5 },
  view: 15,
  all: 15,
  projects: {},
};

function Harness({
  allProjects = false,
  widthClass = BOARD_WIDTH.Expanded,
  onChange = () => undefined,
}: {
  readonly allProjects?: boolean;
  readonly widthClass?: BoardWidth;
  readonly onChange?: (tab: BoardTabId) => void;
}) {
  const [tab, setTab] = useState<BoardTabId>(BOARD_TAB.Tool);
  return (
    <BoardTabs
      tab={tab}
      counts={COUNTS}
      allProjects={allProjects}
      widthClass={widthClass}
      onChange={(next) => {
        setTab(next);
        onChange(next);
      }}
    >
      <p>panel</p>
    </BoardTabs>
  );
}

describe("BoardTabs", () => {
  it("shows the six tabs in order with their accessible names", () => {
    render(<Harness />);

    expect(screen.getAllByRole("tab").map((tab) => tab.getAttribute("aria-label"))).toEqual([
      "Approve tool, 1 act",
      "Fix setup, 2 acts",
      "Resume, 3 acts",
      "Decide proposal, 0 acts, clear",
      "Rule, 4 acts",
      "Act outside, 5 acts",
    ]);
  });

  it("names the tool tab with all projects under a filter", () => {
    render(<Harness allProjects />);

    expect(screen.getByRole("tab", { name: "Approve tool, 1 act, all projects" })).toBeVisible();
    expect(screen.getByText("all projects · 1 node waits")).toBeVisible();
  });

  it("keeps a zero tab with 0 and clear", () => {
    render(<Harness />);

    const tab = screen.getByRole("tab", { name: "Decide proposal, 0 acts, clear" });

    expect(tab).toHaveTextContent("0");
    expect(tab).toHaveTextContent("clear");
  });

  it("holds the name, the count and the sub line of the wide strip", () => {
    render(<Harness />);

    const tab = screen.getByRole("tab", { name: "Rule, 4 acts" });

    expect(tab).toHaveTextContent("Rule");
    expect(tab).toHaveTextContent("4");
    expect(tab).toHaveTextContent("4 nodes wait");
  });

  it("holds the short names and the six-cell grid of the narrow strip", () => {
    render(<Harness />);

    expect(screen.getByRole("tablist")).toHaveClass(
      "@max-[760px]:grid",
      "@max-[760px]:grid-cols-6",
    );
    for (const short of ["Tool", "Setup", "Resume", "Decide", "Rule", "Outside"]) {
      expect(screen.getAllByText(short).length).toBeGreaterThan(0);
    }
  });

  it("activates the next tab on the arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);

    screen.getByRole("tab", { name: "Approve tool, 1 act" }).focus();
    await user.keyboard("{ArrowRight}");
    await user.keyboard("{ArrowRight}");

    expect(onChange).toHaveBeenNthCalledWith(1, "setup");
    expect(onChange).toHaveBeenNthCalledWith(2, "paused");
    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("setup");
  });

  it("renders the panel children", () => {
    render(<Harness widthClass={BOARD_WIDTH.Compact} />);

    expect(screen.getByText("panel")).toBeVisible();
  });
});
