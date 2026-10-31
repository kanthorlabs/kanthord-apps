import { useCallback, useEffect, useRef } from "react";
import { type NavigateFunction, useLocation, useNavigate } from "react-router-dom";

import { boardParamsOf, boardUrlOf, type BoardUrlState } from "@/lib/board-url";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

export interface BoardHistoryInput {
  readonly widthClass: BoardWidth;
  readonly deepLink: string | null;
  readonly dialogOpen: boolean;
  readonly closeDialogs: () => void;
  readonly focusTitle: () => void;
}

export interface BoardHistory {
  readonly overviewItem: string | null;
  readonly push: (patch: Partial<BoardUrlState>, itemId: string) => void;
  readonly replace: (patch: Partial<BoardUrlState>) => void;
  readonly close: (then?: () => void) => void;
}

interface Latest extends BoardHistoryInput {
  readonly navigate: NavigateFunction;
  readonly search: string;
  readonly overviewItem: string | null;
}

interface Entry {
  readonly search: string;
  readonly itemId: string;
}

const BACK = -1;

function overviewItemOf(state: unknown): string | null {
  if (typeof state !== "object" || state === null || !("overviewItem" in state)) return null;
  return typeof state.overviewItem === "string" ? state.overviewItem : null;
}

function searchWith(search: string, patch: Partial<BoardUrlState>): string {
  const params = new URLSearchParams(search);
  return boardParamsOf(params, { ...boardUrlOf(params), ...patch }).toString();
}

export function useOverviewItem(): string | null {
  return overviewItemOf(useLocation().state);
}

export function useBoardHistory(input: BoardHistoryInput): BoardHistory {
  const location = useLocation();
  const navigate = useNavigate();
  const overviewItem = useOverviewItem();
  const expanded = input.widthClass === BOARD_WIDTH.Expanded;

  const latest = useRef<Latest>({ ...input, navigate, search: location.search, overviewItem });
  useEffect(() => {
    latest.current = { ...input, navigate, search: location.search, overviewItem };
  });

  const previousItem = useRef(overviewItem);
  const previousExpanded = useRef(expanded);
  const remembered = useRef<Entry | null>(
    overviewItem === null ? null : { search: location.search, itemId: overviewItem },
  );
  const pending = useRef<(() => void) | null>(null);
  const popping = useRef(false);
  const unwinding = useRef<string | null>(null);
  const entered = useRef<string | null>(null);

  const push = useCallback((patch: Partial<BoardUrlState>, itemId: string) => {
    const { navigate: go, search } = latest.current;
    go({ search: searchWith(search, patch) }, { state: { overviewItem: itemId } });
  }, []);

  const replace = useCallback((patch: Partial<BoardUrlState>) => {
    const { navigate: go, search, overviewItem: top } = latest.current;
    const keeps = top !== null && typeof patch.item === "string";
    go(
      { search: searchWith(search, patch) },
      { replace: true, state: keeps ? { overviewItem: patch.item } : null },
    );
  }, []);

  const close = useCallback((then?: () => void) => {
    const { navigate: go, overviewItem: top } = latest.current;
    if (top === null) {
      then?.();
      return;
    }
    if (then !== undefined) pending.current = then;
    if (popping.current) return;
    popping.current = true;
    go(BACK);
  }, []);

  const { deepLink } = input;
  useEffect(() => {
    if (deepLink === null) {
      entered.current = null;
      return;
    }
    if (entered.current === deepLink) return;
    entered.current = deepLink;
    const { navigate: go, search } = latest.current;
    go({ search: searchWith(search, { item: null }) }, { replace: true });
    go({ search }, { state: { overviewItem: deepLink } });
  }, [deepLink]);

  useEffect(() => {
    const wasExpanded = previousExpanded.current;
    previousExpanded.current = expanded;
    const { navigate: go, overviewItem: top } = latest.current;
    if (!expanded || wasExpanded || top === null) return;
    unwinding.current = top;
    go(BACK);
  }, [expanded]);

  useEffect(() => {
    const before = previousItem.current;
    const now = latest.current.overviewItem;
    previousItem.current = now;
    popping.current = false;
    const {
      navigate: go,
      search,
      dialogOpen,
      closeDialogs,
      focusTitle,
      widthClass,
    } = latest.current;
    if (unwinding.current !== null) {
      if (now !== null) {
        go(BACK);
        return;
      }
      const showing = unwinding.current;
      unwinding.current = null;
      go({ search: searchWith(search, { item: showing }) }, { replace: true });
      if (!dialogOpen) focusTitle();
      return;
    }
    if (before === now || widthClass === BOARD_WIDTH.Expanded) return;
    if (now !== null) {
      remembered.current = { search, itemId: now };
      pending.current = null;
      return;
    }
    if (dialogOpen && remembered.current !== null) {
      closeDialogs();
      go(
        { search: remembered.current.search },
        { state: { overviewItem: remembered.current.itemId } },
      );
      return;
    }
    const then = pending.current;
    pending.current = null;
    then?.();
  }, [location]);

  return { overviewItem, push, replace, close };
}
