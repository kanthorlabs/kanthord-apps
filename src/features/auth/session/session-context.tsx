import { createContext, use, useCallback, useMemo, useState, type ReactNode } from "react";

import { setConnection } from "@/api/client";
import { verifyHumanToken } from "@/api/resources/gateway";
import type { HumanIdentity } from "@/api/types";
import { isInstance, type Instance } from "@/features/auth/instances/instance-storage";

const STORAGE_KEY = "kanthord.session";

export interface Session {
  readonly instance: Instance;
  readonly token: string;
  readonly identity: HumanIdentity;
}

interface SessionValue {
  readonly session: Session | null;
  readonly signIn: (instance: Instance, token: string) => Promise<void>;
  readonly signOut: () => void;
}

const SessionContext = createContext<SessionValue | null>(null);

function isSession(value: unknown): value is Session {
  if (typeof value !== "object" || value === null) return false;
  const { instance, token, identity } = value as Record<string, unknown>;
  if (!isInstance(instance) || typeof token !== "string") return false;
  if (typeof identity !== "object" || identity === null) return false;
  const { kind, sub, name } = identity as Record<string, unknown>;
  return kind === "human" && typeof sub === "string" && typeof name === "string";
}

function restore(): Session | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isSession(parsed)) return null;
    setConnection({ baseUrl: parsed.instance.baseUrl, token: parsed.token });
    return parsed;
  } catch {
    return null;
  }
}

function persist(session: Session | null): void {
  try {
    if (session === null) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    return;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(restore);

  const signIn = useCallback(async (instance: Instance, token: string) => {
    const identity = await verifyHumanToken(instance.baseUrl, token);
    const next: Session = {
      instance: { id: instance.id, name: instance.name, baseUrl: instance.baseUrl },
      token,
      identity,
    };
    persist(next);
    setConnection({ baseUrl: instance.baseUrl, token });
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    persist(null);
    setConnection(null);
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
