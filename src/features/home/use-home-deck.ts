import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { AttentionDetails, AttentionItem } from "@/lib/attention";
import type { BoardGate } from "@/lib/board-items";
import type { ActedAct } from "@/lib/board-done";
import type { BoardTabId } from "@/lib/board-tabs";
import type { BoardSummary } from "@/lib/board-text";
import { deckRowTextOf } from "@/lib/deck-card";
import {
  DECK_PAGE_SIZE,
  deckCountTextOf,
  deckListOf,
  deckOrderOf,
  type DeckRow,
  deckSummaryOf,
  type DeckTabEntry,
  deckTabsOf,
  doneTextOf,
  heldCountOf,
  isAct,
} from "@/lib/home-deck";

import { type DeckSwipe, useDeckSwipe } from "./use-deck-swipe";
import type { OverviewState } from "./use-overview";

export const DECK_EXIT_MS = 220;
const DECK_GONE_MS = 1500;
const MAX_TILTED = 3;

export interface HomeDeckInput {
  readonly items: readonly AttentionItem[];
  readonly held: ReadonlyMap<string, readonly string[]>;
  readonly gates: ReadonlyMap<string, BoardGate>;
  readonly details: AttentionDetails;
  readonly now: number;
  readonly status: OverviewState["status"];
  readonly loaded: boolean;
  readonly inbox: number;
  readonly readFault: boolean;
  readonly setDialogOpen: OverviewState["setDialogOpen"];
}

interface DeckExit {
  readonly phase: "gone" | "leave";
  readonly item: AttentionItem;
  readonly index: number;
}

interface DeckList {
  readonly query: string;
  readonly tab: BoardTabId | null;
  readonly shown: number;
}

interface LastKnown {
  readonly item: AttentionItem;
  readonly index: number;
}

interface DeckState {
  readonly cursorId: string | null;
  readonly known: ReadonlySet<string> | null;
  readonly fresh: ReadonlySet<string>;
  readonly settled: ReadonlySet<string>;
  readonly acted: ReadonlySet<string>;
  readonly last: LastKnown | null;
  readonly exit: DeckExit | null;
  readonly list: DeckList | null;
  readonly live: string | null;
}

export interface DeckSecondary {
  readonly item: AttentionItem;
  readonly rank: number;
  readonly tab: string;
  readonly isNew: boolean;
}

export interface DeckListView extends DeckList {
  readonly rows: readonly DeckRow[];
  readonly count: number;
  readonly tabs: readonly DeckTabEntry[];
  readonly total: number;
  readonly hasMore: boolean;
}

export interface HomeDeck {
  readonly order: readonly AttentionItem[];
  readonly rank: number;
  readonly primary: AttentionItem | null;
  readonly primaryHeld: number;
  readonly secondary: DeckSecondary | null;
  readonly tilted: number;
  readonly gone: boolean;
  readonly leaving: boolean;
  readonly canPrevious: boolean;
  readonly canNext: boolean;
  readonly countText: string;
  readonly summary: BoardSummary;
  readonly live: string | null;
  readonly list: DeckListView | null;
  readonly step: (delta: number) => void;
  readonly select: (itemId: string) => void;
  readonly selectFirst: () => void;
  readonly markActed: (itemId: string) => void;
  readonly setDialogOpen: (itemId: string, nodeId: string, open: boolean, act?: ActedAct) => void;
  readonly toggleList: () => void;
  readonly setQuery: (query: string) => void;
  readonly setTab: (tab: BoardTabId | null) => void;
  readonly showMore: () => void;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  readonly swipe: DeckSwipe;
}

const NO_IDS: ReadonlySet<string> = new Set();

function without(ids: ReadonlySet<string>, id: string | null): ReadonlySet<string> {
  if (id === null || !ids.has(id)) return ids;
  const next = new Set(ids);
  next.delete(id);
  return next;
}

function sameSet(left: ReadonlySet<string>, right: ReadonlySet<string>): boolean {
  return left === right || (left.size === right.size && [...left].every((id) => right.has(id)));
}

function keepOnly(ids: ReadonlySet<string>, present: ReadonlySet<string>): ReadonlySet<string> {
  const kept = new Set([...ids].filter((id) => present.has(id)));
  return kept.size === ids.size ? ids : kept;
}

interface Derived {
  readonly status: OverviewState["status"];
  readonly loaded: boolean;
  readonly items: readonly AttentionItem[];
  readonly order: readonly AttentionItem[];
}

