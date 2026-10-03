import { useCallback, useState } from "react";

import { isApiError } from "@/api/errors";
import { readLiveness } from "@/api/resources/gateway";
import type { ServiceMaps } from "@/api/types";

export type VerifyState =
  | { readonly status: "checking" }
  | { readonly status: "reachable" }
  | { readonly status: "unhealthy"; readonly failing: readonly string[] }
  | { readonly status: "unreachable"; readonly origin: string }
  | { readonly status: "failed"; readonly message: string };

export interface InstanceVerifyState {
  readonly states: Readonly<Record<string, VerifyState>>;
  readonly verify: (key: string, baseUrl: string) => Promise<void>;
  readonly clear: (key: string) => void;
}

function failingComponents(services: ServiceMaps): string[] {
  return Object.entries(services).flatMap(([service, components]) =>
    Object.entries(components)
      .filter(([, code]) => code !== 200)
      .map(([component]) => `${service}.${component}`),
  );
}

async function check(baseUrl: string): Promise<VerifyState> {
  try {
    const report = await readLiveness(baseUrl);
    if (report.healthy) return { status: "reachable" };
    return { status: "unhealthy", failing: failingComponents(report.services) };
  } catch (cause) {
    if (!isApiError(cause)) return { status: "failed", message: "The check failed." };
    if (cause.code === "unreachable") {
      return { status: "unreachable", origin: window.location.origin };
    }
    if (cause.code === "unavailable") return { status: "unhealthy", failing: [] };
    return { status: "failed", message: cause.message };
  }
}

export function useInstanceVerify(): InstanceVerifyState {
  const [states, setStates] = useState<Readonly<Record<string, VerifyState>>>({});

  const verify = useCallback(async (key: string, baseUrl: string) => {
    setStates((current) => ({ ...current, [key]: { status: "checking" } }));
    const next = await check(baseUrl);
    setStates((current) => ({ ...current, [key]: next }));
  }, []);

  const clear = useCallback((key: string) => {
    setStates((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  return { states, verify, clear };
}
