import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MissionNodeRecord, NodeState, Project, WorkbenchSessionListItem } from "@/api/types";
import { approvalItemsOf } from "@/lib/approval-attention";
import { type AttentionItem, deriveAttention, type ProjectSnapshot } from "@/lib/attention";
import { gateOf, heldNodeIdsOf } from "@/lib/board-items";
import { BOARD_TAB } from "@/lib/board-tabs";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import { type BoardOverview, useBoard } from "./use-board";

const NOW = 10_000_000;

const ATLAS: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const BETA: Project = { ...ATLAS, id: "prj-2", name: "beta" };

const SESSION: WorkbenchSessionListItem = {
  id: "s1",
  agent_name: "swe@1",
  name: null,
  created: 1,
  modified: 2,
  message_count: 1,
  first_message: "Create",
  run_active: true,
  pending_approval: { tool_call_id: "c1", operation_id: "project.create" },
};

function node(
  id: string,
  state: NodeState,
  overrides: Partial<MissionNodeRecord> = {},
): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name: `Node ${id}`,
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
    state,
    attempt: 2,
    priority: 0,
    depends_on: [],
    ...overrides,
  };
}

function blocked(id: string, createdAt: number): MissionNodeRecord {
  return node(id, "Blocked", {
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
  });
}

function snapshot(project: Project, nodes: readonly MissionNodeRecord[]): ProjectSnapshot {
  return {
    project,
    missionVersion: 1,
    nodes,
    jobs: null,
    registrations: null,
    executions: null,
    bindings: null,
    environments: null,
  };
}

const setDialogOpen = vi.fn();

function overviewOf(
  gone: readonly string[] = [],
  updatedAt = 1,
  sessions: readonly WorkbenchSessionListItem[] = [SESSION],
): BoardOverview {
  const keep = (nodes: readonly MissionNodeRecord[]) =>
    nodes.filter((entry) => !gone.includes(entry.id));
  const snapshots = [
    snapshot(
      ATLAS,
      keep([blocked("b1", 100), blocked("b2", 200), blocked("b3", 300), node("p1", "Paused")]),
    ),
    snapshot(BETA, keep([blocked("c1", 150)])),
  ];
  const details = new Map();
  const boardItems: readonly AttentionItem[] = [
    ...deriveAttention(snapshots, details, {
      now: NOW,
      catalog: null,
      credentials: [],
      sessions: null,
    }),
    ...approvalItemsOf(sessions),
  ];
  const gates = new Map(
    boardItems.flatMap((item) => {
      const gate = gateOf(item, boardItems);
      return gate === null ? [] : [[item.id, gate] as const];
    }),
  );
  const held = new Map(boardItems.map((item) => [item.id, heldNodeIdsOf(item, snapshots)]));
  return {
    status: "ready",
    boardItems,
    gates,
    held,
    details,
    projects: [ATLAS, BETA],
    faults: [],
    updatedAt,
    setDialogOpen,
  };
}

interface Props {
  readonly overview: BoardOverview;
  readonly width: BoardWidth;
}

function render(entry = "/", width: BoardWidth = BOARD_WIDTH.Expanded, overview = overviewOf()) {
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(MemoryRouter, { initialEntries: [entry] }, children);
  return renderHook(
    ({ overview: current, width: widthClass }: Props) => ({
      board: useBoard(current, widthClass),
      location: useLocation(),
    }),
    { wrapper, initialProps: { overview, width } },
  );
}

function elementOf(): HTMLElement {
  const element = document.createElement("div");
  element.tabIndex = -1;
  document.body.append(element);
  return element;
}

afterEach(() => {
  document.body.replaceChildren();
});

function paramOf(location: { readonly search: string }, name: string): string | null {
  return new URLSearchParams(location.search).get(name);
}

const RULE_IDS = ["blocked:b1", "blocked:c1", "blocked:b2", "blocked:b3"];

