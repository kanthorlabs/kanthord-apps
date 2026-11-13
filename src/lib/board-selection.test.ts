import { describe, expect, it } from "vitest";

import type { AttentionItem } from "./attention";
import type { BoardGate } from "./board-items";
import { selectedGateOf } from "./board-selection";

function card(id: string): AttentionItem {
  return { id } as unknown as AttentionItem;
}

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
