import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { listBindings, verifyBinding } from "@/api/resources/projects";
import type { HealthEntry } from "@/api/types";
import { asApiError, useResource } from "@/hooks/use-resource";
import { healthLabel, healthVariant, type HealthBadgeVariant } from "@/lib/credential-health";

export interface BindingCheckBadge {
  readonly label: string;
  readonly variant: HealthBadgeVariant;
  readonly busy: boolean;
}

export interface BindingVerifyState {
  readonly addressBadge: BindingCheckBadge | null;
  readonly credentialBadge: BindingCheckBadge | null;
  readonly checking: boolean;
}

type PerBindingState =
  | { readonly status: "idle" }
  | { readonly status: "checking" }
  | { readonly status: "ready"; readonly address: HealthEntry; readonly credential: HealthEntry };

const CHECKING_BADGE: BindingCheckBadge = { label: "Checking", variant: "outline", busy: true };
const IDLE: BindingVerifyState = { addressBadge: null, credentialBadge: null, checking: false };

function toCheckBadge(entry: HealthEntry): BindingCheckBadge {
  return { label: healthLabel(entry), variant: healthVariant(entry), busy: false };
}

function toVerifyState(inner: PerBindingState): BindingVerifyState {
  if (inner.status === "idle") return IDLE;
  if (inner.status === "checking") {
    return { addressBadge: CHECKING_BADGE, credentialBadge: CHECKING_BADGE, checking: true };
  }
  return {
    addressBadge: toCheckBadge(inner.address),
    credentialBadge: toCheckBadge(inner.credential),
    checking: false,
  };
}

export interface BindingVerify {
  readonly bindingIdOf: (name: string) => string | null;
  readonly getState: (bindingId: string | null) => BindingVerifyState;
  readonly verify: (bindingId: string) => void;
}

export function useBindingVerify(
  projectId: string,
  bindingSetVersion: number | null,
): BindingVerify {
  const [states, setStates] = useState<ReadonlyMap<string, PerBindingState>>(new Map());
  const active = useRef<Set<string>>(new Set());
  const records = useResource(() => listBindings(projectId), [projectId, bindingSetVersion]);
  const bindingIds = useMemo(
    () => new Map((records.data ?? []).map((record) => [record.name, record.id])),
    [records.data],
  );

  const bindingIdOf = useCallback((name: string) => bindingIds.get(name) ?? null, [bindingIds]);

  const getState = useCallback(
    (bindingId: string | null): BindingVerifyState => {
      if (bindingId === null) return IDLE;
      const inner = states.get(bindingId);
      return inner === undefined ? IDLE : toVerifyState(inner);
    },
    [states],
  );

  const verify = useCallback(
    function run(bindingId: string) {
      if (active.current.has(bindingId)) return;
      active.current.add(bindingId);
      setStates((prev) => new Map(prev).set(bindingId, { status: "checking" }));
      verifyBinding(projectId, bindingId).then(
        ({ address, credential }) => {
          active.current.delete(bindingId);
          setStates((prev) =>
            new Map(prev).set(bindingId, { status: "ready", address, credential }),
          );
        },
        (cause: unknown) => {
          active.current.delete(bindingId);
          const error = asApiError(cause);
          setStates((prev) => new Map(prev).set(bindingId, { status: "idle" }));
          toast.error("Verifying binding failed.", {
            description: error.message,
            action: { label: "Retry", onClick: () => run(bindingId) },
          });
        },
      );
    },
    [projectId],
  );

  return { bindingIdOf, getState, verify };
}
