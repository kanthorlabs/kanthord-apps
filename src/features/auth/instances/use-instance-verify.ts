import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { isApiError, type ApiError } from "@/api/errors";
import { readLiveness, verifyHumanToken } from "@/api/resources/gateway";
import type { ServiceMaps } from "@/api/types";
import { utcDateTime } from "@/lib/format";
import { jwtExpiryOf } from "@/lib/jwt-expiry";
import { signInMessage } from "./sign-in-message";

export type VerifyState =
  | { readonly status: "checking" }
  | { readonly status: "reachable" }
  | {
      readonly status: "verified";
      readonly sub: string;
      readonly expiresAt: number | null;
    }
  | { readonly status: "unhealthy"; readonly failing: readonly string[] }
  | { readonly status: "unreachable"; readonly origin: string }
  | { readonly status: "failed"; readonly message: string };

export interface InstanceVerifyState {
  readonly states: Readonly<Record<string, VerifyState>>;
  readonly verify: (key: string, baseUrl: string, token?: string) => Promise<void>;
  readonly clear: (key: string) => void;
}

const REACHABLE_TOAST_MS = 3000;

function without(
  states: Readonly<Record<string, VerifyState>>,
  key: string,
): Readonly<Record<string, VerifyState>> {
  if (!(key in states)) return states;
  const next = { ...states };
  delete next[key];
  return next;
}

function failingComponents(services: ServiceMaps): string[] {
  return Object.entries(services).flatMap(([service, components]) =>
    Object.entries(components)
      .filter(([, code]) => code !== 200)
      .map(([component]) => `${service}.${component}`),
  );
}

function refusalMessage(cause: ApiError, token: string | undefined): string {
  const expiresAt = token === undefined ? null : jwtExpiryOf(token);
  if (expiresAt !== null && expiresAt < Date.now()) {
    return `The token expired at ${utcDateTime(expiresAt)}. Generate a new one with kanthord auth jwt generate.`;
  }
  return signInMessage(cause);
}

async function check(baseUrl: string, token: string | undefined): Promise<VerifyState> {
  try {
    if (token !== undefined) {
      const identity = await verifyHumanToken(baseUrl, token);
      return { status: "verified", sub: identity.sub, expiresAt: jwtExpiryOf(token) };
    }
    const report = await readLiveness(baseUrl);
    if (report.healthy) return { status: "reachable" };
    return { status: "unhealthy", failing: failingComponents(report.services) };
  } catch (cause) {
    if (!isApiError(cause)) return { status: "failed", message: "The check failed." };
    if (cause.code === "unreachable") {
      return { status: "unreachable", origin: window.location.origin };
    }
    if (cause.code === "unavailable") return { status: "unhealthy", failing: [] };
    if (cause.code === "unauthorized") {
      return { status: "failed", message: refusalMessage(cause, token) };
    }
    return { status: "failed", message: cause.message };
  }
}

export function useInstanceVerify(): InstanceVerifyState {
  const [states, setStates] = useState<Readonly<Record<string, VerifyState>>>({});
  const generations = useRef(new Map<string, number>());

  const supersede = useCallback((key: string): number => {
    const next = (generations.current.get(key) ?? 0) + 1;
    generations.current.set(key, next);
    return next;
  }, []);

  const verify = useCallback(
    async (key: string, baseUrl: string, token?: string) => {
      const generation = supersede(key);
      setStates((current) => ({ ...current, [key]: { status: "checking" } }));
      const next = await check(baseUrl, token);
      if (generations.current.get(key) !== generation) return;
      if (next.status === "reachable") {
        toast.success(`${baseUrl} is reachable.`, { duration: REACHABLE_TOAST_MS });
        setStates((current) => without(current, key));
        return;
      }
      setStates((current) => ({ ...current, [key]: next }));
    },
    [supersede],
  );

  const clear = useCallback(
    (key: string) => {
      supersede(key);
      setStates((current) => without(current, key));
    },
    [supersede],
  );

  return { states, verify, clear };
}