function admit(state: DeckState, present: ReadonlySet<string>): DeckState {
  if (state.known === null) return { ...state, known: new Set(present), fresh: NO_IDS };
  const added = [...present].filter((id) => !state.known?.has(id));
  if (added.length === 0) return state;
  return {
    ...state,
    known: new Set([...state.known, ...added]),
    fresh: new Set([...state.fresh, ...added]),
  };
}

function advance(state: DeckState, { status, loaded, items, order }: Derived): DeckState {
  if (status !== "ready") return state;
  const present = new Set(items.map((item) => item.id));
  const admitted = loaded ? admit(state, present) : state;
  const cursorId = admitted.cursorId ?? order[0]?.id ?? null;
  const fresh = without(keepOnly(admitted.fresh, present), cursorId);
  const settled = keepOnly(admitted.settled, present);
  const acted = keepOnly(admitted.acted, present);
  const index = order.findIndex((item) => item.id === cursorId);
  const item = order[index];
  const last =
    item === undefined || (admitted.last?.item === item && admitted.last.index === index)
      ? admitted.last
      : { item, index };
  const exit =
    admitted.exit === null && cursorId !== null && item === undefined && last?.item.id === cursorId
      ? {
          phase: admitted.acted.has(cursorId) ? ("leave" as const) : ("gone" as const),
          item: last.item,
          index: last.index,
        }
      : admitted.exit;
  const changed =
    admitted !== state ||
    cursorId !== admitted.cursorId ||
    !sameSet(fresh, admitted.fresh) ||
    !sameSet(settled, admitted.settled) ||
    !sameSet(acted, admitted.acted) ||
    last !== admitted.last ||
    exit !== admitted.exit;
  return changed ? { ...admitted, cursorId, fresh, settled, acted, last, exit } : state;
}

function settle(state: DeckState, input: HomeDeckInput): DeckState {
  const { exit } = state;
  if (exit === null) return state;
  const settled = new Set(state.settled).add(exit.item.id);
  const order = deckOrderOf(
    input.items.filter((item) => !settled.has(item.id)),
    input.held,
    input.gates,
  );
  const index = Math.min(exit.index, order.length - 1);
  const target = order[index];
  return {
    ...state,
    settled,
    exit: null,
    cursorId: target?.id ?? null,
    fresh: without(state.fresh, target?.id ?? null),
    last: target === undefined ? null : { item: target, index },
    live: doneTextOf(exit.item.subject, order.length),
  };
}

function isTextTarget(target: Element): boolean {
  return target.closest("input, textarea, select, [contenteditable='true']") !== null;
}

function isGroupTarget(target: Element): boolean {
  return target.closest("[data-slot='toggle-group']") !== null;
}

function emptyState(): DeckState {
  return {
    cursorId: null,
    known: null,
    fresh: NO_IDS,
    settled: NO_IDS,
    acted: NO_IDS,
    last: null,
    exit: null,
    list: null,
    live: null,
  };
}

