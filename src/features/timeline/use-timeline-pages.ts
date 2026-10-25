import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ApiError } from "@/api/errors";
import { listTimelinePage } from "@/api/resources/tracking";
import type { Page, TimelineItem, TimelineQuery } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { hasOpenRoot } from "@/lib/timeline-rows";

export const TIMELINE_PAGE_LIMIT = 200;

const POLL_INTERVAL_MS = 5_000;

type Load = "first" | "more" | "refresh";

type TimelinePagesStatus = "loading" | "ready" | "error";

interface LoadedPage {
  readonly cursor: string | null;
  readonly page: Page<TimelineItem>;
}

interface State {
  readonly key: string;
  readonly pages: readonly LoadedPage[];
  readonly error: ApiError | null;
  readonly pending: boolean;
  readonly failed: Load | null;
}

export interface TimelinePages {
  readonly status: TimelinePagesStatus;
  readonly items: readonly TimelineItem[];
  readonly error: ApiError | null;
  readonly pending: boolean;
  readonly hasNext: boolean;
  readonly loadMore: () => void;
  readonly retry: () => void;
}

function initial(key: string): State {
  return { key, pages: [], error: null, pending: true, failed: null };
}

function scopedTo(state: State, key: string): State {
  return state.key === key ? state : initial(key);
}

function readPage(query: TimelineQuery, cursor: string | null): Promise<LoadedPage> {
  return listTimelinePage(query, cursor, TIMELINE_PAGE_LIMIT).then((page) => ({ cursor, page }));
}

function readLoad(
  load: Load,
  query: TimelineQuery,
  pages: readonly LoadedPage[],
): Promise<readonly LoadedPage[]> {
  if (load === "first") return readPage(query, null).then((first) => [first]);
  if (load === "refresh") return Promise.all(pages.map(({ cursor }) => readPage(query, cursor)));
  const cursor = pages.at(-1)?.page.next_cursor ?? null;
  return readPage(query, cursor).then((next) => [...pages, next]);
}

export function useTimelinePages(query: TimelineQuery | null): TimelinePages {
  const key = JSON.stringify(query);
  const [stored, setStored] = useState<State>(() => initial(key));
  const state = scopedTo(stored, key);
  const queryRef = useRef(query);
  const stateRef = useRef(state);
  const ticket = useRef(0);
  const busy = useRef(false);
  const queued = useRef(false);

  useEffect(() => {
    queryRef.current = query;
    stateRef.current = state;
  });

  useEffect(
    () => () => {
      queued.current = false;
    },
    [],
  );

  const run = useCallback(function run(load: Load) {
    const current = queryRef.current;
    const { pages, key: origin } = stateRef.current;
    if (current === null) return;
    if (load === "first") queued.current = false;
    if (load === "more" && busy.current && pages.length > 0) {
      queued.current = true;
      setStored((latest) => ({ ...scopedTo(latest, origin), pending: true }));
      return;
    }
    if (load !== "first" && (busy.current || pages.length === 0)) return;
    ticket.current += 1;
    const mine = ticket.current;
    busy.current = true;
    if (load !== "refresh") {
      setStored((latest) => ({ ...scopedTo(latest, origin), error: null, pending: true }));
    }
    readLoad(load, current, pages).then(
      (next) => {
        if (mine !== ticket.current) return;
        busy.current = false;
        const settled: State = {
          key: origin,
          pages: next,
          error: null,
          pending: false,
          failed: null,
        };
        stateRef.current = settled;
        setStored(settled);
        runQueued();
      },
      (cause: unknown) => {
        if (mine !== ticket.current) return;
        busy.current = false;
        setStored((latest) => ({
          ...scopedTo(latest, origin),
          error: asApiError(cause),
          pending: false,
          failed: load,
        }));
        runQueued();
      },
    );

    function runQueued() {
      if (!queued.current) return;
      queued.current = false;
      if ((stateRef.current.pages.at(-1)?.page.next_cursor ?? null) === null) return;
      run("more");
    }
  }, []);

  const active = query !== null;

  useEffect(() => {
    if (active) run("first");
  }, [key, active, run]);

  const items = useMemo(() => state.pages.flatMap(({ page }) => page.items), [state.pages]);
  const polling = hasOpenRoot(items);

  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") run("refresh");
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [polling, key, run]);

  const loadMore = useCallback(() => run("more"), [run]);

  const retry = useCallback(() => {
    const { failed, pending } = stateRef.current;
    if (failed === null || pending) return;
    run(failed);
  }, [run]);

  const last = state.pages.at(-1);
  return {
    status: statusOf(state),
    items,
    error: state.error,
    pending: state.pending,
    hasNext: last !== undefined && last.page.next_cursor !== null,
    loadMore,
    retry,
  };
}

function statusOf(state: State): TimelinePagesStatus {
  if (state.pages.length > 0) return "ready";
  return state.error !== null && !state.pending ? "error" : "loading";
}