describe("useBoard", () => {
  it("starts on the Start here card and its tab", () => {
    const view = render();
    const { board } = view.result.current;

    expect(board.startItem?.id).toBe("blocked:b1");
    expect(board.selectedId).toBe("blocked:b1");
    expect(board.tab).toBe(BOARD_TAB.Rule);
    expect(board.cards.map((card) => card.id)).toEqual(RULE_IDS);
    expect(board.openId).toBeNull();
    expect(board.gone).toBeNull();
    expect(board.position).toBe(0);
    expect(board.total).toBe(4);
    expect(board.summary.long).toContain("Start here: Node b1 in Rule.");
  });

  it("lets a kind parameter win for the tab", () => {
    const view = render("/?kind=paused");
    const { board } = view.result.current;

    expect(board.tab).toBe(BOARD_TAB.Resume);
    expect(board.cards.map((card) => card.id)).toEqual(["paused:p1"]);
    expect(board.selectedId).toBe("paused:p1");
  });

  it("counts each tab and each filter item", () => {
    const { counts } = render().result.current.board;

    expect(counts.tabs).toEqual({
      tool: 1,
      setup: 0,
      paused: 1,
      proposal: 0,
      blocked: 4,
      outside: 0,
    });
    expect(counts.held.blocked).toBe(4);
    expect(counts.view).toBe(6);
    expect(counts.all).toBe(6);
    expect(counts.projects).toEqual({ "prj-1": 5, "prj-2": 2 });
  });

  it("keeps a tool approval under a filter and scopes the other counts", () => {
    const view = render();

    act(() => view.result.current.board.selectProject("prj-2"));
    const { board, location } = view.result.current;

    expect(board.projectId).toBe("prj-2");
    expect(paramOf(location, "project")).toBe("prj-2");
    expect(board.cards.map((card) => card.id)).toEqual(["blocked:c1"]);
    expect(board.selectedId).toBe("blocked:c1");
    expect(board.counts.tabs).toEqual({
      tool: 1,
      setup: 0,
      paused: 0,
      proposal: 0,
      blocked: 1,
      outside: 0,
    });
    expect(board.counts.view).toBe(2);
    expect(board.counts.all).toBe(6);
    expect(board.summary.long).toContain("in beta");
  });

  it("returns to all projects", () => {
    const view = render("/?project=prj-2");

    act(() => view.result.current.board.selectProject(null));

    expect(view.result.current.board.projectId).toBeNull();
    expect(paramOf(view.result.current.location, "project")).toBeNull();
  });

  it("selects the first card of a tab and writes kind and item", () => {
    const view = render();

    act(() => view.result.current.board.selectTab(BOARD_TAB.Tool));
    const { board, location } = view.result.current;

    expect(board.tab).toBe(BOARD_TAB.Tool);
    expect(board.selectedId).toBe("tool_approval:s1");
    expect(paramOf(location, "kind")).toBe("tool");
    expect(paramOf(location, "item")).toBe("tool_approval:s1");
  });

  it("selects nothing on an empty tab", () => {
    const view = render();

    act(() => view.result.current.board.selectTab(BOARD_TAB.Outside));

    expect(view.result.current.board.selectedId).toBeNull();
    expect(view.result.current.board.cards).toEqual([]);
    expect(view.result.current.location.search).toBe("?kind=outside");
  });

  it("keeps a selected item that left the list as gone", () => {
    const view = render();

    view.rerender({ overview: overviewOf(["b1"], 2), width: BOARD_WIDTH.Expanded });
    const { board } = view.result.current;

    expect(board.selectedId).toBe("blocked:b1");
    expect(board.gone?.id).toBe("blocked:b1");
    expect(board.gone?.item?.subject).toBe("Node b1");
    expect(board.tab).toBe(BOARD_TAB.Rule);
    expect(board.position).toBeNull();
  });

  it("answers a gone pin without an item for an unknown item parameter", () => {
    const view = render("/?item=missing");

    expect(view.result.current.board.selectedId).toBe("missing");
    expect(view.result.current.board.gone).toEqual({ id: "missing", item: null });
  });

  it("reports no gone pin before the first read", () => {
    const view = render("/?item=blocked:b1", BOARD_WIDTH.Expanded, {
      ...overviewOf(),
      status: "loading",
      boardItems: [],
    });

    expect(view.result.current.board.selectedId).toBe("blocked:b1");
    expect(view.result.current.board.gone).toBeNull();
  });

  it("selects the item of the URL and its tab", () => {
    const view = render("/?item=paused:p1");
    const { board } = view.result.current;

    expect(board.selectedId).toBe("paused:p1");
    expect(board.tab).toBe(BOARD_TAB.Resume);
    expect(board.openId).toBeNull();
  });

  it("opens the item of the URL on compact", () => {
    const view = render("/?item=blocked:c1", BOARD_WIDTH.Compact);

    expect(view.result.current.board.selectedId).toBe("blocked:c1");
    expect(view.result.current.board.openId).toBe("blocked:c1");
  });

  it("opens the item of the URL on medium once the first read answers", () => {
    const loading = { ...overviewOf(), status: "loading" as const, boardItems: [] };
    const view = render("/?item=blocked:c1", BOARD_WIDTH.Medium, loading);

    expect(view.result.current.board.openId).toBeNull();
    view.rerender({ overview: overviewOf(), width: BOARD_WIDTH.Medium });

    expect(view.result.current.board.openId).toBe("blocked:c1");
  });

  it("opens a card on compact and only selects it on expanded", () => {
    const compact = render("/", BOARD_WIDTH.Compact);
    act(() => compact.result.current.board.open("blocked:c1"));
    expect(compact.result.current.board.openId).toBe("blocked:c1");
    expect(compact.result.current.board.selectedId).toBe("blocked:c1");
    expect(paramOf(compact.result.current.location, "item")).toBe("blocked:c1");

    act(() => compact.result.current.board.close());
    expect(compact.result.current.board.openId).toBeNull();
    expect(compact.result.current.board.selectedId).toBe("blocked:c1");

    const expanded = render();
    act(() => expanded.result.current.board.open("blocked:c1"));
    expect(expanded.result.current.board.openId).toBeNull();
    expect(expanded.result.current.board.selectedId).toBe("blocked:c1");
  });

  it("moves the open detail with step and replaces item", () => {
    const view = render("/", BOARD_WIDTH.Compact);
    const title = elementOf();
    act(() => view.result.current.board.titleRef(title));
    act(() => view.result.current.board.open("blocked:b1"));

    act(() => view.result.current.board.step(-1));
    expect(view.result.current.board.selectedId).toBe("blocked:b1");

    act(() => view.result.current.board.step(1));
    expect(view.result.current.board.selectedId).toBe("blocked:c1");
    expect(view.result.current.board.openId).toBe("blocked:c1");
    expect(view.result.current.board.position).toBe(1);
    expect(paramOf(view.result.current.location, "item")).toBe("blocked:c1");
    expect(document.activeElement).toBe(title);

    act(() => view.result.current.board.step(1));
    act(() => view.result.current.board.step(1));
    act(() => view.result.current.board.step(1));
    expect(view.result.current.board.selectedId).toBe("blocked:b3");
    expect(view.result.current.board.position).toBe(3);

    act(() => view.result.current.board.step(-1));
    expect(view.result.current.board.selectedId).toBe("blocked:b2");
    expect(view.result.current.board.openId).toBe("blocked:b2");
  });

  it("focuses the detail title that mounts after the open", () => {
    const view = render("/", BOARD_WIDTH.Medium);
    act(() => view.result.current.board.open("blocked:c1"));
    const title = elementOf();

    act(() => view.result.current.board.titleRef(title));

    expect(document.activeElement).toBe(title);
  });

  it("selects the card at the same index after a marked item leaves, on expanded", () => {
    const view = render();
    const title = elementOf();
    act(() => view.result.current.board.titleRef(title));
    act(() => view.result.current.board.select("blocked:c1"));

    act(() => view.result.current.board.markActed("blocked:c1"));
    view.rerender({ overview: overviewOf(["c1"], 2), width: BOARD_WIDTH.Expanded });

    expect(view.result.current.board.selectedId).toBe("blocked:b2");
    expect(view.result.current.board.gone).toBeNull();
    expect(document.activeElement).toBe(title);
  });

  it("selects the last card when the marked item was last", () => {
    const view = render();
    act(() => view.result.current.board.select("blocked:b3"));

    act(() => view.result.current.board.markActed("blocked:b3"));
    view.rerender({ overview: overviewOf(["b3"], 2), width: BOARD_WIDTH.Expanded });

    expect(view.result.current.board.selectedId).toBe("blocked:b2");
  });

  it("keeps the selection when a newer read still holds the marked item", () => {
    const view = render();
    act(() => view.result.current.board.select("blocked:c1"));

    act(() => view.result.current.board.markActed("blocked:c1"));
    view.rerender({ overview: overviewOf([], 2), width: BOARD_WIDTH.Expanded });
    view.rerender({ overview: overviewOf(["c1"], 3), width: BOARD_WIDTH.Expanded });

    expect(view.result.current.board.selectedId).toBe("blocked:c1");
    expect(view.result.current.board.gone?.id).toBe("blocked:c1");
  });

  it("focuses the all clear title when no card is left", () => {
    const only = (updatedAt: number) => {
      const full = overviewOf([], updatedAt, []);
      return { ...full, boardItems: full.boardItems.filter((item) => item.id === "blocked:b1") };
    };
    const view = render("/", BOARD_WIDTH.Expanded, only(1));
    const allClear = elementOf();
    act(() => view.result.current.board.allClearRef(allClear));

    act(() => view.result.current.board.markActed("blocked:b1"));
    view.rerender({
      overview: { ...only(2), boardItems: [] },
      width: BOARD_WIDTH.Expanded,
    });

    expect(view.result.current.board.selectedId).toBeNull();
    expect(document.activeElement).toBe(allClear);
  });

  it("closes the detail and focuses the next card on compact", () => {
    const view = render("/", BOARD_WIDTH.Compact);
    const next = elementOf();
    act(() => view.result.current.board.cardRef("blocked:b2")(next));
    act(() => view.result.current.board.open("blocked:c1"));

    act(() => view.result.current.board.markActed("blocked:c1"));
    view.rerender({ overview: overviewOf(["c1"], 2), width: BOARD_WIDTH.Compact });

    expect(view.result.current.board.openId).toBeNull();
    expect(view.result.current.board.selectedId).toBe("blocked:b2");
    expect(document.activeElement).toBe(next);
  });

  it("calls markActed on a dialog close, and the next card follows at a newer read", () => {
    setDialogOpen.mockClear();
    const view = render();
    act(() => view.result.current.board.select("blocked:c1"));

    act(() => view.result.current.board.setDialogOpen("blocked:c1", "c1", true));
    expect(setDialogOpen).toHaveBeenLastCalledWith("blocked:c1", "c1", true);
    view.rerender({ overview: overviewOf(["c1"], 2), width: BOARD_WIDTH.Expanded });
    expect(view.result.current.board.gone?.id).toBe("blocked:c1");

    view.rerender({ overview: overviewOf([], 3), width: BOARD_WIDTH.Expanded });
    act(() => view.result.current.board.setDialogOpen("blocked:c1", "c1", false));
    expect(setDialogOpen).toHaveBeenLastCalledWith("blocked:c1", "c1", false);
    view.rerender({ overview: overviewOf(["c1"], 4), width: BOARD_WIDTH.Expanded });

    expect(view.result.current.board.selectedId).toBe("blocked:b2");
    expect(view.result.current.board.gone).toBeNull();
  });

  it("keeps setDialogOpen and markActed stable across reads", () => {
    const view = render();
    const { setDialogOpen: before, markActed } = view.result.current.board;

    view.rerender({ overview: overviewOf([], 2), width: BOARD_WIDTH.Expanded });

    expect(view.result.current.board.setDialogOpen).toBe(before);
    expect(view.result.current.board.markActed).toBe(markActed);
  });

  it("closes the detail on a change to expanded and keeps the selection", () => {
    const view = render("/", BOARD_WIDTH.Compact);
    act(() => view.result.current.board.open("blocked:c1"));

    view.rerender({ overview: overviewOf(), width: BOARD_WIDTH.Expanded });

    expect(view.result.current.board.openId).toBeNull();
    expect(view.result.current.board.selectedId).toBe("blocked:c1");
  });

  it("opens no detail on a change from expanded and focuses the selected card", () => {
    const view = render();
    const card = elementOf();
    act(() => view.result.current.board.cardRef("blocked:b1")(card));

    view.rerender({ overview: overviewOf(), width: BOARD_WIDTH.Medium });

    expect(view.result.current.board.openId).toBeNull();
    expect(view.result.current.board.selectedId).toBe("blocked:b1");
    expect(document.activeElement).toBe(card);
  });
});
