import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiError } from "@/api/errors";
import type { Page } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export type CursorPagesStatus = "loading" | "ready" | "error";

export interface CursorPages<T> {
  readonly status: CursorPagesStatus;
  readonly items: readonly T[];
  readonly error: ApiError | null;
  readonly pending: boolean;
  readonly hasPrevious: boolean;
  readonly hasNext: boolean;
  readonly position: number;
  readonly next: () => void;
  readonly previous: () => void;
  readonly retry: () => void;
  readonly reload: () => void;
}

type Cursors = readonly (string | null)[];

type Move = "next" | "previous" | "reload";

interface Committed<T> {
  readonly cursors: Cursors;
  readonly page: Page<T>;
  readonly position: number;
}

interface Target {
  readonly move: Move;
  readonly cursors: Cursors;
}

interface State<T> {
  readonly scope: string;
  readonly committed: Committed<T> | null;
  readonly error: ApiError | null;
  readonly pending: boolean;
  readonly failed: Target | null;
}

const FIRST: Cursors = [null];

function initial<T>(scope: string): State<T> {
  return { scope, committed: null, error: null, pending: true, failed: null };
}

function commit<T>(state: State<T>, target: Target, page: Page<T>): State<T> {
  const position = state.committed?.position ?? 0;
  const moved = target.move === "reload" ? position : position + 1;
  return {
    scope: state.scope,
    committed: { cursors: target.cursors, page, position: moved },
    error: null,
    pending: false,
    failed: null,
  };
}

function fail<T>(state: State<T>, target: Target, error: ApiError): State<T> {
  return { ...state, error, pending: false, failed: target };
}

export function useCursorPages<T>(
  read: (cursor: string | null) => Promise<Page<T>>,
  deps: readonly unknown[],
): CursorPages<T> {
  const scope = JSON.stringify(deps);
  const [stored, setStored] = useState<State<T>>(() => initial(scope));
  const state = stored.scope === scope ? stored : initial<T>(scope);
  const readRef = useRef(read);
  const stateRef = useRef(state);
  const sequence = useRef(0);

  useEffect(() => {
    readRef.current = read;
    stateRef.current = state;
  });

  const start = useCallback((origin: string, target: Target) => {
    sequence.current += 1;
    const ticket = sequence.current;
    const cursor = target.cursors.at(-1) ?? null;
    readRef.current(cursor).then(
      (page) => {
        if (ticket !== sequence.current) return;
        setStored((current) => commit(scopedTo(current, origin), target, page));
      },
      (cause: unknown) => {
        if (ticket !== sequence.current) return;
        setStored((current) => fail(scopedTo(current, origin), target, asApiError(cause)));
      },
    );
  }, []);

  useEffect(() => {
    start(scope, { move: "reload", cursors: FIRST });
  }, [scope, start]);

  const transition = useCallback(
    (target: Target) => {
      const origin = stateRef.current.scope;
      stateRef.current = { ...stateRef.current, error: null, pending: true };
      setStored((current) => ({ ...scopedTo(current, origin), error: null, pending: true }));
      start(origin, target);
    },
    [start],
  );

  const next = useCallback(() => {
    const { committed, pending } = stateRef.current;
    if (pending || committed === null || committed.page.next_cursor === null) return;
    transition({ move: "next", cursors: [...committed.cursors, committed.page.next_cursor] });
  }, [transition]);

  const previous = useCallback(() => {
    const { committed, pending } = stateRef.current;
    if (pending || committed === null || committed.cursors.length <= 1) return;
    transition({ move: "previous", cursors: committed.cursors.slice(0, -1) });
  }, [transition]);

  const retry = useCallback(() => {
    const { failed, pending } = stateRef.current;
    if (pending || failed === null) return;
    transition(failed);
  }, [transition]);

  const reload = useCallback(() => {
    const { committed } = stateRef.current;
    transition({ move: "reload", cursors: committed?.cursors ?? FIRST });
  }, [transition]);

  const committed = state.committed;
  return {
    status: statusOf(state),
    items: committed?.page.items ?? [],
    error: state.error,
    pending: state.pending,
    hasPrevious: committed !== null && committed.cursors.length > 1,
    hasNext: committed !== null && committed.page.next_cursor !== null,
    position: committed?.position ?? 0,
    next,
    previous,
    retry,
    reload,
  };
}

function scopedTo<T>(state: State<T>, scope: string): State<T> {
  return state.scope === scope ? state : initial(scope);
}

function statusOf<T>(state: State<T>): CursorPagesStatus {
  if (state.committed !== null) return "ready";
  return state.error !== null && !state.pending ? "error" : "loading";
}
