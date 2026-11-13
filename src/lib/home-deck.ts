import type { AttentionDetails, AttentionItem } from "./attention";
import { type BoardGate, boardProjectsOf, compareAt, rankBoardItems } from "./board-items";
import {
  BOARD_TABS,
  type BoardTab,
  type BoardTabId,
  boardTabNamed,
  boardTabOf,
} from "./board-tabs";
import { type BoardSummary, boardSummaryOf, cardCauseOf, heldText } from "./board-text";
import { counted } from "./counted";
import { durationText, utcShortDateTime } from "./format";

const DECK_FIRST_KINDS: readonly AttentionItem["kind"][] = ["tool_approval"];
export const DECK_PAGE_SIZE = 50;
export const DECK_GONE_TEXT = "The selected item no longer waits.";

const SEPARATOR = " · ";
const UTC_DAY_LENGTH = 10;
const UTC_CLOCK_START = 11;
const UTC_CLOCK_END = 16;

export function deckOrderOf(
  items: readonly AttentionItem[],
  held: ReadonlyMap<string, readonly string[]>,
  gates: ReadonlyMap<string, BoardGate>,
): readonly AttentionItem[] {
  const isFirst = (item: AttentionItem) => DECK_FIRST_KINDS.includes(item.kind);
  const first = items
    .filter(isFirst)
    .sort((left, right) => compareAt(left.at, right.at) || left.id.localeCompare(right.id));
  return [
    ...first,
    ...rankBoardItems(
      items.filter((item) => !isFirst(item)),
      held,
      gates,
    ),
  ];
}

export interface DeckQueueEntry {
  readonly id: string;
  readonly subject: string;
  readonly rank: number;
}

export function queueEntryOf(
  order: readonly AttentionItem[],
  sessionId: string | null,
): DeckQueueEntry | null {
  if (sessionId === null) return null;
  const index = order.findIndex((item) => item.id === `tool_approval:${sessionId}`);
  const item = order[index];
  return item === undefined ? null : { id: item.id, subject: item.subject, rank: index + 1 };
}

export function heldCountOf(
  cards: readonly AttentionItem[],
  held: ReadonlyMap<string, readonly string[]>,
): number {
  return new Set(cards.flatMap((card) => held.get(card.id) ?? [])).size;
}

export function isAct(item: AttentionItem): boolean {
  return item.kind !== "inbox_item";
}

export interface DeckCountInput {
  readonly index: number;
  readonly total: number;
  readonly acts: number;
  readonly held: number;
}

export function deckCountTextOf(input: DeckCountInput): string {
  return `${input.index + 1} of ${input.total} waiting${SEPARATOR}${counted(input.acts, "act", "acts")}${SEPARATOR}${heldText(input.held)}`;
}

export function waitingTextOf(at: number | null, now: number): string {
  if (at === null) return "Waiting · age unknown";
  const atIso = new Date(at).toISOString();
  const sameDay =
    atIso.slice(0, UTC_DAY_LENGTH) === new Date(now).toISOString().slice(0, UTC_DAY_LENGTH);
  const time = sameDay ? atIso.slice(UTC_CLOCK_START, UTC_CLOCK_END) : utcShortDateTime(at);
  return `Waiting ${durationText(now - at)}${SEPARATOR}since ${time}`;
}

export function heldOnTextOf(count: number): string | null {
  if (count === 0) return null;
  return counted(count, "node waits on this", "nodes wait on this");
}

export function doneTextOf(subject: string, remaining: number): string {
  return `Done: ${subject}${SEPARATOR}${counted(remaining, "item waits", "items wait")}`;
}

export interface DeckSummaryInput {
  readonly details: AttentionDetails;
  readonly held: ReadonlyMap<string, readonly string[]>;
  readonly inbox: number;
  readonly readFault: boolean;
}

export function deckSummaryOf(
  order: readonly AttentionItem[],
  input: DeckSummaryInput,
): BoardSummary {
  const acts = order.filter(isAct);
  const first = order[0];
  return boardSummaryOf({
    count: acts.length,
    held: heldCountOf(acts, input.held),
    start:
      first === undefined
        ? null
        : { subject: first.subject, tab: boardTabNamed(boardTabOf(first, input.details)) },
    readFault: input.readFault,
    inbox: input.inbox,
  });
}

export interface DeckTabEntry {
  readonly tab: BoardTab;
  readonly count: number;
}

export function deckTabsOf(
  order: readonly AttentionItem[],
  details: AttentionDetails,
): readonly DeckTabEntry[] {
  return BOARD_TABS.map((tab) => ({
    tab,
    count: order.filter((item) => boardTabOf(item, details) === tab.id).length,
  })).filter((entry) => entry.count > 0);
}

export interface DeckListQuery {
  readonly query: string;
  readonly tab: BoardTabId | null;
  readonly shown: number;
}

export interface DeckRow {
  readonly item: AttentionItem;
  readonly rank: number;
}

export interface DeckList {
  readonly rows: readonly DeckRow[];
  readonly count: number;
}

function searchTextsOf(item: AttentionItem): readonly string[] {
  const author = item.kind === "inbox_item" ? (item.inbox.content?.author ?? "") : "";
  return [
    item.subject,
    cardCauseOf(item),
    author,
    ...boardProjectsOf(item).map((project) => project.name),
  ];
}

export function deckListOf(
  order: readonly AttentionItem[],
  details: AttentionDetails,
  { query, tab, shown }: DeckListQuery,
): DeckList {
  const needle = query.trim().toLowerCase();
  const matches = order
    .map((item, index) => ({ item, rank: index + 1 }))
    .filter(({ item }) => tab === null || boardTabOf(item, details) === tab)
    .filter(
      ({ item }) =>
        needle === "" || searchTextsOf(item).some((text) => text.toLowerCase().includes(needle)),
    );
  return { rows: matches.slice(0, shown), count: matches.length };
}
