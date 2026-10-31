import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { Project } from "@/api/types";
import type { AttentionItem } from "@/lib/attention";
import { BOARD_TAB, BOARD_TABS, type BoardTabId, boardTabOf } from "@/lib/board-tabs";
import { isInProject, rankBoardItems, startItemOf } from "@/lib/board-items";
import { type BoardSummary, boardSummaryOf } from "@/lib/board-text";
import { boardParamsOf, boardUrlOf, type BoardUrlState } from "@/lib/board-url";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import type { OverviewState } from "./use-overview";

export type BoardOverview = Pick<
  OverviewState,
  | "status"
  | "boardItems"
  | "gates"
  | "held"
  | "details"
  | "projects"
  | "faults"
  | "updatedAt"
  | "setDialogOpen"
>;

export interface BoardCounts {
  readonly tabs: Readonly<Record<BoardTabId, number>>;
  readonly held: Readonly<Record<BoardTabId, number>>;
  readonly view: number;
  readonly all: number;
  readonly projects: Readonly<Record<string, number>>;
}

export interface GoneItem {
  readonly id: string;
  readonly item: AttentionItem | null;
}

export interface Board {
  readonly tab: BoardTabId;
  readonly selectTab: (tab: BoardTabId) => void;
  readonly projectId: string | null;
  readonly selectProject: (projectId: string | null) => void;
  readonly cards: readonly AttentionItem[];
  readonly counts: BoardCounts;
  readonly selectedId: string | null;
  readonly selected: AttentionItem | null;
  readonly select: (itemId: string) => void;
  readonly openId: string | null;
  readonly open: (itemId: string) => void;
  readonly close: () => void;
  readonly gone: GoneItem | null;
  readonly summary: BoardSummary;
  readonly startItem: AttentionItem | null;
  readonly step: (delta: number) => void;
  readonly position: number | null;
  readonly total: number;
  readonly markActed: (itemId: string) => void;
  readonly setDialogOpen: (itemId: string, nodeId: string, open: boolean) => void;
  readonly cardRef: (itemId: string) => (element: HTMLElement | null) => void;
  readonly titleRef: (element: HTMLElement | null) => void;
  readonly allClearRef: (element: HTMLElement | null) => void;
}

interface UrlSeen {
  readonly item: string | null;
  readonly kind: BoardTabId | null;
}

interface Handoff {
  readonly itemId: string;
  readonly index: number;
  readonly tab: BoardTabId;
  readonly readAt: number | null;
}

type FocusRequest =
  | { readonly target: "title" }
  | { readonly target: "all_clear" }
  | { readonly target: "card"; readonly itemId: string }
  | { readonly target: "card_if_lost"; readonly itemId: string | null };

interface BoardState {
  readonly kind: BoardTabId | null;
  readonly selectedId: string | null;
  readonly settled: boolean;
  readonly openId: string | null;
  readonly pendingOpen: string | null;
  readonly lastItem: AttentionItem | null;
  readonly seenUrl: UrlSeen | null;
  readonly seenWidth: BoardWidth;
  readonly handoff: Handoff | null;
  readonly focus: FocusRequest | null;
}

interface Derived {
  readonly urlItem: string | null;
  readonly urlKind: BoardTabId | null;
  readonly status: BoardOverview["status"];
  readonly items: readonly AttentionItem[];
  readonly tabOf: ReadonlyMap<string, BoardTabId>;
  readonly start: AttentionItem | null;
  readonly cardsByTab: Readonly<Record<BoardTabId, readonly AttentionItem[]>>;
  readonly widthClass: BoardWidth;
  readonly updatedAt: number | null;
}

type Advance = (state: BoardState, derived: Derived) => BoardState;

const FIRST_TAB = BOARD_TAB.Tool;

function cardsOf(
  ranked: readonly AttentionItem[],
  tabOf: ReadonlyMap<string, BoardTabId>,
  projectId: string | null,
  tab: BoardTabId,
): readonly AttentionItem[] {
  return ranked.filter(
    (item) => tabOf.get(item.id) === tab && (projectId === null || isInProject(item, projectId)),
  );
}

