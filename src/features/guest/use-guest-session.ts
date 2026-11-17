import { useCallback, useMemo, useState } from "react";

import type { Connection } from "@/api/client";
import type { WorkbenchInviteJoinAnswer } from "@/api/types";
import { defaultBaseUrl } from "@/features/auth/login/default-instance";

const STORAGE_KEY = "kanthord.guest";

export interface GuestSessionState {
  readonly guest: WorkbenchInviteJoinAnswer | null;
  readonly connection: Connection | null;
  readonly store: (answer: WorkbenchInviteJoinAnswer) => void;
}

function isJoinAnswer(value: unknown): value is WorkbenchInviteJoinAnswer {
  if (typeof value !== "object" || value === null) return false;
  const { guest_token, guest_id, name, session_id, expires_at } = value as Record<string, unknown>;
  return (
    typeof guest_token === "string" &&
    typeof guest_id === "string" &&
    typeof name === "string" &&
    typeof session_id === "string" &&
    typeof expires_at === "number"
  );
}

function restore(): WorkbenchInviteJoinAnswer | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isJoinAnswer(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function useGuestSession(): GuestSessionState {
  const [guest, setGuest] = useState<WorkbenchInviteJoinAnswer | null>(restore);

  const store = useCallback((answer: WorkbenchInviteJoinAnswer) => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(answer));
    setGuest(answer);
  }, []);

  const connection = useMemo<Connection | null>(
    () => (guest === null ? null : { baseUrl: defaultBaseUrl(), token: guest.guest_token }),
    [guest],
  );

  return { guest, connection, store };
}
