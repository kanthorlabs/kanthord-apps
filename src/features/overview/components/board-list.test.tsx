import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MissionNodeRecord, Project } from "@/api/types";
import { Tabs } from "@/components/ui/tabs";
import { type AttentionItem, deriveAttention } from "@/lib/attention";
import type { DoneEntry } from "@/lib/board-done";
import { BOARD_TABS, type BoardTab, type BoardTabId } from "@/lib/board-tabs";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import { BoardList } from "./board-list";

const NOW = 10_000_000;

const ATLAS: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

function tabNamed(id: BoardTabId): BoardTab {
  const tab = BOARD_TABS.find((entry) => entry.id === id);
  if (tab === undefined) throw new Error(`No tab ${id}.`);
  return tab;
}

const RULE = tabNamed("blocked");
const RESUME = tabNamed("paused");
const TOOL = tabNamed("tool");

function blocked(id: string, name: string, createdAt: number): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name,
      requirement: "",
      criterion: "",
      verifications: [],
      bindings: [],
      intent: "implement",
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    pinned_revision: null,
    intent: "implement",
    tags: [],
    tasks: [],
    state: "Blocked",
    attempt: 2,
    priority: 0,
    depends_on: [],
    blocked_context: {
      outcome: {
        id: `outcome_${id}`,
        node_id: id,
        attempt: 2,
        node_revision: 1,
        closing_event: "human-block",
        result: "undetermined",
        assessment_id: `assessment_${id}`,
        evidence_ids: [],
        created_at: createdAt,
      },
      requests: [],
    },
  };
}

const ITEMS: readonly AttentionItem[] = deriveAttention(
  [
    {
      project: ATLAS,
      missionVersion: 1,
      nodes: [blocked("b1", "Ship the release", 100), blocked("b2", "Fix the build", 200)],
      jobs: null,
      registrations: null,
      executions: null,
      bindings: null,
      environments: null,
    },
  ],
  new Map(),
  { now: NOW, catalog: null, credentials: [], sessions: null },
);

type ListProps = Parameters<typeof BoardList>[0];

function renderList(
  overrides: Partial<ListProps> = {},
  widthClass: BoardWidth = BOARD_WIDTH.Medium,
) {
  const props: ListProps = {
    tab: RULE,
    cards: ITEMS,
    done: [],
    selectedId: null,
    widthClass,
    projectName: null,
    hiddenByFilter: false,
    allClear: false,
    nothingAtAll: false,
    start: ITEMS[0] ?? null,
    workforce: "0 executions run · 0 jobs wait",
    now: NOW,
    held: new Map(),
    gates: new Map(),
    leadLabelOf: () => null,
    onSelect: vi.fn(),
    onShowAll: vi.fn(),
    onGoToStart: vi.fn(),
    onGoToTab: vi.fn(),
    cardRef: () => () => undefined,
    allClearRef: () => undefined,
    ...overrides,
  };
  render(
    <Tabs value={props.tab.id}>
      <BoardList {...props} />
    </Tabs>,
  );
  return props;
}