function countsOf(
  ranked: readonly AttentionItem[],
  view: readonly AttentionItem[],
  tabOf: ReadonlyMap<string, BoardTabId>,
  held: ReadonlyMap<string, readonly string[]>,
  projects: readonly Project[],
): BoardCounts {
  const tabs = Object.fromEntries(
    BOARD_TABS.map((tab) => {
      const cards = view.filter((item) => tabOf.get(item.id) === tab.id);
      return [tab.id, { count: cards.length, held: heldCountOf(cards, held) }];
    }),
  ) as Record<BoardTabId, { count: number; held: number }>;
  return {
    tabs: Object.fromEntries(BOARD_TABS.map((tab) => [tab.id, tabs[tab.id].count])) as Record<
      BoardTabId,
      number
    >,
    held: Object.fromEntries(BOARD_TABS.map((tab) => [tab.id, tabs[tab.id].held])) as Record<
      BoardTabId,
      number
    >,
    view: view.length,
    all: ranked.length,
    projects: Object.fromEntries(
      projects.map((project) => [
        project.id,
        ranked.filter((item) => isInProject(item, project.id)).length,
      ]),
    ),
  };
}

function heldCountOf(
  cards: readonly AttentionItem[],
  held: ReadonlyMap<string, readonly string[]>,
): number {
  return new Set(cards.flatMap((card) => held.get(card.id) ?? [])).size;
}

function scopedProjectOf(projects: readonly Project[], id: string | null): string | null {
  return projects.some((project) => project.id === id) ? id : null;
}

const applyUrl: Advance = (state, { urlItem, urlKind }) => {
  const seen = state.seenUrl;
  if (seen !== null && seen.item === urlItem && seen.kind === urlKind) return state;
  const next = { ...state, seenUrl: { item: urlItem, kind: urlKind } };
  if (urlItem !== null && urlItem !== state.selectedId) {
    return { ...next, selectedId: urlItem, settled: true, kind: urlKind, pendingOpen: urlItem };
  }
  if (urlItem === null && urlKind !== null && urlKind !== state.kind) {
    return { ...next, kind: urlKind };
  }
  return next;
};

const trackWidth: Advance = (state, { widthClass }) => {
  const before = state.seenWidth;
  if (before === widthClass) return state;
  const next = { ...state, seenWidth: widthClass };
  if (widthClass === BOARD_WIDTH.Expanded) return { ...next, openId: null };
  if (before !== BOARD_WIDTH.Expanded) return next;
  return {
    ...next,
    openId: null,
    focus: { target: "card_if_lost", itemId: state.selectedId },
  };
};

const settleStart: Advance = (state, { start, tabOf, cardsByTab }) => {
  if (state.settled || start === null) return state;
  if (state.kind !== null) {
    return {
      ...state,
      settled: true,
      selectedId: cardsByTab[state.kind][0]?.id ?? null,
    };
  }
  return { ...state, settled: true, selectedId: start.id, kind: tabOf.get(start.id) ?? null };
};

const trackLast: Advance = (state, { items }) => {
  const selected = items.find((item) => item.id === state.selectedId);
  if (selected === undefined || selected === state.lastItem) return state;
  return { ...state, lastItem: selected };
};

const resolveOpen: Advance = (state, { items, status, widthClass }) => {
  if (state.pendingOpen === null) return state;
  const found = items.some((item) => item.id === state.selectedId);
  if (!found && status !== "ready") return state;
  if (widthClass === BOARD_WIDTH.Expanded) return { ...state, pendingOpen: null };
  return {
    ...state,
    pendingOpen: null,
    openId: state.pendingOpen,
    focus: { target: "title" },
  };
};

const resolveHandoff: Advance = (state, { items, cardsByTab, updatedAt, widthClass }) => {
  const { handoff } = state;
  if (handoff === null) return state;
  if (items.some((item) => item.id === handoff.itemId)) {
    return handoff.readAt === updatedAt ? state : { ...state, handoff: null };
  }
  const next = { ...state, handoff: null };
  if (state.selectedId !== handoff.itemId) return next;
  const cards = cardsByTab[handoff.tab];
  const target = cards[Math.min(handoff.index, cards.length - 1)];
  if (target === undefined) {
    return { ...next, selectedId: null, openId: null, focus: { target: "all_clear" } };
  }
  const expanded = widthClass === BOARD_WIDTH.Expanded;
  return {
    ...next,
    selectedId: target.id,
    openId: expanded ? state.openId : null,
    focus: expanded ? { target: "title" } : { target: "card", itemId: target.id },
  };
};

