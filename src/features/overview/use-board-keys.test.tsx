import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Project } from "@/api/types";
import type { AttentionItem } from "@/lib/attention";
import { BOARD_TAB } from "@/lib/board-tabs";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import type { BoardAct } from "./components/board-acts";
import { type BoardKeysInput, useBoardKeys } from "./use-board-keys";

function project(id: string): Project {
  return {
    id,
    name: id,
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: `/state/${id}`,
  };
}

function card(id: string): AttentionItem {
  return { id } as AttentionItem;
}

const CARDS = [card("a"), card("b"), card("c")];

const board = {
  cards: CARDS,
  selectedId: "b" as string | null,
  openId: null as string | null,
  projectId: null as string | null,
  select: vi.fn(),
  open: vi.fn(),
  close: vi.fn(),
  step: vi.fn(),
  selectTab: vi.fn(),
  selectProject: vi.fn(),
  focusCard: vi.fn(),
  focusTitle: vi.fn(),
};

const press = vi.fn();
const openShortcuts = vi.fn();
const announce = vi.fn();

function buttonAct(id: string, disabled = false, onPress: () => void = press): BoardAct {
  return {
    type: "button",
    id,
    label: id,
    ariaLabel: null,
    variant: "outline",
    disabled,
    press: onPress,
  };
}

let acts: readonly BoardAct[] = [];
let widthClass: BoardWidth = BOARD_WIDTH.Expanded;

function Probe() {
  const input: BoardKeysInput = {
    board,
    widthClass,
    projects: [project("prj-1"), project("prj-2")],
    acts,
    openShortcuts,
    announce,
  };
  useBoardKeys(input);
  return <output aria-label="Location">{useLocation().pathname}</output>;
}

function renderBoard(children: React.ReactNode = null) {
  return render(
    <MemoryRouter>
      <Probe />
      <div data-board-list="">
        <button>card</button>
      </div>
      <div data-board-detail="">
        <button>pane</button>
      </div>
      <button>outside</button>
      <input aria-label="Text" />
      {children}
    </MemoryRouter>,
  );
}

function key(name: string, target: HTMLElement = screen.getByRole("button", { name: "card" })) {
  target.focus();
  return fireEvent.keyDown(target, { key: name });
}

beforeEach(() => {
  vi.clearAllMocks();
  board.selectedId = "b";
  board.openId = null;
  board.projectId = null;
  acts = [];
  widthClass = BOARD_WIDTH.Expanded;
});

describe("useBoardKeys in the list", () => {
  it("selects and focuses the next card with ArrowDown and j", () => {
    renderBoard();

    expect(key("ArrowDown")).toBe(false);
    expect(board.focusCard).toHaveBeenLastCalledWith("c");
    expect(board.select).toHaveBeenLastCalledWith("c");

    key("j");
    expect(board.select).toHaveBeenCalledTimes(2);
  });

  it("selects and focuses the previous card with ArrowUp and k", () => {
    renderBoard();

    key("ArrowUp");
    expect(board.focusCard).toHaveBeenLastCalledWith("a");
    expect(board.select).toHaveBeenLastCalledWith("a");

    key("k");
    expect(board.select).toHaveBeenCalledTimes(2);
  });

  it("selects the first and the last card with Home and End", () => {
    renderBoard();

    key("Home");
    expect(board.select).toHaveBeenLastCalledWith("a");

    key("End");
    expect(board.select).toHaveBeenLastCalledWith("c");
  });

  it("keeps the page still at the end of the list without a selection change", () => {
    board.selectedId = "c";
    renderBoard();

    expect(key("ArrowDown")).toBe(false);
    expect(board.select).not.toHaveBeenCalled();
  });

  it("starts on the first card when the selection is not in the list", () => {
    board.selectedId = "gone";
    renderBoard();

    key("ArrowDown");

    expect(board.select).toHaveBeenLastCalledWith("a");
  });

  it("does nothing to the cards while focus is outside the list", () => {
    renderBoard();
    const outside = screen.getByRole("button", { name: "outside" });

    expect(key("ArrowDown", outside)).toBe(true);
    key("j", outside);
    key("Home", outside);
    key("End", outside);

    expect(board.select).not.toHaveBeenCalled();
    expect(board.focusCard).not.toHaveBeenCalled();
  });

  it("opens the detail with Enter and moves focus to its title on expanded width", () => {
    renderBoard();

    expect(key("Enter")).toBe(false);

    expect(board.open).toHaveBeenCalledWith("b");
    expect(board.focusTitle).toHaveBeenCalledTimes(1);
  });

  it("only opens the detail with Enter on compact width", () => {
    widthClass = BOARD_WIDTH.Compact;
    renderBoard();

    key("Enter");

    expect(board.open).toHaveBeenCalledWith("b");
    expect(board.focusTitle).not.toHaveBeenCalled();
  });

  it("leaves Enter alone outside the list", () => {
    renderBoard();

    expect(key("Enter", screen.getByRole("button", { name: "outside" }))).toBe(true);
    expect(board.open).not.toHaveBeenCalled();
  });
});

