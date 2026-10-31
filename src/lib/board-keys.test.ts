import { describe, expect, it } from "vitest";

import {
  actKeyOf,
  actKeysOf,
  BOARD_KEYS,
  BOARD_SHORTCUTS,
  type BoardKeyEvent,
  boardKeyOf,
} from "./board-keys";
import { BOARD_TABS } from "./board-tabs";

function press(key: string, modifiers: Partial<BoardKeyEvent> = {}): BoardKeyEvent {
  return { key, ctrlKey: false, metaKey: false, altKey: false, ...modifiers };
}

describe("BOARD_KEYS", () => {
  it("maps each act to its letter", () => {
    expect(BOARD_KEYS).toEqual({
      approve: "a",
      reject: "n",
      open: "o",
      check: "c",
      verify: "c",
      rotate: "w",
      resume: "r",
      onboarding: "y",
      unblock: "u",
      override: "v",
      discard: "x",
      decide: "d",
      remove: "m",
      goto: "f",
      trace: "t",
    });
  });

  it("lists every act letter in the shortcuts", () => {
    const keys = BOARD_SHORTCUTS.map((shortcut) => shortcut.keys);

    for (const letter of Object.values(BOARD_KEYS)) expect(keys).toContain(letter);
    expect(new Set(BOARD_SHORTCUTS.map((shortcut) => shortcut.id)).size).toBe(
      BOARD_SHORTCUTS.length,
    );
  });
});

describe("boardKeyOf", () => {
  it("answers the tab of the keys 1 to 6 in tab order", () => {
    BOARD_TABS.forEach((tab, index) => {
      expect(boardKeyOf(press(String(index + 1)), true)).toEqual({ type: "tab", tab: tab.id });
    });
  });

  it("answers the move, the step, the filter and the shortcuts", () => {
    expect(boardKeyOf(press("j"), true)).toEqual({ type: "step", delta: 1 });
    expect(boardKeyOf(press("k"), true)).toEqual({ type: "step", delta: -1 });
    expect(boardKeyOf(press("p"), true)).toEqual({ type: "filter" });
    expect(boardKeyOf(press("?"), true)).toEqual({ type: "shortcuts" });
    expect(boardKeyOf(press("ArrowDown"), true)).toEqual({ type: "move", to: "next" });
    expect(boardKeyOf(press("ArrowUp"), true)).toEqual({ type: "move", to: "previous" });
    expect(boardKeyOf(press("Home"), true)).toEqual({ type: "move", to: "first" });
    expect(boardKeyOf(press("End"), true)).toEqual({ type: "move", to: "last" });
    expect(boardKeyOf(press("Enter"), true)).toEqual({ type: "enter" });
    expect(boardKeyOf(press("Escape"), true)).toEqual({ type: "escape" });
  });

  it("answers the act of each act letter", () => {
    for (const letter of Object.values(BOARD_KEYS)) {
      expect(boardKeyOf(press(letter), true)).toEqual({ type: "act", key: letter });
    }
  });

  it("answers null for a key that no command uses", () => {
    expect(boardKeyOf(press("z"), true)).toBeNull();
    expect(boardKeyOf(press("7"), true)).toBeNull();
  });

  it("answers null for a key with a modifier", () => {
    expect(boardKeyOf(press("r", { ctrlKey: true }), true)).toBeNull();
    expect(boardKeyOf(press("2", { metaKey: true }), true)).toBeNull();
    expect(boardKeyOf(press("j", { altKey: true }), true)).toBeNull();
    expect(boardKeyOf(press("ArrowDown", { metaKey: true }), true)).toBeNull();
  });

  it("answers null for a single-key shortcut when the shortcuts are off", () => {
    for (const key of ["1", "6", "j", "k", "p", "?", "r", "c"]) {
      expect(boardKeyOf(press(key), false)).toBeNull();
    }
  });

  it("keeps the arrows, Home, End, Enter and Esc when the shortcuts are off", () => {
    for (const key of ["ArrowDown", "ArrowUp", "Home", "End", "Enter", "Escape"]) {
      expect(boardKeyOf(press(key), false)).not.toBeNull();
    }
  });
});

describe("actKeyOf", () => {
  it("answers the letter of each act of the board", () => {
    expect(actKeyOf("resume")).toBe("r");
    expect(actKeyOf("check")).toBe("c");
    expect(actKeyOf("last_trace")).toBe("t");
    expect(actKeyOf("open_chat")).toBe("o");
    expect(actKeyOf("fix_target")).toBe("f");
    expect(actKeyOf("remove:node_2")).toBe("m");
  });

  it("answers the letter of each in-place act", () => {
    expect(actKeyOf("approve")).toBe("a");
    expect(actKeyOf("reject")).toBe("n");
    expect(actKeyOf("rotate")).toBe("w");
    expect(actKeyOf("verify")).toBe("c");
    expect(actKeyOf("onboarding")).toBe("y");
    expect(actKeyOf("goto")).toBe("f");
    expect(actKeyOf("open")).toBe("o");
    expect(actKeyOf("open_pull_request")).toBe("o");
  });

  it("answers null for an act without a letter", () => {
    expect(actKeyOf("check_badge")).toBeNull();
    expect(actKeyOf("resume_project")).toBeNull();
  });
});

describe("actKeysOf", () => {
  it("gives a letter to the first act only when two acts share it", () => {
    const keys = actKeysOf(["remove:a", "remove:b", "check", "check_badge", "discard"]);

    expect([...keys]).toEqual([
      ["remove:a", "m"],
      ["check", "c"],
      ["discard", "x"],
    ]);
  });
});