const ADVANCES: readonly Advance[] = [
  applyUrl,
  trackWidth,
  settleStart,
  trackLast,
  resolveOpen,
  resolveHandoff,
];

function advanceBoard(state: BoardState, derived: Derived): BoardState {
  return ADVANCES.reduce((acc, advance) => advance(acc, derived), state);
}

export function useBoard(overview: BoardOverview, widthClass: BoardWidth): Board {
  const { status, boardItems, gates, held, details, projects, faults, updatedAt } = overview;
  const [params, setParams] = useSearchParams();
  const url = useMemo(() => boardUrlOf(params), [params]);
  const { project: urlProject, item: urlItem, kind: urlKind } = url;
  const projectId = scopedProjectOf(projects, urlProject);

  const ranked = useMemo(() => rankBoardItems(boardItems, held, gates), [boardItems, held, gates]);
  const tabOf = useMemo(
    () => new Map(boardItems.map((item) => [item.id, boardTabOf(item, details)])),
    [boardItems, details],
  );
  const view = useMemo(
    () => (projectId === null ? ranked : ranked.filter((item) => isInProject(item, projectId))),
    [ranked, projectId],
  );
  const startItem = useMemo(() => startItemOf(view), [view]);

  const cardsByTab = useMemo(
    () =>
      Object.fromEntries(
        BOARD_TABS.map((entry) => [entry.id, cardsOf(ranked, tabOf, projectId, entry.id)]),
      ) as Record<BoardTabId, readonly AttentionItem[]>,
    [ranked, tabOf, projectId],
  );

  const [state, setState] = useState<BoardState>({
    kind: null,
    selectedId: null,
    settled: false,
    openId: null,
    pendingOpen: null,
    lastItem: null,
    seenUrl: null,
    seenWidth: widthClass,
    handoff: null,
    focus: null,
  });

  const derived: Derived = {
    urlItem,
    urlKind,
    status,
    items: boardItems,
    tabOf,
    start: startItem,
    cardsByTab,
    widthClass,
    updatedAt,
  };
  const current = advanceBoard(state, derived);
  if (current !== state) setState(current);

  const selected = boardItems.find((item) => item.id === current.selectedId) ?? null;
  const tab = (selected === null ? null : tabOf.get(selected.id)) ?? current.kind ?? FIRST_TAB;
  const cards = cardsByTab[tab];
  const counts = useMemo(
    () => countsOf(ranked, view, tabOf, held, projects),
    [ranked, view, tabOf, held, projects],
  );
  const summary = useMemo(() => {
    const startTab = BOARD_TABS.find((entry) => entry.id === tabOf.get(startItem?.id ?? ""));
    return boardSummaryOf({
      count: view.length,
      held: heldCountOf(view, held),
      start:
        startItem === null || startTab === undefined
          ? null
          : { subject: startItem.subject, tab: startTab },
      projectName: projects.find((project) => project.id === projectId)?.name ?? null,
      readFault: faults.length > 0,
    });
  }, [view, held, startItem, tabOf, projects, projectId, faults]);

  const index = cards.findIndex((card) => card.id === current.selectedId);
  const position = index < 0 ? null : index;
  const gone =
    current.selectedId !== null && selected === null && status === "ready"
      ? {
          id: current.selectedId,
          item: current.lastItem?.id === current.selectedId ? current.lastItem : null,
        }
      : null;

  const writeUrl = (patch: Partial<BoardUrlState>) => {
    setParams((existing) => boardParamsOf(existing, { ...boardUrlOf(existing), ...patch }), {
      replace: true,
    });
  };

  const choose = (itemId: string, opens: boolean) => {
    const kind = tabOf.get(itemId) ?? tab;
    setState((existing) => ({
      ...existing,
      settled: true,
      selectedId: itemId,
      kind,
      openId: opens ? itemId : existing.openId,
      focus: opens ? { target: "title" } : existing.focus,
    }));
    writeUrl({ kind, item: itemId });
  };

  const rescope = (nextTab: BoardTabId, nextProject: string | null, project: boolean) => {
    const next = cardsOf(ranked, tabOf, nextProject, nextTab);
    const itemId = next.some((card) => card.id === current.selectedId)
      ? current.selectedId
      : (next[0]?.id ?? null);
    setState((existing) => ({
      ...existing,
      settled: true,
      kind: nextTab,
      selectedId: itemId,
      openId: null,
    }));
    writeUrl(
      project
        ? { project: nextProject, kind: nextTab, item: itemId }
        : { kind: nextTab, item: itemId },
    );
  };

  const step = (delta: number) => {
    const target = position === null ? undefined : cards[position + delta];
    if (target === undefined) return;
    setState((existing) => ({
      ...existing,
      selectedId: target.id,
      openId: existing.openId === null ? null : target.id,
      focus: { target: "title" },
    }));
    writeUrl({ item: target.id });
  };

  const latest = useRef({ cards, tab, updatedAt, setDialogOpen: overview.setDialogOpen });
  useLayoutEffect(() => {
    latest.current = { cards, tab, updatedAt, setDialogOpen: overview.setDialogOpen };
  });

  const markActed = useCallback((itemId: string) => {
    const { cards: shown, tab: shownTab, updatedAt: readAt } = latest.current;
    const at = shown.findIndex((card) => card.id === itemId);
    if (at < 0) return;
    setState((existing) => ({
      ...existing,
      handoff: { itemId, index: at, tab: shownTab, readAt },
    }));
  }, []);

  const setDialogOpen = useCallback(
    (itemId: string, nodeId: string, open: boolean) => {
      latest.current.setDialogOpen(itemId, nodeId, open);
      if (!open) markActed(itemId);
    },
    [markActed],
  );

  const cardElements = useRef(new Map<string, HTMLElement>());
  const titleElement = useRef<HTMLElement | null>(null);
  const allClearElement = useRef<HTMLElement | null>(null);
  const titleWanted = useRef(false);

  const cardRef = useCallback(
    (itemId: string) => (element: HTMLElement | null) => {
      if (element === null) cardElements.current.delete(itemId);
      else cardElements.current.set(itemId, element);
    },
    [],
  );

  const titleRef = useCallback((element: HTMLElement | null) => {
    titleElement.current = element;
    if (element === null || !titleWanted.current) return;
    titleWanted.current = false;
    element.focus();
  }, []);

  const allClearRef = useCallback((element: HTMLElement | null) => {
    allClearElement.current = element;
  }, []);

  const { focus } = current;
  useEffect(() => {
    if (focus === null) return;
    if (focus.target === "title") {
      if (titleElement.current === null) titleWanted.current = true;
      else titleElement.current.focus();
      return;
    }
    if (focus.target === "all_clear") {
      allClearElement.current?.focus();
      return;
    }
    if (focus.target === "card") {
      cardElements.current.get(focus.itemId)?.focus();
      return;
    }
    const active = document.activeElement;
    if (active !== null && active !== document.body) return;
    if (focus.itemId !== null) cardElements.current.get(focus.itemId)?.focus();
  }, [focus]);

  return {
    tab,
    selectTab: (nextTab) => rescope(nextTab, projectId, false),
    projectId,
    selectProject: (nextProject) => rescope(tab, nextProject, true),
    cards,
    counts,
    selectedId: current.selectedId,
    selected,
    select: (itemId) => choose(itemId, false),
    openId: current.openId,
    open: (itemId) => choose(itemId, widthClass !== BOARD_WIDTH.Expanded),
    close: () => setState((existing) => ({ ...existing, openId: null })),
    gone,
    summary,
    startItem,
    step,
    position,
    total: cards.length,
    markActed,
    setDialogOpen,
    cardRef,
    titleRef,
    allClearRef,
  };
}