describe("BoardList", () => {
  it("lists the cards in the given rank order", () => {
    renderList();

    const names = within(screen.getByRole("list"))
      .getAllByRole("button")
      .map((button) => button.textContent);

    expect(names).toEqual(["Ship the release", "Fix the build"]);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("names the panel and describes it with the verb line", () => {
    renderList({}, BOARD_WIDTH.Expanded);

    const panel = screen.getByRole("tabpanel");

    expect(panel).toHaveAccessibleDescription("Act on the stopped node.");
    expect(screen.getByRole("heading", { name: "Rule", level: 3 })).toBeInTheDocument();
  });

  it("makes the panel a tab stop only when it holds no card", () => {
    renderList({ tab: RESUME, cards: [] });

    expect(screen.getByRole("tabpanel")).toHaveAttribute("tabindex", "0");
  });

  it("gives the list one tab stop on the selected card", () => {
    renderList({ selectedId: "blocked:b2" });

    expect(screen.getByRole("tabpanel")).not.toHaveAttribute("tabindex");
    expect(screen.getByRole("button", { name: "Fix the build" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("button", { name: "Ship the release" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("gives the tab stop to the first card when no listed card is selected", () => {
    renderList({ selectedId: "blocked:gone" });

    expect(screen.getByRole("button", { name: "Ship the release" })).toHaveAttribute(
      "tabindex",
      "0",
    );
    expect(screen.getByRole("button", { name: "Fix the build" })).toHaveAttribute("tabindex", "-1");
  });

  it("adds the what sentence on medium width only", () => {
    renderList({}, BOARD_WIDTH.Medium);

    expect(screen.getByRole("tabpanel")).toHaveAccessibleDescription(`${RULE.verb} ${RULE.what}`);
  });

  it("leaves out the what sentence on compact width", () => {
    renderList({}, BOARD_WIDTH.Compact);

    expect(screen.getByRole("tabpanel")).toHaveAccessibleDescription(RULE.verb);
  });

  it("adds the all projects note to the tool verb line under a filter", () => {
    renderList({ tab: TOOL, cards: [], projectName: "atlas" }, BOARD_WIDTH.Expanded);

    expect(screen.getByRole("tabpanel")).toHaveAccessibleDescription(
      `${TOOL.verb} Counts all projects.`,
    );
  });

  it("shows the empty tab with the what text and both ways out", async () => {
    const props = renderList({
      tab: RESUME,
      cards: [],
      projectName: "atlas",
      hiddenByFilter: true,
    });
    const user = userEvent.setup();

    expect(screen.getByText("Nothing waits in Resume in atlas.")).toBeVisible();
    expect(screen.getByText(RESUME.what)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Show all projects" }));
    await user.click(screen.getByRole("button", { name: "Go to Ship the release" }));

    expect(props.onShowAll).toHaveBeenCalledTimes(1);
    expect(props.onGoToStart).toHaveBeenCalledTimes(1);
  });

  it("leaves out the ways out when nothing is hidden and nothing starts", () => {
    renderList({ tab: RESUME, cards: [], start: null });

    expect(screen.getByText("Nothing waits in Resume.")).toBeVisible();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows only the empty line on expanded width", () => {
    renderList(
      { tab: RESUME, cards: [], projectName: "atlas", hiddenByFilter: true },
      BOARD_WIDTH.Expanded,
    );

    expect(screen.getByText("Nothing waits in Resume in atlas.")).toBeVisible();
    expect(screen.queryByText(RESUME.what)).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows all clear when nothing waits at all", () => {
    renderList({ tab: RESUME, cards: [], start: null, allClear: true, nothingAtAll: true });

    expect(screen.getByText("All clear")).toBeVisible();
    expect(screen.getByText("No decision waits for you.")).toBeVisible();
    expect(screen.getByText("0 executions run · 0 jobs wait")).toBeVisible();
  });

  it("shows no act found when a fault hides the records", () => {
    renderList({ tab: RESUME, cards: [], start: null, nothingAtAll: true });

    expect(screen.getByText("No act found")).toBeVisible();
    expect(screen.getByText("Some records could not be read.")).toBeVisible();
  });

  it("shows no all clear under a filter", () => {
    renderList({ tab: RESUME, cards: [], allClear: true, projectName: "atlas" });

    expect(screen.queryByText("All clear")).not.toBeInTheDocument();
    expect(screen.getByText("Nothing waits in Resume in atlas.")).toBeVisible();
  });

  it("shows no all clear on expanded width", () => {
    renderList(
      { tab: RESUME, cards: [], allClear: true, nothingAtAll: true },
      BOARD_WIDTH.Expanded,
    );

    expect(screen.queryByText("All clear")).not.toBeInTheDocument();
    expect(screen.getByText("Nothing waits in Resume.")).toBeVisible();
  });

  it("marks the selected card and passes the held count, gate and lead label", () => {
    renderList({
      selectedId: "blocked:b2",
      held: new Map([["blocked:b1", ["b1", "x"]]]),
      gates: new Map([["blocked:b2", { itemId: "i", need: "n", short: "Rotate anthropic-main" }]]),
      leadLabelOf: (item) => (item.id === "blocked:b1" ? "Unblock" : null),
    });

    expect(screen.getByText("2 nodes wait")).toBeVisible();
    expect(screen.getByText("Unblock")).toBeVisible();
    expect(screen.getByText("Needs: Rotate anthropic-main")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Fix the build" }).closest("[aria-current='true']"),
    ).not.toBeNull();
  });

  it("ends the list with a closed Done this session toggle that holds the count", () => {
    const entry: DoneEntry = {
      itemId: "blocked:gone",
      subject: "Gone",
      tab: RULE.id,
      projects: [ATLAS],
      text: "Discarded Gone.",
      sentAt: "Sent at 09:05 UTC",
    };
    renderList({ done: [entry] });

    const toggle = screen.getByRole("button", { name: "Done this session 1" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Discarded Gone.")).toBeNull();
  });

  it("shows no Done this session toggle without an entry", () => {
    renderList();

    expect(screen.queryByText("Done this session")).toBeNull();
  });
});
