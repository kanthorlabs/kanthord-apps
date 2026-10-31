import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { Project } from "@/api/types";
import { BOARD_TABS, type BoardTabId } from "@/lib/board-tabs";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import type { BoardCounts } from "../use-board";
import { BoardFilter } from "./board-filter";

const ATLAS: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const BETA: Project = { ...ATLAS, id: "prj-2", name: "beta" };

const RESUME = (() => {
  const tab = BOARD_TABS.find((entry) => entry.id === "paused");
  if (tab === undefined) throw new Error("No Resume tab.");
  return tab;
})();

function countsOf(resume: number, view: number): BoardCounts {
  const zero: Record<BoardTabId, number> = {
    tool: 0,
    setup: 0,
    paused: resume,
    proposal: 0,
    blocked: 0,
    outside: 0,
  };
  return {
    tabs: zero,
    held: zero,
    view,
    all: 8,
    projects: { "prj-1": 5, "prj-2": 4 },
  };
}

function Harness({ widthClass = BOARD_WIDTH.Expanded }: { readonly widthClass?: BoardWidth }) {
  const [projectId, setProjectId] = useState<string | null>(null);
  return (
    <BoardFilter
      projects={[ATLAS, BETA]}
      counts={projectId === ATLAS.id ? countsOf(2, 5) : countsOf(3, 8)}
      projectId={projectId}
      tab={RESUME}
      widthClass={widthClass}
      onChange={setProjectId}
    />
  );
}

describe("BoardFilter", () => {
  it("shows All first, then one item for each project, with counts", () => {
    render(<Harness />);

    const names = screen.getAllByRole("button").map((button) => button.textContent);

    expect(names).toEqual(["All · 8", "atlas · 5", "beta · 4"]);
    expect(screen.getByRole("button", { name: "All · 8" })).toHaveAttribute("aria-pressed", "true");
  });

  it("says nothing before the first change", () => {
    render(<Harness />);

    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("scopes to a project and announces the counts", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "atlas · 5" }));

    expect(screen.getByRole("button", { name: "atlas · 5" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "atlas: 2 acts in Resume, 5 acts in all tabs.",
    );
  });

  it("returns to All on a press of the pressed item", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "atlas · 5" }));
    await user.click(screen.getByRole("button", { name: "atlas · 5" }));

    expect(screen.getByRole("button", { name: "All · 8" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      "All projects: 3 acts in Resume, 8 acts in all tabs.",
    );
  });

  it("keeps the same items on compact width", () => {
    render(<Harness widthClass={BOARD_WIDTH.Compact} />);

    expect(screen.getAllByRole("button")).toHaveLength(3);
  });
});
