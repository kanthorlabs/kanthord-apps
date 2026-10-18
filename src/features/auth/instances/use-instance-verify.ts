import { useCallback, useState } from "react";
import { toast } from "sonner";

import { isApiError } from "@/api/errors";
import { readLiveness, verifyHumanToken } from "@/api/resources/gateway";
import type { ServiceMaps } from "@/api/types";
import { signInMessage } from "@/features/auth/login/sign-in-message";
import { jwtExpiryOf } from "@/lib/jwt-expiry";

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
    if (cause.code === "unauthorized") return { status: "failed", message: signInMessage(cause) };
    return { status: "failed", message: cause.message };
  }
}

export function useInstanceVerify(): InstanceVerifyState {
  const [states, setStates] = useState<Readonly<Record<string, VerifyState>>>({});

  const verify = useCallback(async (key: string, baseUrl: string, token?: string) => {
    setStates((current) => ({ ...current, [key]: { status: "checking" } }));
    const next = await check(baseUrl, token);
    if (next.status === "reachable") {
      toast.success(`${baseUrl} is reachable.`, { duration: REACHABLE_TOAST_MS });
      setStates((current) => without(current, key));
      return;
    }
    setStates((current) => ({ ...current, [key]: next }));
  }, []);

  const clear = useCallback((key: string) => {
    setStates((current) => without(current, key));
  }, []);

  return { states, verify, clear };
}
