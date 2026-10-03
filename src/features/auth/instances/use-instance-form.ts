import { useCallback, useState } from "react";

import type { Instance } from "./instance-storage";
import {
  INVALID_BASE_URL,
  normalizeBaseUrl,
  type InstanceDraft,
  type InstanceErrors,
} from "./instance-validation";
import type { InstancesState } from "./use-instances";
import type { InstanceVerifyState } from "./use-instance-verify";

export const DRAFT_VERIFY_KEY = "draft";

export type FormMode =
  | { readonly kind: "list" }
  | { readonly kind: "add" }
  | { readonly kind: "edit"; readonly id: string };

export interface InstanceFormState {
  readonly mode: FormMode;
  readonly draft: InstanceDraft;
  readonly errors: InstanceErrors;
  readonly startAdd: () => void;
  readonly startEdit: (instance: Instance) => void;
  readonly setName: (name: string) => void;
  readonly setBaseUrl: (baseUrl: string) => void;
  readonly verifyDraft: () => void;
  readonly submit: () => void;
  readonly close: () => void;
}

const BLANK: InstanceDraft = { name: "", baseUrl: "" };

export function useInstanceForm(
  save: InstancesState["save"],
  verify: InstanceVerifyState,
): InstanceFormState {
  const [mode, setMode] = useState<FormMode>({ kind: "list" });
  const [draft, setDraft] = useState<InstanceDraft>(BLANK);
  const [errors, setErrors] = useState<InstanceErrors>({});
  const { verify: runVerify, clear } = verify;

  const open = useCallback(
    (next: FormMode, initial: InstanceDraft) => {
      clear(DRAFT_VERIFY_KEY);
      setErrors({});
      setDraft(initial);
      setMode(next);
    },
    [clear],
  );

  const startAdd = useCallback(() => open({ kind: "add" }, BLANK), [open]);

  const startEdit = useCallback(
    (instance: Instance) =>
      open({ kind: "edit", id: instance.id }, { name: instance.name, baseUrl: instance.baseUrl }),
    [open],
  );

  const close = useCallback(() => open({ kind: "list" }, BLANK), [open]);

  const setName = useCallback((name: string) => {
    setDraft((current) => ({ ...current, name }));
    setErrors((current) => ({ ...current, name: undefined }));
  }, []);

  const setBaseUrl = useCallback(
    (baseUrl: string) => {
      clear(DRAFT_VERIFY_KEY);
      setDraft((current) => ({ ...current, baseUrl }));
      setErrors((current) => ({ ...current, baseUrl: undefined }));
    },
    [clear],
  );

  const verifyDraft = useCallback(() => {
    const baseUrl = normalizeBaseUrl(draft.baseUrl);
    if (baseUrl === null) {
      setErrors((current) => ({
        ...current,
        baseUrl: INVALID_BASE_URL,
      }));
      return;
    }
    void runVerify(DRAFT_VERIFY_KEY, baseUrl);
  }, [draft.baseUrl, runVerify]);

  const submit = useCallback(() => {
    const id = mode.kind === "edit" ? mode.id : null;
    const failed = save(draft, id);
    if (failed !== null) {
      setErrors(failed);
      return;
    }
    if (id !== null) clear(id);
    close();
  }, [mode, draft, save, clear, close]);

  return {
    mode,
    draft,
    errors,
    startAdd,
    startEdit,
    setName,
    setBaseUrl,
    verifyDraft,
    submit,
    close,
  };
}
