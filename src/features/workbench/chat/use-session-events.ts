import { useCallback, useEffect, useState } from "react";

import { readWorkbenchEvents } from "@/api/resources/workbench";
import type { ApiErrorCode } from "@/api/errors";
import type { WorkbenchRunSnapshot, WorkbenchSessionEntry } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export const EVENTS_BACKOFF_MS = 1000;

const FINAL_FAILURES: readonly ApiErrorCode[] = ["unauthorized", "forbidden", "not_found"];

export interface SessionEventsState {
  readonly entries: readonly WorkbenchSessionEntry[];
  readonly snapshot: WorkbenchRunSnapshot;
  readonly failure: string | null;
  readonly patchSnapshot: (patch: Partial<WorkbenchRunSnapshot>) => void;
}

function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function idleSnapshot(runActive: boolean): WorkbenchRunSnapshot {
  return {
    streamingMessage: null,
    pendingToolCalls: [],
    pendingApproval: null,
    runActive,
    errorMessage: null,
  };
}

export function useSessionEvents(
  sessionId: string,
  loadedEntries: readonly WorkbenchSessionEntry[],
  initialRunActive: boolean,
): SessionEventsState {
  const [initialEntries] = useState(loadedEntries);
  const [entries, setEntries] = useState(initialEntries);
  const [snapshot, setSnapshot] = useState(() => idleSnapshot(initialRunActive));
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function follow() {
      let after = initialEntries.at(-1)?.id ?? null;
      while (!signal.aborted) {
        try {
          const events = await readWorkbenchEvents(sessionId, after, signal);
          if (signal.aborted) return;
          setFailure(null);
          setSnapshot(events.snapshot);
          const last = events.entries.at(-1);
          if (last !== undefined) {
            after = last.id;
            setEntries((held) => {
              const known = new Set(held.map((entry) => entry.id));
              return [...held, ...events.entries.filter((entry) => !known.has(entry.id))];
            });
          }
        } catch (cause) {
          if (signal.aborted) return;
          const error = asApiError(cause);
          setFailure(error.message);
          if (FINAL_FAILURES.includes(error.code)) return;
          await pause(EVENTS_BACKOFF_MS, signal);
        }
      }
    }

    void follow();
    return () => controller.abort();
  }, [sessionId, initialEntries]);

  const patchSnapshot = useCallback(
    (patch: Partial<WorkbenchRunSnapshot>) => setSnapshot((current) => ({ ...current, ...patch })),
    [],
  );

  return { entries, snapshot, failure, patchSnapshot };
}