export function useHomeDeck(input: HomeDeckInput): HomeDeck {
  const {
    items,
    held,
    gates,
    details,
    now,
    status,
    loaded,
    inbox,
    readFault,
    setDialogOpen: setOverviewDialogOpen,
  } = input;
  const [state, setState] = useState(emptyState);
  const order = useMemo(
    () =>
      deckOrderOf(
        items.filter((item) => !state.settled.has(item.id)),
        held,
        gates,
      ),
    [items, held, gates, state.settled],
  );
  const current = advance(state, { status, loaded, items, order });
  if (current !== state) setState(current);

  const latest = useRef({ input, order, state: current });
  useEffect(() => {
    latest.current = { input, order, state: current };
  });

  const { exit } = current;
  useEffect(() => {
    if (exit === null) return undefined;
    const wait = exit.phase === "gone" ? DECK_GONE_MS : DECK_EXIT_MS;
    const timer = setTimeout(() => {
      setState((existing) => {
        if (existing.exit !== exit) return existing;
        if (exit.phase === "gone") return { ...existing, exit: { ...exit, phase: "leave" } };
        return settle(existing, latest.current.input);
      });
    }, wait);
    return () => clearTimeout(timer);
  }, [exit]);

  const index = order.findIndex((item) => item.id === current.cursorId);
  const primary = order[index] ?? exit?.item ?? null;
  const rank = (index >= 0 ? index : (exit?.index ?? 0)) + 1;
  const next = index >= 0 ? order[index + 1] : undefined;
  const acts = order.filter(isAct);

  const step = useCallback((delta: number) => {
    const { order: shown, state: existing } = latest.current;
    const from = shown.findIndex((item) => item.id === existing.cursorId);
    const target = shown[from + delta];
    if (existing.exit !== null || from < 0 || target === undefined) return;
    setState((prior) => ({
      ...prior,
      cursorId: target.id,
      fresh: without(prior.fresh, target.id),
      live: null,
    }));
  }, []);

  const select = useCallback((itemId: string) => {
    const { order: shown, state: existing } = latest.current;
    if (existing.exit !== null || !shown.some((item) => item.id === itemId)) return;
    setState((prior) => ({
      ...prior,
      cursorId: itemId,
      fresh: without(prior.fresh, itemId),
      list: null,
      live: null,
    }));
  }, []);

  const selectFirst = useCallback(() => {
    const first = latest.current.order[0];
    if (first !== undefined) select(first.id);
  }, [select]);

  const noteActed = useCallback((itemId: string) => {
    setState((prior) => {
      const gone = prior.exit?.phase === "gone" && prior.exit.item.id === itemId;
      if (prior.acted.has(itemId) && !gone) return prior;
      return {
        ...prior,
        acted: new Set(prior.acted).add(itemId),
        exit: gone && prior.exit !== null ? { ...prior.exit, phase: "leave" } : prior.exit,
      };
    });
  }, []);

  const setDialogOpen = useCallback(
    (itemId: string, nodeId: string, open: boolean, act?: ActedAct) => {
      setOverviewDialogOpen(itemId, nodeId, open);
      if (!open && act !== undefined) noteActed(itemId);
    },
    [setOverviewDialogOpen, noteActed],
  );

  const markActed = useCallback((itemId: string) => {
    const { order: shown, state: existing } = latest.current;
    const at = shown.findIndex((item) => item.id === itemId);
    const item = shown[at];
    if (item === undefined || existing.exit !== null) return;
    setState((prior) =>
      itemId === prior.cursorId
        ? { ...prior, exit: { phase: "leave", item, index: at }, live: null }
        : {
            ...prior,
            settled: new Set(prior.settled).add(itemId),
            live: doneTextOf(item.subject, shown.length - 1),
          },
    );
  }, []);

  const toggleList = useCallback(() => {
    setState((prior) => ({
      ...prior,
      list: prior.list === null ? { query: "", tab: null, shown: DECK_PAGE_SIZE } : null,
    }));
  }, []);

  const setQuery = useCallback((query: string) => {
    setState((prior) =>
      prior.list === null
        ? prior
        : { ...prior, list: { ...prior.list, query, shown: DECK_PAGE_SIZE } },
    );
  }, []);

  const setTab = useCallback((tab: BoardTabId | null) => {
    setState((prior) =>
      prior.list === null
        ? prior
        : { ...prior, list: { ...prior.list, tab, shown: DECK_PAGE_SIZE } },
    );
  }, []);

  const showMore = useCallback(() => {
    setState((prior) =>
      prior.list === null
        ? prior
        : { ...prior, list: { ...prior.list, shown: prior.list.shown + DECK_PAGE_SIZE } },
    );
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const target = event.target as Element;
    if (!event.currentTarget.contains(target) || event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "Escape") {
      if (current.list !== null) toggleList();
      return;
    }
    const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (delta === 0 || isTextTarget(target) || isGroupTarget(target)) return;
    event.preventDefault();
    step(delta);
  };

  const swipe = useDeckSwipe(step);

  const position = Math.max(0, Math.min(rank - 1, order.length - 1));
  const listQuery = current.list;
  const matches = listQuery === null ? null : deckListOf(order, details, listQuery);

  return {
    order,
    rank,
    primary,
    primaryHeld: primary === null ? 0 : (held.get(primary.id)?.length ?? 0),
    secondary:
      next === undefined
        ? null
        : {
            item: next,
            rank: index + 2,
            tab: deckRowTextOf(next, details, now).tab,
            isNew: current.fresh.has(next.id),
          },
    tilted: index < 0 ? 0 : Math.min(MAX_TILTED, order.length - 1 - index),
    gone: exit?.phase === "gone",
    leaving: exit?.phase === "leave",
    canPrevious: index > 0,
    canNext: index >= 0 && index < order.length - 1,
    countText: deckCountTextOf({
      index: position,
      total: order.length,
      acts: acts.length,
      held: heldCountOf(acts, held),
    }),
    summary: deckSummaryOf(order, { details, held, inbox, readFault }),
    live: current.live,
    list:
      listQuery === null || matches === null
        ? null
        : {
            ...listQuery,
            rows: matches.rows,
            count: matches.count,
            tabs: deckTabsOf(order, details),
            total: order.length,
            hasMore: matches.count > matches.rows.length,
          },
    step,
    select,
    selectFirst,
    markActed,
    setDialogOpen,
    toggleList,
    setQuery,
    setTab,
    showMore,
    onKeyDown,
    swipe,
  };
}
