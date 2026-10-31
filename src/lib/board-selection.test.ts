import { describe, expect, it } from "vitest";

import type { AttentionItem } from "./attention";
import type { BoardGate } from "./board-items";
import { heldCountOf, initialSelectionOf, selectedGateOf, tabStopIdOf } from "./board-selection";
import { BOARD_TAB, type BoardTabId } from "./board-tabs";

function card(id: string): AttentionItem {
  return { id } as unknown as AttentionItem;
}

describe("tabStopIdOf", () => {
  const cards = [card("a"), card("b")];

  it("keeps the tab stop on the selected card", () => {
    expect(tabStopIdOf(cards, "b")).toBe("b");
  });

  it("falls back to the first card when the selection is not in the list", () => {
    expect(tabStopIdOf(cards, "z")).toBe("a");
    expect(tabStopIdOf(cards, null)).toBe("a");
  });

  it("has no tab stop for an empty list", () => {
    expect(tabStopIdOf([], null)).toBeUndefined();
  });
});

describe("heldCountOf", () => {
  const held = new Map([["a", ["n1", "n2"]]]);

  it("counts the nodes that the card holds", () => {
    expect(heldCountOf(held, "a")).toBe(2);
  });

  it("counts zero for a card that holds none", () => {
    expect(heldCountOf(held, "b")).toBe(0);
  });
});

describe("selectedGateOf", () => {
  const gate: BoardGate = { itemId: "a", need: "a credential", short: "credential" };
  const gates = new Map([["a", gate]]);

  it("returns the gate of the selected item", () => {
    expect(selectedGateOf(gates, card("a"))).toBe(gate);
  });

  it("returns null without a selection or a gate", () => {
    expect(selectedGateOf(gates, null)).toBeNull();
    expect(selectedGateOf(gates, card("b"))).toBeNull();
  });
});

describe("initialSelectionOf", () => {
  const ranked = [card("outside"), card("rule"), card("tool")];

  it("selects the Start here item and its tab, not the first card of the first tab", () => {
    const tabOf = new Map<string, BoardTabId>([
      ["tool", BOARD_TAB.Tool],
      ["rule", BOARD_TAB.Rule],
      ["outside", BOARD_TAB.Outside],
    ]);

    expect(initialSelectionOf(ranked, tabOf)).toEqual({
      itemId: "outside",
      tab: BOARD_TAB.Outside,
    });
  });

  it("selects nothing for an empty list", () => {
    expect(initialSelectionOf([], new Map())).toBeNull();
  });
});
