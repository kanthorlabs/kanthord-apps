import { useCallback, useState } from "react";

import type { BindingSetEntry, BindingSetKind } from "@/api/types";
import {
  draftOf,
  emptyDraft,
  entryOfDraft,
  missingForCheck,
  missingForSave,
  type BindingDraft,
  type DraftErrors,
} from "@/lib/binding-draft";
import { missingHint } from "@/lib/missing-fields";

export interface BindingTarget {
  readonly kind: BindingSetKind;
  readonly name: string | null;
  readonly entry: BindingSetEntry | null;
}

export interface BindingDraftState {
  readonly draft: BindingDraft;
  readonly errors: DraftErrors;
  readonly creating: boolean;
  readonly edit: (next: BindingDraft) => void;
  readonly validate: () => BindingSetEntry | null;
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

  const validate = useCallback(() => {
    const result = entryOfDraft(draft, creating ? takenNames : []);
    setErrors(result.ok ? {} : result.errors);
    return result.ok ? result.entry : null;
  }, [draft, creating, takenNames]);

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