describe("useBoardKeys in the detail", () => {
  it("returns focus to the selected card with Esc in the expanded pane", () => {
    renderBoard();

    expect(key("Escape", screen.getByRole("button", { name: "pane" }))).toBe(false);

    expect(board.focusCard).toHaveBeenCalledWith("b");
  });

  it("leaves Esc alone outside the pane", () => {
    renderBoard();

    expect(key("Escape", screen.getByRole("button", { name: "outside" }))).toBe(true);
    expect(board.focusCard).not.toHaveBeenCalled();
  });

  it("leaves Esc alone on compact width", () => {
    widthClass = BOARD_WIDTH.Compact;
    renderBoard();

    expect(key("Escape", screen.getByRole("button", { name: "pane" }))).toBe(true);
    expect(board.focusCard).not.toHaveBeenCalled();
  });

  it("steps the open sheet with j and k", () => {
    widthClass = BOARD_WIDTH.Medium;
    board.openId = "b";
    renderBoard();
    const pane = screen.getByRole("button", { name: "pane" });

    key("j", pane);
    key("k", pane);

    expect(board.step).toHaveBeenNthCalledWith(1, 1);
    expect(board.step).toHaveBeenNthCalledWith(2, -1);
  });

  it("keeps the arrow keys native in the open sheet", () => {
    widthClass = BOARD_WIDTH.Compact;
    board.openId = "b";
    renderBoard();

    expect(key("ArrowDown", screen.getByRole("button", { name: "pane" }))).toBe(true);
    expect(board.step).not.toHaveBeenCalled();
    expect(board.select).not.toHaveBeenCalled();
  });

  it("does not step with j when no sheet is open", () => {
    renderBoard();

    key("j", screen.getByRole("button", { name: "pane" }));

    expect(board.step).not.toHaveBeenCalled();
  });
});

