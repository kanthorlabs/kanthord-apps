import { useCallback, useEffect, useState } from "react";

import { readWorkbenchEvents } from "@/api/resources/workbench";
import type { ApiErrorCode } from "@/api/errors";
import type { WorkbenchMember, WorkbenchRunSnapshot, WorkbenchSessionEntry } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export const EVENTS_BACKOFF_MS = 1000;

const FINAL_FAILURES: readonly ApiErrorCode[] = ["unauthorized", "forbidden", "not_found"];

export type SnapshotPatch =
  | Partial<WorkbenchRunSnapshot>
  | ((current: WorkbenchRunSnapshot) => Partial<WorkbenchRunSnapshot>);

export interface SessionEventsState {
  readonly members: readonly WorkbenchMember[];
  readonly entries: readonly WorkbenchSessionEntry[];
  readonly snapshot: WorkbenchRunSnapshot;
  readonly snapshotLoaded: boolean;
  readonly failure: string | null;
  readonly patchSnapshot: (patch: SnapshotPatch) => void;
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
    streaming_message: null,
    pending_tool_calls: [],
    pending_approval: null,
    queue: [],
    run_active: runActive,
    error_message: null,
    auto_mode: true,
    phase: null,
  };
}

function cursorOf(
  members: readonly WorkbenchMember[],
  lastEntryIds: ReadonlyMap<string, string>,
): string | null {
  const [host] = members;
  const memberIds = members.map((member) => member.session_id);
  const phaseIds = [...lastEntryIds.keys()].filter((sessionId) => !memberIds.includes(sessionId));
  if (members.length === 1 && host !== undefined && phaseIds.length === 0) {
    return lastEntryIds.get(host.session_id) ?? null;
  }
  const pairs = [...memberIds, ...phaseIds].flatMap((sessionId) => {
    const entryId = lastEntryIds.get(sessionId);
    return entryId === undefined ? [] : [{ sessionId, entryId }];
  });
  if (pairs.length === 0) return null;
  return pairs.map((pair) => `${pair.sessionId}:${pair.entryId}`).join(",");
}

function entryKey(entry: WorkbenchSessionEntry): string {
  return `${entry.session_id}:${entry.id}`;
}

export function useSessionEvents(
  sessionId: string,
  loadedEntries: readonly WorkbenchSessionEntry[],
  loadedMembers: readonly WorkbenchMember[],
  initialRunActive: boolean,
): SessionEventsState {
  const [initialEntries] = useState(loadedEntries);
  const [initialMembers] = useState(loadedMembers);
  const [entries, setEntries] = useState(initialEntries);
  const [members, setMembers] = useState(initialMembers);
  const [snapshot, setSnapshot] = useState(() => idleSnapshot(initialRunActive));
  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    async function follow() {
      const lastEntryIds = new Map(initialEntries.map((entry) => [entry.session_id, entry.id]));
      let currentMembers = initialMembers;
      let version: number | null = null;
      while (!signal.aborted) {
        try {
          const after = cursorOf(currentMembers, lastEntryIds);
          const events = await readWorkbenchEvents(sessionId, after, version, signal);
          if (signal.aborted) return;
          setFailure(null);
          setSnapshot(events.snapshot);
          setSnapshotLoaded(true);
          version = events.version;
          currentMembers = events.members;
          setMembers(events.members);
          if (events.entries.length > 0) {
            for (const entry of events.entries) lastEntryIds.set(entry.session_id, entry.id);
            setEntries((held) => {
              const known = new Set(held.map(entryKey));
              return [...held, ...events.entries.filter((entry) => !known.has(entryKey(entry)))];
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
  }, [sessionId, initialEntries, initialMembers]);

  const patchSnapshot = useCallback(
    (patch: SnapshotPatch) =>
      setSnapshot((current) => ({
        ...current,
        ...(typeof patch === "function" ? patch(current) : patch),
      })),
    [],
  );

  return { members, entries, snapshot, snapshotLoaded, failure, patchSnapshot };
}
