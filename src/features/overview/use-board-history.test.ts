import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MissionNodeRecord, NodeState, Project } from "@/api/types";
import { type AttentionItem, deriveAttention, type ProjectSnapshot } from "@/lib/attention";
import { BOARD_TAB } from "@/lib/board-tabs";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import { type BoardOverview, useBoard } from "./use-board";
import { type BoardHistoryInput, useBoardHistory } from "./use-board-history";

type Entry = string | { pathname: string; search: string; state: unknown };

const NOW = 10_000_000;
const PREVIOUS = "/previous";

const ATLAS: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
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

function snapshot(nodes: readonly MissionNodeRecord[]): ProjectSnapshot {
  return {
    project: ATLAS,
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

function overviewOf(gone: readonly string[] = [], updatedAt = 1): BoardOverview {
  const nodes = [blocked("b1", 100), blocked("b2", 200), blocked("b3", 300), node("p1", "Paused")];
  const snapshots = [snapshot(nodes.filter((entry) => !gone.includes(entry.id)))];
  const details = new Map();
  const boardItems: readonly AttentionItem[] = deriveAttention(snapshots, details, {
    now: NOW,
    catalog: null,
    credentials: [],
    sessions: null,
  });
  return {
    status: "ready",
    boardItems,
    gates: new Map(),
    held: new Map(boardItems.map((item) => [item.id, []])),
    details,
    projects: [ATLAS],
    faults: [],
    updatedAt,
    setDialogOpen,
  };
}

function elementOf(): HTMLElement {
  const element = document.createElement("div");
  element.tabIndex = -1;
  document.body.append(element);
  return element;
}

function wrapperOf(entries: readonly Entry[]) {
  return ({ children }: { children: ReactNode }) =>
    createElement(
      MemoryRouter,
      { initialEntries: [...entries], initialIndex: entries.length - 1 },
      children,
    );
}

function paramOf(location: { readonly search: string }, name: string): string | null {
  return new URLSearchParams(location.search).get(name);
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("useBoardHistory", () => {
  interface Props {
    readonly input: BoardHistoryInput;
  }

  function inputOf(overrides: Partial<BoardHistoryInput> = {}): BoardHistoryInput {
    return {
      widthClass: BOARD_WIDTH.Compact,
      deepLink: null,
      dialogOpen: false,
      closeDialogs: vi.fn(),
      focusTitle: vi.fn(),
      ...overrides,
    };
  }

  function render(entries: readonly Entry[], input: BoardHistoryInput, strict = false) {
    return renderHook(
      ({ input: current }: Props) => ({
        history: useBoardHistory(current),
        location: useLocation(),
        navigate: useNavigate(),
      }),
      { wrapper: wrapperOf(entries), reactStrictMode: strict, initialProps: { input } },
    );
  }

  function back(view: ReturnType<typeof render>) {
    act(() => view.result.current.navigate(-1));
  }

  it("pushes one entry with the item in the URL and the state", () => {
    const view = render([PREVIOUS, "/"], inputOf());

    act(() =>
      view.result.current.history.push({ kind: "blocked", item: "blocked:b1" }, "blocked:b1"),
    );

    expect(view.result.current.history.overviewItem).toBe("blocked:b1");
    expect(paramOf(view.result.current.location, "item")).toBe("blocked:b1");
    expect(view.result.current.location.state).toEqual({ overviewItem: "blocked:b1" });
    back(view);
    expect(view.result.current.history.overviewItem).toBeNull();
    expect(view.result.current.location.pathname).toBe("/");
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("adds one entry for a push under StrictMode", () => {
    const view = render([PREVIOUS, "/"], inputOf(), true);

    act(() => view.result.current.history.push({ item: "blocked:b1" }, "blocked:b1"));

    back(view);
    expect(view.result.current.location.pathname).toBe("/");
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("replaces the top entry and keeps it an item entry", () => {
    const view = render([PREVIOUS, "/"], inputOf());
    act(() => view.result.current.history.push({ item: "blocked:b1" }, "blocked:b1"));

    act(() => view.result.current.history.replace({ item: "blocked:b2" }));

    expect(view.result.current.history.overviewItem).toBe("blocked:b2");
    back(view);
    expect(view.result.current.history.overviewItem).toBeNull();
    expect(view.result.current.location.pathname).toBe("/");
  });

  it("writes a plain replace without state on the list entry", () => {
    const view = render([PREVIOUS, "/"], inputOf());

    act(() => view.result.current.history.replace({ kind: "paused", item: "paused:p1" }));

    expect(view.result.current.history.overviewItem).toBeNull();
    expect(view.result.current.location.search).toBe("?kind=paused&item=paused%3Ap1");
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("pops the entry on close and runs then when Back lands", () => {
    const view = render([PREVIOUS, "/"], inputOf());
    act(() => view.result.current.history.push({ item: "blocked:b1" }, "blocked:b1"));
    const then = vi.fn();

    act(() => view.result.current.history.close(then));

    expect(view.result.current.history.overviewItem).toBeNull();
    expect(then).toHaveBeenCalledOnce();
    expect(view.result.current.location.pathname).toBe("/");
  });

  it("runs then at once when no entry is open", () => {
    const view = render([PREVIOUS, "/"], inputOf());
    const then = vi.fn();

    act(() => view.result.current.history.close(then));

    expect(then).toHaveBeenCalledOnce();
    expect(view.result.current.location.pathname).toBe("/");
  });

  it("pops once for two closes and keeps the last then", () => {
    const view = render([PREVIOUS, "/"], inputOf());
    act(() => view.result.current.history.push({ item: "blocked:b1" }, "blocked:b1"));
    const first = vi.fn();
    const second = vi.fn();

    act(() => {
      view.result.current.history.close(first);
      view.result.current.history.close(second);
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    expect(view.result.current.location.pathname).toBe("/");
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("does not run then when Back lands on another item entry", () => {
    const view = render([PREVIOUS, "/"], inputOf());
    act(() => view.result.current.history.push({ item: "blocked:b1" }, "blocked:b1"));
    act(() => view.result.current.history.push({ item: "blocked:b2" }, "blocked:b2"));
    const then = vi.fn();

    act(() => view.result.current.history.close(then));

    expect(then).not.toHaveBeenCalled();
    expect(view.result.current.history.overviewItem).toBe("blocked:b1");
    back(view);
    expect(view.result.current.history.overviewItem).toBeNull();
  });

  it("closes the dialogs and pushes the same entry again on Back with a dialog open", () => {
    const closeDialogs = vi.fn();
    const view = render([PREVIOUS, "/"], inputOf({ dialogOpen: true, closeDialogs }));
    act(() => view.result.current.history.push({ item: "blocked:b1" }, "blocked:b1"));

    back(view);

    expect(closeDialogs).toHaveBeenCalledOnce();
    expect(view.result.current.history.overviewItem).toBe("blocked:b1");
    expect(paramOf(view.result.current.location, "item")).toBe("blocked:b1");
    view.rerender({ input: inputOf({ dialogOpen: false, closeDialogs }) });
    back(view);
    expect(view.result.current.history.overviewItem).toBeNull();
    expect(view.result.current.location.pathname).toBe("/");
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("writes the list entry with replace and pushes the item entry for a deep link", () => {
    const entry = { pathname: "/", search: "?kind=blocked&item=blocked:b1", state: null };
    const view = render([PREVIOUS, entry], inputOf({ deepLink: "blocked:b1" }));

    expect(view.result.current.history.overviewItem).toBe("blocked:b1");
    expect(paramOf(view.result.current.location, "item")).toBe("blocked:b1");
    back(view);
    expect(view.result.current.history.overviewItem).toBeNull();
    expect(paramOf(view.result.current.location, "item")).toBeNull();
    expect(paramOf(view.result.current.location, "kind")).toBe("blocked");
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("needs one Back to return to the list after a deep link under StrictMode", () => {
    const entry = { pathname: "/", search: "?item=blocked:b1", state: null };
    const view = render([PREVIOUS, entry], inputOf({ deepLink: "blocked:b1" }), true);

    back(view);

    expect(view.result.current.history.overviewItem).toBeNull();
    expect(view.result.current.location.pathname).toBe("/");
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("pops every item entry on a change to expanded and writes the item with replace", () => {
    const focusTitle = vi.fn();
    const view = render([PREVIOUS, "/"], inputOf({ focusTitle }));
    act(() => view.result.current.history.push({ item: "blocked:b1" }, "blocked:b1"));
    act(() => view.result.current.history.push({ item: "blocked:b2" }, "blocked:b2"));

    view.rerender({ input: inputOf({ widthClass: BOARD_WIDTH.Expanded, focusTitle }) });

    expect(view.result.current.history.overviewItem).toBeNull();
    expect(view.result.current.location.pathname).toBe("/");
    expect(paramOf(view.result.current.location, "item")).toBe("blocked:b2");
    expect(focusTitle).toHaveBeenCalledOnce();
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("moves no focus to the title on a change to expanded while a dialog is open", () => {
    const focusTitle = vi.fn();
    const view = render([PREVIOUS, "/"], inputOf({ dialogOpen: true, focusTitle }));
    act(() => view.result.current.history.push({ item: "blocked:b1" }, "blocked:b1"));

    view.rerender({
      input: inputOf({ widthClass: BOARD_WIDTH.Expanded, dialogOpen: true, focusTitle }),
    });

    expect(view.result.current.history.overviewItem).toBeNull();
    expect(focusTitle).not.toHaveBeenCalled();
  });

  it("leaves the Overview entry on the first Back after medium, expanded and medium again", () => {
    const view = render([PREVIOUS, "/"], inputOf({ widthClass: BOARD_WIDTH.Medium }));
    act(() => view.result.current.history.push({ item: "blocked:b1" }, "blocked:b1"));

    view.rerender({ input: inputOf({ widthClass: BOARD_WIDTH.Expanded }) });
    view.rerender({ input: inputOf({ widthClass: BOARD_WIDTH.Medium }) });
    back(view);

    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("keeps the item entry of a reload that already holds the state", () => {
    const entry = {
      pathname: "/",
      search: "?item=blocked:b1",
      state: { overviewItem: "blocked:b1" },
    };
    const view = render([PREVIOUS, "/", entry], inputOf(), true);

    expect(view.result.current.history.overviewItem).toBe("blocked:b1");
    back(view);
    expect(view.result.current.history.overviewItem).toBeNull();
    expect(view.result.current.location.pathname).toBe("/");
  });
});

describe("useBoardHistory with useBoard", () => {
  interface Props {
    readonly overview: BoardOverview;
    readonly width: BoardWidth;
  }

  function render(
    entries: readonly Entry[],
    width: BoardWidth = BOARD_WIDTH.Compact,
    strict = false,
    overview = overviewOf(),
  ) {
    return renderHook(
      ({ overview: current, width: widthClass }: Props) => ({
        board: useBoard(current, widthClass),
        location: useLocation(),
        navigate: useNavigate(),
      }),
      { wrapper: wrapperOf(entries), reactStrictMode: strict, initialProps: { overview, width } },
    );
  }

  type View = ReturnType<typeof render>;

  function back(view: View) {
    act(() => view.result.current.navigate(-1));
  }

  function titleOf(view: View): HTMLElement {
    const title = elementOf();
    act(() => view.result.current.board.titleRef(title));
    return title;
  }

  it("opens a card with one entry, and Back closes it with the focus on the card", () => {
    const view = render([PREVIOUS, "/"]);
    const card = elementOf();
    act(() => view.result.current.board.cardRef("blocked:c1")(card));
    act(() => view.result.current.board.open("blocked:b2"));

    expect(view.result.current.board.openId).toBe("blocked:b2");
    expect(view.result.current.location.state).toEqual({ overviewItem: "blocked:b2" });
    const target = elementOf();
    act(() => view.result.current.board.cardRef("blocked:b2")(target));

    back(view);

    expect(view.result.current.board.openId).toBeNull();
    expect(view.result.current.board.selectedId).toBe("blocked:b2");
    expect(document.activeElement).toBe(target);
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("pushes no entry on expanded and writes the item with replace", () => {
    const view = render([PREVIOUS, "/"], BOARD_WIDTH.Expanded);

    act(() => view.result.current.board.open("blocked:b2"));

    expect(view.result.current.board.openId).toBeNull();
    expect(paramOf(view.result.current.location, "item")).toBe("blocked:b2");
    expect(view.result.current.location.state).toBeNull();
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("adds one entry for an open under StrictMode", () => {
    const view = render([PREVIOUS, "/"], BOARD_WIDTH.Compact, true);

    act(() => view.result.current.board.open("blocked:b2"));
    back(view);

    expect(view.result.current.board.openId).toBeNull();
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("returns to the source detail after a jump under StrictMode, and a second Back to the list", () => {
    const view = render([PREVIOUS, "/"], BOARD_WIDTH.Compact, true);
    act(() => view.result.current.board.open("blocked:b1"));
    act(() => view.result.current.board.jump("blocked:b3"));
    expect(view.result.current.board.openId).toBe("blocked:b3");

    back(view);

    expect(view.result.current.board.openId).toBe("blocked:b1");
    expect(view.result.current.board.selectedId).toBe("blocked:b1");
    back(view);
    expect(view.result.current.board.openId).toBeNull();
    expect(view.result.current.location.pathname).toBe("/");
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("focuses the source title when Back lands on the source detail", () => {
    const view = render([PREVIOUS, "/"]);
    const title = titleOf(view);
    act(() => view.result.current.board.open("blocked:b1"));
    act(() => view.result.current.board.jump("blocked:b3"));
    elementOf().focus();

    back(view);

    expect(document.activeElement).toBe(title);
  });

  it("opens a deep link with one list entry under StrictMode", () => {
    const view = render(
      [PREVIOUS, { pathname: "/", search: "?kind=blocked&item=blocked:b2", state: null }],
      BOARD_WIDTH.Compact,
      true,
    );

    expect(view.result.current.board.openId).toBe("blocked:b2");
    expect(view.result.current.location.state).toEqual({ overviewItem: "blocked:b2" });
    back(view);
    expect(view.result.current.board.openId).toBeNull();
    expect(view.result.current.board.selectedId).toBe("blocked:b2");
    expect(view.result.current.location.pathname).toBe("/");
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("opens a reload that holds the state with no second entry", () => {
    const entry = {
      pathname: "/",
      search: "?item=blocked:b2",
      state: { overviewItem: "blocked:b2" },
    };
    const view = render([PREVIOUS, "/", entry], BOARD_WIDTH.Compact, true);

    expect(view.result.current.board.openId).toBe("blocked:b2");
    back(view);
    expect(view.result.current.board.openId).toBeNull();
    expect(view.result.current.location.pathname).toBe("/");
    expect(view.result.current.location.search).toBe("");
  });

  it("opens the sheet again on Back to an item entry, with no second list entry", () => {
    const view = render([PREVIOUS, "/"]);
    act(() => view.result.current.board.open("blocked:b2"));
    act(() => view.result.current.navigate("/traces/t1"));

    back(view);

    expect(view.result.current.board.openId).toBe("blocked:b2");
    back(view);
    expect(view.result.current.board.openId).toBeNull();
    expect(view.result.current.location.pathname).toBe("/");
  });

  it("keeps the selection and the history of a step", () => {
    const view = render([PREVIOUS, "/"]);
    act(() => view.result.current.board.open("blocked:b1"));

    act(() => view.result.current.board.step(1));

    expect(view.result.current.board.openId).toBe("blocked:b2");
    expect(view.result.current.location.state).toEqual({ overviewItem: "blocked:b2" });
    back(view);
    expect(view.result.current.board.openId).toBeNull();
    expect(view.result.current.location.pathname).toBe("/");
    expect(view.result.current.board.selectedId).toBe("blocked:b2");
  });

  it("closes the sheet with a tab select and leaves no entry behind", () => {
    const view = render([PREVIOUS, "/"]);
    act(() => view.result.current.board.open("blocked:b1"));

    act(() => {
      view.result.current.board.close();
      view.result.current.board.selectTab(BOARD_TAB.Resume);
    });

    expect(view.result.current.board.openId).toBeNull();
    expect(view.result.current.board.tab).toBe(BOARD_TAB.Resume);
    expect(paramOf(view.result.current.location, "kind")).toBe("paused");
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
    expect(view.result.current.board.openId).toBeNull();
  });

  it("pops the entry when an act closes the detail and focuses the next card", () => {
    const view = render([PREVIOUS, "/"]);
    const next = elementOf();
    act(() => view.result.current.board.cardRef("blocked:b3")(next));
    act(() => view.result.current.board.open("blocked:b2"));
    act(() => view.result.current.board.markActed("blocked:b2"));

    view.rerender({ overview: overviewOf(["b2"], 2), width: BOARD_WIDTH.Compact });

    expect(view.result.current.board.openId).toBeNull();
    expect(view.result.current.board.selectedId).toBe("blocked:b3");
    expect(view.result.current.location.state).toBeNull();
    expect(document.activeElement).toBe(next);
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("returns to the source detail after an act on a jumped card and runs no then", () => {
    const view = render([PREVIOUS, "/"]);
    const title = titleOf(view);
    const next = elementOf();
    act(() => view.result.current.board.cardRef("blocked:b3")(next));
    act(() => view.result.current.board.open("blocked:b1"));
    act(() => view.result.current.board.jump("blocked:b2"));
    elementOf().focus();
    act(() => view.result.current.board.markActed("blocked:b2"));

    view.rerender({ overview: overviewOf(["b2"], 2), width: BOARD_WIDTH.Compact });

    expect(view.result.current.board.openId).toBe("blocked:b1");
    expect(view.result.current.board.selectedId).toBe("blocked:b1");
    expect(view.result.current.location.state).toEqual({ overviewItem: "blocked:b1" });
    expect(document.activeElement).toBe(title);
    back(view);
    expect(view.result.current.board.openId).toBeNull();
    expect(view.result.current.location.pathname).toBe("/");
  });

  it("keeps the sheet and its entry when Back lands with an act dialog open", () => {
    const closeDialogs = vi.fn();
    const view = render([PREVIOUS, "/"]);
    act(() => view.result.current.board.registerDialogCloser(closeDialogs));
    act(() => view.result.current.board.open("blocked:b2"));
    act(() => view.result.current.board.setDialogOpen("blocked:b2", "b2", true));

    back(view);

    expect(closeDialogs).toHaveBeenCalledOnce();
    expect(view.result.current.board.openId).toBe("blocked:b2");
    expect(view.result.current.location.state).toEqual({ overviewItem: "blocked:b2" });
    act(() => view.result.current.board.setDialogOpen("blocked:b2", "b2", false));
    back(view);
    expect(view.result.current.board.openId).toBeNull();
    expect(view.result.current.location.pathname).toBe("/");
  });

  it("unwinds the overlay entries on a change to expanded and selects the shown card", () => {
    const view = render([PREVIOUS, "/"], BOARD_WIDTH.Medium);
    const title = titleOf(view);
    act(() => view.result.current.board.open("blocked:b1"));
    act(() => view.result.current.board.jump("blocked:b3"));

    view.rerender({ overview: overviewOf(), width: BOARD_WIDTH.Expanded });

    expect(view.result.current.board.openId).toBeNull();
    expect(view.result.current.board.selectedId).toBe("blocked:b3");
    expect(paramOf(view.result.current.location, "item")).toBe("blocked:b3");
    expect(view.result.current.location.state).toBeNull();
    expect(document.activeElement).toBe(title);
    view.rerender({ overview: overviewOf(), width: BOARD_WIDTH.Medium });
    back(view);
    expect(view.result.current.location.pathname).toBe(PREVIOUS);
  });

  it("adds a Done entry when the item leaves at the first read after its act", () => {
    const view = render([PREVIOUS, "/"], BOARD_WIDTH.Expanded);
    act(() => view.result.current.board.select("blocked:b2"));
    act(() => view.result.current.board.markActed("blocked:b2", { id: "discard" }));
    expect(view.result.current.board.done).toEqual([]);

    view.rerender({ overview: overviewOf(["b2"], 2), width: BOARD_WIDTH.Expanded });

    const [entry] = view.result.current.board.done;
    expect(entry?.text).toBe("Discarded Node b2.");
    expect(entry?.tab).toBe(BOARD_TAB.Rule);
    expect(view.result.current.board.done).toHaveLength(1);
  });

  it("adds no Done entry for an act without a Done text or when the item stays", () => {
    const view = render([PREVIOUS, "/"], BOARD_WIDTH.Expanded);
    act(() => view.result.current.board.select("blocked:b2"));
    act(() => view.result.current.board.markActed("blocked:b2"));
    view.rerender({ overview: overviewOf(["b2"], 2), width: BOARD_WIDTH.Expanded });
    act(() => view.result.current.board.select("blocked:b3"));
    act(() => view.result.current.board.markActed("blocked:b3", { id: "discard" }));

    view.rerender({ overview: overviewOf(["b2"], 3), width: BOARD_WIDTH.Expanded });

    expect(view.result.current.board.done).toEqual([]);
  });
});
