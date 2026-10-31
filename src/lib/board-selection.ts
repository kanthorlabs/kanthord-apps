import type { AttentionItem } from "./attention";
import type { BoardGate } from "./board-items";

export function tabStopIdOf(
  cards: readonly AttentionItem[],
  selectedId: string | null,
): string | null | undefined {
  return cards.some((card) => card.id === selectedId) ? selectedId : cards[0]?.id;
}

export function heldCountOf(held: ReadonlyMap<string, readonly string[]>, itemId: string): number {
  return held.get(itemId)?.length ?? 0;
}

export function selectedGateOf(
  gates: ReadonlyMap<string, BoardGate>,
  selected: AttentionItem | null,
): BoardGate | null {
  return selected === null ? null : (gates.get(selected.id) ?? null);
}
