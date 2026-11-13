import type { Project } from "@/api/types";

import type { AttentionDetails, AttentionItem } from "./attention";
import { boardProjectsOf } from "./board-items";
import { boardTabNamed, boardTabOf } from "./board-tabs";
import { cardCauseOf, cardLabelOf, detailTitleOf } from "./board-text";
import { heldOnTextOf, waitingTextOf } from "./home-deck";

export interface DeckCardText {
  readonly tab: string;
  readonly projects: readonly Project[];
  readonly waiting: string;
  readonly heldOn: string | null;
  readonly label: string | null;
  readonly title: string;
  readonly cause: string;
}

export interface DeckRowText {
  readonly tab: string;
  readonly waiting: string;
  readonly cause: string;
}

export function deckCardTextOf(
  item: AttentionItem,
  details: AttentionDetails,
  now: number,
  held: number,
): DeckCardText {
  return {
    tab: boardTabNamed(boardTabOf(item, details)).name,
    projects: boardProjectsOf(item),
    waiting: waitingTextOf(item.at, now),
    heldOn: heldOnTextOf(held),
    label: cardLabelOf(item),
    title: detailTitleOf(item, details),
    cause: cardCauseOf(item),
  };
}

export function deckRowTextOf(
  item: AttentionItem,
  details: AttentionDetails,
  now: number,
): DeckRowText {
  return {
    tab: boardTabNamed(boardTabOf(item, details)).short,
    waiting: waitingTextOf(item.at, now),
    cause: cardCauseOf(item),
  };
}
