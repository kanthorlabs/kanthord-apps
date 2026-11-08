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
  readonly running: boolean;
  readonly refresh: () => void;
  readWith(read: (previous: T | null) => Promise<T>): void;
}

interface State<T> {
  readonly key: string;
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly settled: boolean;
  readonly updatedAt: number | null;
  readonly now: number;
  readonly running: boolean;
}

interface Job<T> {
  readonly read: (previous: T | null) => Promise<T>;
  readonly keepsUpdatedAt: boolean;
}

interface Controls<T> {
  readonly refresh: () => void;
  readonly readWith: (read: (previous: T | null) => Promise<T>) => void;
  readonly resume: () => void;
}

function initial<T>(key: string): State<T> {
  return { key, data: null, error: null, settled: false, updatedAt: null, now: 0, running: false };
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
  const dataRef = useRef<T | null>(null);
  const controls = useRef<Controls<T> | null>(null);

  useEffect(() => {
    readRef.current = read;
    holdRef.current = hold;
    dataRef.current = state.data;
  });

  useEffect(() => {
    let live = true;
    let running = false;
    let queued: Job<T> | null = null;
    let settledAt = 0;

    const polled = (): Job<T> => ({ read: () => readRef.current(), keepsUpdatedAt: false });

    const begin = (job: Job<T>, queueWhenRunning: boolean) => {
      if (running) {
        if (queueWhenRunning && (queued === null || !job.keepsUpdatedAt)) queued = job;
        return;
      }
      running = true;
      setStored((current) => ({ ...scopedTo(current, key), running: true }));
      job
        .read(dataRef.current)
        .then(
          (value) => {
            if (live) {
              const now = Date.now();
              setStored((current) => ({
                ...scopedTo(current, key),
                data: value,
                error: null,
                settled: true,
                updatedAt: job.keepsUpdatedAt ? scopedTo(current, key).updatedAt : now,
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
          if (live) setStored((current) => ({ ...scopedTo(current, key), running: false }));
          if (queued === null || !live) return;
          const next = queued;
          queued = null;
          begin(next, false);
        });
    };

    const visible = () => document.visibilityState === "visible";
    const resume = () => {
      if (visible() && !holdRef.current) begin(polled(), false);
    };
    const onFocus = () => {
      if (Date.now() - settledAt >= FOCUS_MIN_AGE_MS) resume();
    };

    controls.current = {
      refresh: () => begin(polled(), true),
      readWith: (read) => begin({ read, keepsUpdatedAt: true }, true),
      resume,
    };
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
  const readWith = useCallback(
    (read: (previous: T | null) => Promise<T>) => controls.current?.readWith(read),
    [],
  );

  return {
    data: state.data,
    error: state.error,
    loading: !state.settled,
    updatedAt: state.updatedAt,
    now: state.now,
    running: state.running,
    refresh,
    readWith,
  };
}
