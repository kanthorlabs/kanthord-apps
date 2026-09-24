import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";

import { setToken } from "@/api/client";
import { signIn as signInRequest, signOut as signOutRequest } from "@/api/resources/session";
import type { Session } from "@/api/types";

const STORAGE_KEY = "kanthord.session";

interface SessionValue {
  readonly session: Session | null;
  readonly signIn: (username: string, password: string) => Promise<void>;
  readonly signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

function restore(): Session | null {
  const raw = window.sessionStorage.getItem(STORAGE_KEY);
  if (raw === null) return null;
  try {
    const session = JSON.parse(raw) as Session;
    setToken(session.token);
    return session;
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(restore);

  const signIn = useCallback(async (username: string, password: string) => {
    const next = await signInRequest(username, password);
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    signOutRequest();
    window.sessionStorage.removeItem(STORAGE_KEY);
    setSession(null);
  }, []);

  const value = useMemo(() => ({ session, signIn, signOut }), [session, signIn, signOut]);

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = use(SessionContext);
  if (value === null) throw new Error("useSession requires a SessionProvider");
  return value;
}
