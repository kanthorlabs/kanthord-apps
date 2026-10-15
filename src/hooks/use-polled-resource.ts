import { useCallback, useEffect, useRef, useState } from "react";

import type { ApiError } from "@/api/errors";
import { asApiError } from "@/hooks/use-resource";

const FOCUS_MIN_AGE_MS = 5_000;

export interface PolledOptions {
  readonly intervalMs: number;
  readonly hold?: boolean;
}

export interface PolledResource<T> {
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly loading: boolean;
  readonly updatedAt: number | null;
  readonly now: number;
  readonly refresh: () => void;
}

interface State<T> {
  readonly key: string;
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly settled: boolean;
  readonly updatedAt: number | null;
  readonly now: number;
}

interface Controls {
  readonly refresh: () => void;
  readonly resume: () => void;
}

function initial<T>(key: string): State<T> {
  return { key, data: null, error: null, settled: false, updatedAt: null, now: 0 };
}

function scopedTo<T>(state: State<T>, key: string): State<T> {
  return state.key === key ? state : initial(key);
}

export function usePolledResource<T>(
  read: () => Promise<T>,
  deps: readonly unknown[],
  { intervalMs, hold = false }: PolledOptions,
): PolledResource<T> {
  const key = JSON.stringify(deps);
  const [stored, setStored] = useState<State<T>>(() => initial<T>(key));
  const state = stored.key === key ? stored : initial<T>(key);
  const readRef = useRef(read);
  const holdRef = useRef(hold);
  const heldBefore = useRef(hold);
  const controls = useRef<Controls | null>(null);

  useEffect(() => {
    readRef.current = read;
    holdRef.current = hold;
  });

  useEffect(() => {
    let live = true;
    let running = false;
    let queued = false;
    let settledAt = 0;

    const begin = (queueWhenRunning: boolean) => {
      if (running) {
        if (queueWhenRunning) queued = true;
        return;
      }
      running = true;
      readRef
        .current()
        .then(
          (value) => {
            if (live) {
              const now = Date.now();
              setStored((current) => ({
                ...scopedTo(current, key),
                data: value,
                error: null,
                settled: true,
                updatedAt: now,
                now,
              }));
            }
          },
          (cause: unknown) => {
            if (live) {
              const now = Date.now();
              setStored((current) => ({
                ...scopedTo(current, key),
                error: asApiError(cause),
                settled: true,
                now,
              }));
            }
          },
        )
        .finally(() => {
          running = false;
          settledAt = Date.now();
          if (!queued || !live) return;
          queued = false;
          begin(false);
        });
    };

    const visible = () => document.visibilityState === "visible";
    const resume = () => {
      if (visible() && !holdRef.current) begin(false);
    };
    const onFocus = () => {
      if (Date.now() - settledAt >= FOCUS_MIN_AGE_MS) resume();
    };

    controls.current = { refresh: () => begin(true), resume };
    const timer = setInterval(resume, intervalMs);
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("focus", onFocus);
    resume();

    return () => {
      live = false;
      controls.current = null;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("focus", onFocus);
    };
  }, [key, intervalMs]);

  useEffect(() => {
    if (heldBefore.current && !hold) controls.current?.resume();
    heldBefore.current = hold;
  }, [hold]);

  const refresh = useCallback(() => controls.current?.refresh(), []);

  return {
    data: state.data,
    error: state.error,
    loading: !state.settled,
    updatedAt: state.updatedAt,
    now: state.now,
    refresh,
  };
}
