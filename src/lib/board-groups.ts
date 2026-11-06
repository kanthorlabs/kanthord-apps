import type { AttentionItem } from "./attention";
import { BOARD_TAB, type BoardTab } from "./board-tabs";
import { INBOX_REASONS } from "./inbox-reasons";

export interface CardGroup {
  readonly key: string;
  readonly header: string | null;
  readonly cards: readonly AttentionItem[];
}

export function cardGroupsOf(tab: BoardTab, cards: readonly AttentionItem[]): readonly CardGroup[] {
  if (tab.id !== BOARD_TAB.Inbox) return [{ key: tab.id, header: null, cards }];
  return INBOX_REASONS.flatMap((entry): readonly CardGroup[] => {
    const group = cards.filter(
      (card) => card.kind === "inbox_item" && card.inbox.reason === entry.reason,
    );
    if (group.length === 0) return [];
    return [{ key: entry.reason, header: `${entry.label} · ${group.length}`, cards: group }];
  });
}
