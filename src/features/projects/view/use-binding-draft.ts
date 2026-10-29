import { useCallback, useState } from "react";

import type { BindingSetEntry, BindingSetKind } from "@/api/types";
import {
  type BindingDraft,
  type DraftErrors,
  draftOf,
  emptyDraft,
  entryOfDraft,
  missingForCheck,
  missingForSave,
} from "@/lib/binding-draft";
import { missingHint } from "@/lib/missing-fields";

export interface BindingTarget {
  readonly kind: BindingSetKind;
  readonly name: string | null;
  readonly entry: BindingSetEntry | null;
  readonly section?: "environment";
}

export interface BindingDraftState {
  readonly draft: BindingDraft;
  readonly errors: DraftErrors;
  readonly creating: boolean;
  readonly edit: (next: BindingDraft) => void;
  readonly validate: (
    liveInstances?: readonly string[] | null,
    extraErrors?: DraftErrors,
  ) => BindingSetEntry | null;
  readonly checkReady: boolean;
  readonly saveReady: boolean;
  readonly missingHint: string | null;
}

export function useBindingDraft(
  target: BindingTarget,
  takenNames: readonly string[],
): BindingDraftState {
  const creating = target.name === null || target.entry === null;
  const [draft, setDraft] = useState<BindingDraft>(() =>
    target.name === null || target.entry === null
      ? emptyDraft(target.kind)
      : draftOf(target.name, target.entry),
  );
  const [errors, setErrors] = useState<DraftErrors>({});

  const edit = useCallback((next: BindingDraft) => {
    setDraft(next);
    setErrors({});
  }, []);

  const validate = useCallback(
    (liveInstances: readonly string[] | null = null, extraErrors: DraftErrors = {}) => {
      const result = entryOfDraft(draft, creating ? takenNames : [], liveInstances);
      const found = { ...(result.ok ? {} : result.errors), ...extraErrors };
      setErrors(found);
      return result.ok && Object.keys(extraErrors).length === 0 ? result.entry : null;
    },
    [draft, creating, takenNames],
  );

  const missing = missingForSave(draft);
  const checkReady = draft.kind === "repository" && missingForCheck(draft).length === 0;
  const hint = missingHint(missing, draft.kind === "repository" ? "verify and save" : "save");

  return {
    draft,
    errors,
    creating,
    edit,
    validate,
    checkReady,
    saveReady: missing.length === 0,
    missingHint: hint,
  };
}
