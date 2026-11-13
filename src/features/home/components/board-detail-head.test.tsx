import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MissionNodeRecord, Project } from "@/api/types";
import type { BlockedItem } from "@/lib/attention";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import { BoardDetailHead } from "./board-detail-head";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const TEAM: MissionNodeRecord = {
  id: "node_1",
  intent: "implement",
  tags: [],
  tasks: [],
  filename: "node_1.md",
  mission_id: "mission_1",
  visible_revision: 1,
  content: {
    name: "Team",
    requirement: "r",
    criterion: "c",
    verifications: [],
    bindings: [],
    intent: "implement",
    tags: [],
  },
  retired_at: null,
  pinned_by_attempts: [],
  pinned_revision: null,
  state: "Blocked",
  attempt: 2,
  priority: 0,
  depends_on: [],
};

const BLOCKED: BlockedItem = {
  id: "blocked:node_1",
  kind: "blocked",
  group: "decisions",
  project: PROJECT,
  subject: "Team",
  missionVersion: 7,
  node: TEAM,
  nodes: [TEAM],
  at: null,
  cause: "Criterion not met",
};

function renderHead(widthClass: BoardWidth = BOARD_WIDTH.Expanded) {
  render(
    <BoardDetailHead
      item={BLOCKED}
      details={new Map()}
      tabName="Rule"
      widthClass={widthClass}
      position={{ index: 1, total: 3 }}
      now={10_000_000}
      titleId="detail-title"
      titleRef={() => undefined}
    />,
  );
}

describe("BoardDetailHead", () => {
  it("shows the title from detailTitleOf", () => {
    renderHead();

    expect(
      screen.getByRole("heading", { level: 3, name: "Team: criterion not met" }),
    ).toHaveAttribute("id", "detail-title");
  });

  it("shows the header facts", () => {
    renderHead();

    expect(screen.getByText("kanthord")).toBeVisible();
    expect(screen.getByText("Rule")).toBeVisible();
    expect(screen.getByText("Blocked")).toBeVisible();
    expect(screen.getByText("age unknown")).toBeVisible();
  });

  it("shows the position on expanded width only", () => {
    renderHead();
    expect(screen.getByText("2 of 3")).toBeVisible();
  });

  it("leaves out the position on medium width", () => {
    renderHead(BOARD_WIDTH.Medium);
    expect(screen.queryByText("2 of 3")).not.toBeInTheDocument();
  });
});
