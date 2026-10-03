import { useCallback, useState } from "react";

import { isApiError } from "@/api/errors";
import type { Instance } from "@/features/auth/instances/instance-storage";
import type { InstancesState } from "@/features/auth/instances/use-instances";
import { useSession } from "@/features/auth/session/session-context";

export interface SignInState {
  readonly selected: Instance | null;
  readonly select: (id: string) => void;
  readonly token: string;
  readonly setToken: (token: string) => void;
  readonly instanceMissing: string | null;
  readonly tokenMissing: string | null;
  readonly canSubmit: boolean;
  readonly pending: boolean;
  readonly error: string | null;
  readonly submit: () => Promise<void>;
}

function messageOf(cause: unknown): string {
  if (!isApiError(cause)) return "The sign in failed.";
  if (cause.code === "unauthorized") {
    return "The instance refused the token. Use a human token from kanthord jwt generate.";
  }
  if (cause.code === "unreachable") return "The instance did not answer.";
  return cause.message;
}

export function useSignIn(store: Pick<InstancesState, "instances" | "defaultId">): SignInState {
  const { signIn } = useSession();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [token, setTokenValue] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected =
    store.instances.find((instance) => instance.id === selectedId) ??
    store.instances.find((instance) => instance.id === store.defaultId) ??
    null;
  const trimmed = token.trim();
  const instanceMissing = selected === null ? "Select an instance to sign in to." : null;
  const tokenMissing = trimmed === "" ? "Paste a token to sign in." : null;
  const canSubmit = selected !== null && trimmed !== "" && !pending;

  const setToken = useCallback((next: string) => {
    setTokenValue(next);
    setError(null);
  }, []);

  const select = useCallback((id: string) => {
    setSelectedId(id);
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    if (selected === null || trimmed === "" || pending) return;
    setPending(true);
    setError(null);
    try {
      await signIn(selected, trimmed);
    } catch (cause) {
      setError(messageOf(cause));
    } finally {
      setPending(false);
    }
  }, [selected, trimmed, pending, signIn]);

  return {
    selected,
    select,
    token,
    setToken,
    instanceMissing,
    tokenMissing,
    canSubmit,
    pending,
    error,
    submit,
  };
}