describe("useBoardKeys tabs and filter", () => {
  it("selects a tab with 1 to 6 from anywhere", () => {
    renderBoard();
    const outside = screen.getByRole("button", { name: "outside" });

    key("2", outside);
    key("6", outside);

    expect(board.selectTab).toHaveBeenNthCalledWith(1, BOARD_TAB.Setup);
    expect(board.selectTab).toHaveBeenNthCalledWith(2, BOARD_TAB.Outside);
    expect(board.close).not.toHaveBeenCalled();
  });

  it("closes the open sheet before it selects the tab", () => {
    widthClass = BOARD_WIDTH.Compact;
    board.openId = "b";
    renderBoard();

    key("3", screen.getByRole("button", { name: "pane" }));

    expect(board.close).toHaveBeenCalledTimes(1);
    expect(board.selectTab).toHaveBeenCalledWith(BOARD_TAB.Resume);
    expect(board.close.mock.invocationCallOrder[0]).toBeLessThan(
      board.selectTab.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("cycles the filter through All and each project", () => {
    renderBoard();

    key("p");
    expect(board.selectProject).toHaveBeenLastCalledWith("prj-1");

    board.projectId = "prj-1";
    key("p");
    expect(board.selectProject).toHaveBeenLastCalledWith("prj-2");

    board.projectId = "prj-2";
    key("p");
    expect(board.selectProject).toHaveBeenLastCalledWith(null);
  });

  it("opens the shortcuts with ?", () => {
    renderBoard();

    key("?");

    expect(openShortcuts).toHaveBeenCalledTimes(1);
  });
});

describe("useBoardKeys acts", () => {
  it("presses the act of the letter", () => {
    acts = [buttonAct("resume"), buttonAct("discard")];
    renderBoard();

    expect(key("r")).toBe(false);

    expect(press).toHaveBeenCalledTimes(1);
  });

  it("presses nothing for a disabled act", () => {
    acts = [buttonAct("check", true)];
    renderBoard();

    key("c");

    expect(press).not.toHaveBeenCalled();
  });

  it("follows the link of a link act", () => {
    acts = [{ type: "link", id: "last_trace", label: "Last trace", to: "/traces/t1" }];
    renderBoard();

    key("t");

    expect(screen.getByRole("status", { name: "Location" })).toHaveTextContent("/traces/t1");
  });

  it("writes the need of a gated act and runs nothing", () => {
    acts = [
      {
        type: "gated",
        id: "discard",
        label: "Discard",
        ariaLabel: null,
        need: "Discard needs: x.",
      },
    ];
    renderBoard();

    key("x");

    expect(announce).toHaveBeenLastCalledWith("Discard needs: x.");
    expect(press).not.toHaveBeenCalled();
  });

  it("does nothing for a letter of an act that the card does not offer", () => {
    acts = [buttonAct("resume")];
    renderBoard();

    expect(key("x")).toBe(true);
    expect(press).not.toHaveBeenCalled();
  });

  it("runs the first act when two acts share a letter", () => {
    const second = vi.fn();
    acts = [buttonAct("remove:a"), buttonAct("remove:b", false, second)];
    renderBoard();

    key("m");

    expect(press).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();
  });
});

describe("useBoardKeys blocks", () => {
  it("blocks the single keys in a text field", () => {
    acts = [buttonAct("resume")];
    renderBoard();
    const field = screen.getByRole("textbox", { name: "Text" });

    expect(key("r", field)).toBe(true);
    key("2", field);
    key("j", field);
    key("?", field);

    expect(press).not.toHaveBeenCalled();
    expect(board.selectTab).not.toHaveBeenCalled();
    expect(openShortcuts).not.toHaveBeenCalled();
  });

  it("blocks the single keys under an open act dialog", () => {
    acts = [buttonAct("resume")];
    renderBoard(<div role="alertdialog" aria-label="Resume" />);

    key("2");
    key("r");

    expect(board.selectTab).not.toHaveBeenCalled();
    expect(press).not.toHaveBeenCalled();
  });

  it("blocks the single keys under another open dialog", () => {
    renderBoard(<div role="dialog" aria-label="More" />);

    key("2");

    expect(board.selectTab).not.toHaveBeenCalled();
  });

  it("does not block the single keys under the detail sheet", () => {
    renderBoard(<div role="dialog" aria-label="Detail" data-board-detail="" />);

    key("2");

    expect(board.selectTab).toHaveBeenCalledTimes(1);
  });

  it("ignores a key with a modifier", () => {
    acts = [buttonAct("resume")];
    renderBoard();
    const target = screen.getByRole("button", { name: "card" });
    target.focus();

    fireEvent.keyDown(target, { key: "r", ctrlKey: true });
    fireEvent.keyDown(target, { key: "2", metaKey: true });

    expect(press).not.toHaveBeenCalled();
    expect(board.selectTab).not.toHaveBeenCalled();
  });
});

describe("useBoardKeys with the shortcuts off", () => {
  beforeEach(() => {
    window.localStorage.setItem("kd-board-shortcuts", "off");
  });

  it("does nothing for 1 to 6, j, k, p, ? and the act letters", () => {
    acts = [buttonAct("resume")];
    widthClass = BOARD_WIDTH.Medium;
    board.openId = "b";
    renderBoard();

    for (const name of ["2", "j", "k", "p", "?", "r"]) key(name);

    expect(board.selectTab).not.toHaveBeenCalled();
    expect(board.step).not.toHaveBeenCalled();
    expect(board.select).not.toHaveBeenCalled();
    expect(board.selectProject).not.toHaveBeenCalled();
    expect(openShortcuts).not.toHaveBeenCalled();
    expect(press).not.toHaveBeenCalled();
  });

  it("keeps the arrows, Home, End, Enter and Esc", () => {
    renderBoard();

    key("ArrowDown");
    key("Home");
    key("End");
    key("Enter");
    key("Escape", screen.getByRole("button", { name: "pane" }));

    expect(board.select).toHaveBeenCalledTimes(3);
    expect(board.open).toHaveBeenCalledTimes(1);
    expect(board.focusCard).toHaveBeenLastCalledWith("b");
  });
});
