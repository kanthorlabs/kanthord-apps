import { useCallback, useState } from "react";

import type { SavedInstance } from "@/features/auth/instances/instance-storage";
import {
  useInstanceEdit,
  type InstanceEditState,
} from "@/features/auth/instances/use-instance-edit";
import { useInstanceRemoval } from "@/features/auth/instances/use-instance-removal";
import { useInstanceVerify, type VerifyState } from "@/features/auth/instances/use-instance-verify";
import type { InstancesState } from "@/features/auth/instances/use-instances";
import { useSession } from "@/features/auth/session/session-context";
import { signInMessage } from "./sign-in-message";

export type SavedInstanceMode = "view" | "edit" | "delete";

export interface SavedInstanceRow {
  readonly instance: SavedInstance;
  readonly mode: SavedInstanceMode;
  readonly verifyState: VerifyState | undefined;
  readonly verifying: boolean;
  readonly signingIn: boolean;
  readonly signInError: string | null;
}

export interface SavedInstancesState {
  readonly rows: readonly SavedInstanceRow[];
  readonly edit: InstanceEditState;
  readonly busy: boolean;
  readonly signInWith: (instance: SavedInstance) => void;
  readonly verify: (instance: SavedInstance) => void;
  readonly startEdit: (instance: SavedInstance) => void;
  readonly saveEdit: () => void;
  readonly requestDelete: (id: string) => void;
  readonly confirmDelete: () => void;
  readonly cancelDelete: () => void;
}

function without(
  record: Readonly<Record<string, string>>,
  key: string,
): Readonly<Record<string, string>> {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

export function useSavedInstances(store: InstancesState): SavedInstancesState {
  const { signIn } = useSession();
  const verifier = useInstanceVerify();
  const edit = useInstanceEdit(store);
  const [signingInId, setSigningInId] = useState<string | null>(null);
  const [signInErrors, setSignInErrors] = useState<Readonly<Record<string, string>>>({});
  const { clear } = verifier;

  const forget = useCallback(
    (id: string) => {
      clear(id);
      setSignInErrors((current) => without(current, id));
    },
    [clear],
  );

  const removal = useInstanceRemoval(store.remove, forget);
  const { start, cancel: cancelEdit, save } = edit;
  const { request, cancel: cancelDelete, confirm: confirmDelete } = removal;

  const signInWith = useCallback(
    (instance: SavedInstance) => {
      if (signingInId !== null) return;
      setSigningInId(instance.id);
      setSignInErrors((current) => without(current, instance.id));
      signIn(instance, instance.token).catch((cause: unknown) => {
        setSignInErrors((current) => ({ ...current, [instance.id]: signInMessage(cause) }));
        setSigningInId(null);
      });
    },
    [signingInId, signIn],
  );

  const verify = useCallback(
    (instance: SavedInstance) => void verifier.verify(instance.id, instance.baseUrl),
    [verifier],
  );

  const startEdit = useCallback(
    (instance: SavedInstance) => {
      cancelDelete();
      start(instance);
    },
    [cancelDelete, start],
  );

  const saveEdit = useCallback(() => {
    const id = save();
    if (id !== null) forget(id);
  }, [save, forget]);

  const requestDelete = useCallback(
    (id: string) => {
      cancelEdit();
      request(id);
    },
    [cancelEdit, request],
  );

  const rows = store.instances.map((instance): SavedInstanceRow => ({
    instance,
    mode:
      instance.id === edit.editingId
        ? "edit"
        : instance.id === removal.pendingId
          ? "delete"
          : "view",
    verifyState: verifier.states[instance.id],
    verifying: verifier.states[instance.id]?.status === "checking",
    signingIn: instance.id === signingInId,
    signInError: signInErrors[instance.id] ?? null,
  }));

  return {
    rows,
    edit,
    busy: signingInId !== null,
    signInWith,
    verify,
    startEdit,
    saveEdit,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
}
