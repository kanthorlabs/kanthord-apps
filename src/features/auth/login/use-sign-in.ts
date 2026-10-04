import { useCallback, useState } from "react";

import {
  INVALID_BASE_URL,
  normalizeBaseUrl,
  validateSignIn,
  type InstanceDraft,
  type InstanceErrors,
} from "@/features/auth/instances/instance-validation";
import type { InstancesState } from "@/features/auth/instances/use-instances";
import { useInstanceVerify, type VerifyState } from "@/features/auth/instances/use-instance-verify";
import { useSession } from "@/features/auth/session/session-context";
import { signInMessage } from "./sign-in-message";

const VERIFY_KEY = "form";

const BLANK: InstanceDraft = { name: "", baseUrl: "http://localhost:31415", token: "" };

const LOCALHOST: InstanceDraft = {
  name: "localhost",
  baseUrl: "http://localhost:31415",
  token: "",
};

export interface SignInFormState {
  readonly draft: InstanceDraft;
  readonly errors: InstanceErrors;
  readonly setField: (field: keyof InstanceDraft, value: string) => void;
  readonly canAct: boolean;
  readonly pending: boolean;
  readonly error: string | null;
  readonly verifyState: VerifyState | undefined;
  readonly verifying: boolean;
  readonly verify: () => void;
  readonly submit: () => Promise<void>;
}

export function useSignIn(store: Pick<InstancesState, "instances" | "put">): SignInFormState {
  const { signIn } = useSession();
  const { states, verify: runVerify, clear } = useInstanceVerify();
  const [draft, setDraft] = useState<InstanceDraft>(() =>
    store.instances.length === 0 ? LOCALHOST : BLANK,
  );
  const [errors, setErrors] = useState<InstanceErrors>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { instances, put } = store;

  const filled = draft.baseUrl.trim() !== "" && draft.token.trim() !== "";
  const canAct = filled && !pending;
  const verifyState = states[VERIFY_KEY];
  const verifying = verifyState?.status === "checking";

  const setField = useCallback(
    (field: keyof InstanceDraft, value: string) => {
      if (field === "baseUrl") clear(VERIFY_KEY);
      setDraft((current) => ({ ...current, [field]: value }));
      setErrors((current) => ({ ...current, [field]: undefined }));
      setError(null);
    },
    [clear],
  );

  const verify = useCallback(() => {
    if (!canAct || verifying) return;
    const baseUrl = normalizeBaseUrl(draft.baseUrl);
    if (baseUrl === null) {
      setErrors((current) => ({ ...current, baseUrl: INVALID_BASE_URL }));
      return;
    }
    void runVerify(VERIFY_KEY, baseUrl);
  }, [canAct, verifying, draft.baseUrl, runVerify]);

  const submit = useCallback(async () => {
    if (!canAct) return;
    const result = validateSignIn(draft, instances);
    if (result.fields === null) {
      setErrors(result.errors ?? {});
      return;
    }
    const instance = { id: result.id ?? crypto.randomUUID(), ...result.fields };
    setPending(true);
    setError(null);
    try {
      await signIn(instance, instance.token);
      put(instance);
    } catch (cause) {
      setError(signInMessage(cause));
      setPending(false);
    }
  }, [canAct, draft, instances, signIn, put]);

  return {
    draft,
    errors,
    setField,
    canAct,
    pending,
    error,
    verifyState,
    verifying,
    verify,
    submit,
  };
}
