import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiError } from "@/api/errors";
import { listSessionEntryPage } from "@/api/resources/tracking";
import type { TraceSessionEntry } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export const ENTRY_PAGE_LIMIT = 100;
export const ENTRY_PAGES_MAX = 50;
const ENTRY_POLL_MS = 5000;

export interface SessionEntries {
  readonly entries: readonly TraceSessionEntry[];
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly retry: () => void;
}

interface Run {
  readonly items: readonly TraceSessionEntry[];
  readonly tailCursor: string | null;
  readonly error: ApiError | null;
}

interface State {
  readonly scope: string;
  readonly entries: readonly TraceSessionEntry[];
  readonly loaded: boolean;
  readonly error: ApiError | null;
}

function initial(scope: string): State {
  return { scope, entries: [], loaded: false, error: null };
}

function mergeEntries(
  current: readonly TraceSessionEntry[],
  incoming: readonly TraceSessionEntry[],
): readonly TraceSessionEntry[] {
  const bySequence = new Map(current.map((entry) => [entry.sequence, entry]));
  for (const entry of incoming) bySequence.set(entry.sequence, entry);
  return [...bySequence.values()].sort((a, b) => a.sequence - b.sequence);
}

async function readPages(traceId: string, sessionId: string, from: string | null): Promise<Run> {
  const items: TraceSessionEntry[] = [];
  let cursor = from;
  let tailCursor = from;
  for (let pages = 0; pages < ENTRY_PAGES_MAX; pages += 1) {
    let page;
    try {
      page = await listSessionEntryPage(traceId, sessionId, cursor, ENTRY_PAGE_LIMIT);
    } catch (cause) {
      return { items, tailCursor, error: asApiError(cause) };
    }
    items.push(...page.items);
    tailCursor = cursor;
    if (page.next_cursor === null) break;
    cursor = page.next_cursor;
  }
  return { items, tailCursor, error: null };
}

export function useSessionEntries(
  traceId: string,
  sessionId: string,
  live: boolean,
): SessionEntries {
  const scope = JSON.stringify([traceId, sessionId]);
  const [stored, setStored] = useState<State>(() => initial(scope));
  const state = stored.scope === scope ? stored : initial(scope);
  const readRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    const cycle = { active: true, busy: false, tailCursor: null as string | null };
    const read = async () => {
      if (cycle.busy) return;
      cycle.busy = true;
      const run = await readPages(traceId, sessionId, cycle.tailCursor);
      cycle.busy = false;
      if (!cycle.active) return;
      cycle.tailCursor = run.tailCursor;
      setStored((current) => ({
        scope,
        entries: mergeEntries(current.scope === scope ? current.entries : [], run.items),
        loaded: true,
        error: run.error,
      }));
    };
    readRef.current = read;
    void read();
    return () => {
      cycle.active = false;
    };
  }, [traceId, sessionId, scope]);

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => void readRef.current(), ENTRY_POLL_MS);
    return () => clearInterval(timer);
  }, [live, scope]);

  const retry = useCallback(() => void readRef.current(), []);

  return { entries: state.entries, loading: !state.loaded, error: state.error, retry };
}
