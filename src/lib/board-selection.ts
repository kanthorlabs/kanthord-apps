import type { AttentionItem } from "./attention";
import { type BoardGate, startItemOf } from "./board-items";
import type { BoardTabId } from "./board-tabs";

export interface InitialSelection {
  readonly itemId: string;
  readonly tab: BoardTabId | null;
}

export function initialSelectionOf(
  ranked: readonly AttentionItem[],
  tabOf: ReadonlyMap<string, BoardTabId>,
): InitialSelection | null {
  const start = startItemOf(ranked);
  return start === null ? null : { itemId: start.id, tab: tabOf.get(start.id) ?? null };
}

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
