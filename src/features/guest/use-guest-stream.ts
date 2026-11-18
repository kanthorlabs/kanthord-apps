import { useEffect, useState } from "react";

import { type Connection, openStream } from "@/api/client";
import type { ApiError, ApiErrorCode } from "@/api/errors";
import { readGuestSession } from "@/api/resources/workbench";
import type {
  WorkbenchGuestEntry,
  WorkbenchGuestSession,
  WorkbenchGuestState,
  WorkbenchMember,
} from "@/api/types";
import { EVENTS_BACKOFF_MS, pause } from "@/features/workbench/chat/use-session-events";
import { asApiError } from "@/hooks/use-resource";
import type { GuestLine } from "@/lib/guest-chat";
import { forgetGuestSession } from "./use-guest-session";

const STREAM_PATH = "/api/workbench/guest/session/stream";
const JITTER_MS = 1000;
const INVITE_ENDED = "gateway.jwt.invite_ended";
const FINAL_FAILURES: readonly ApiErrorCode[] = ["unauthorized", "forbidden", "not_found"];

export interface GuestStreamFailure extends GuestLine {
  readonly final: boolean;
}

export interface GuestStreamState {
  readonly session: WorkbenchGuestSession | null;
  readonly members: readonly WorkbenchMember[];
  readonly entries: readonly WorkbenchGuestEntry[];
  readonly state: WorkbenchGuestState | null;
  readonly failure: GuestStreamFailure | null;
}

function entryKey(entry: WorkbenchGuestEntry): string {
  return `${entry.session_id}:${entry.id}`;
}

function cursorOf(lastEntryIds: ReadonlyMap<string, string>): string | null {
  if (lastEntryIds.size === 0) return null;
  return [...lastEntryIds].map(([sessionId, entryId]) => `${sessionId}:${entryId}`).join(",");
}

function streamPathOf(after: string | null): string {
  return after === null ? STREAM_PATH : `${STREAM_PATH}?${new URLSearchParams({ after })}`;
}

function failureOf(error: ApiError): GuestStreamFailure {
  const code = error.status === 0 || error.detail === "" ? error.code : error.detail;
  return { code, message: error.message, final: FINAL_FAILURES.includes(error.code) };
}

export function useGuestStream(connection: Connection): GuestStreamState {
  const [session, setSession] = useState<WorkbenchGuestSession | null>(null);
  const [members, setMembers] = useState<readonly WorkbenchMember[]>([]);
  const [entries, setEntries] = useState<readonly WorkbenchGuestEntry[]>([]);
  const [state, setState] = useState<WorkbenchGuestState | null>(null);
  const [failure, setFailure] = useState<GuestStreamFailure | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    const lastEntryIds = new Map<string, string>();
    const knownSessionIds = new Set<string>();

    function remember(incoming: readonly WorkbenchGuestEntry[]) {
      for (const entry of incoming) {
        lastEntryIds.set(entry.session_id, entry.id);
        knownSessionIds.add(entry.session_id);
      }
    }

    async function load() {
      const loaded = await readGuestSession(connection);
      if (signal.aborted) return;
      for (const member of loaded.members) knownSessionIds.add(member.session_id);
      remember(loaded.entries);
      setSession(loaded);
      setMembers(loaded.members);
      setEntries(loaded.entries);
    }

    async function take(incoming: readonly WorkbenchGuestEntry[]) {
      if (incoming.some((entry) => !knownSessionIds.has(entry.session_id))) {
        const fresh = await readGuestSession(connection);
        if (signal.aborted) return;
        for (const member of fresh.members) knownSessionIds.add(member.session_id);
        setMembers(fresh.members);
      }
      remember(incoming);
      setEntries((held) => {
        const known = new Set(held.map(entryKey));
        return [...held, ...incoming.filter((entry) => !known.has(entryKey(entry)))];
      });
    }

    async function consume() {
      const frames = openStream(streamPathOf(cursorOf(lastEntryIds)), { signal, connection });
      for await (const frame of frames) {
        if (signal.aborted) return;
        setFailure(null);
        if (frame.event === "entries") {
          await take(JSON.parse(frame.data) as readonly WorkbenchGuestEntry[]);
        }
        if (frame.event === "state") setState(JSON.parse(frame.data) as WorkbenchGuestState);
      }
    }

    async function follow() {
      let loaded = false;
      while (!signal.aborted) {
        try {
          if (!loaded) {
            await load();
            loaded = true;
          }
          await consume();
        } catch (cause) {
          if (signal.aborted) return;
          const error = asApiError(cause);
          if (error.status === 401 && error.detail === INVITE_ENDED) forgetGuestSession();
          setFailure(failureOf(error));
          if (FINAL_FAILURES.includes(error.code)) return;
        }
        await pause(EVENTS_BACKOFF_MS + Math.random() * JITTER_MS, signal);
      }
    }

    void follow();
    return () => controller.abort();
  }, [connection]);

  return { session, members, entries, state, failure };
}
