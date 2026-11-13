import type { AttentionItem } from "./attention";
import type { BoardGate } from "./board-items";

export function selectedGateOf(
  gates: ReadonlyMap<string, BoardGate>,
  selected: AttentionItem | null,
): BoardGate | null {
  return selected === null ? null : (gates.get(selected.id) ?? null);
}
