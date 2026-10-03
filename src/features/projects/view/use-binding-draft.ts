import { useCallback, useState } from "react";

import type { BindingSetEntry, BindingSetKind } from "@/api/types";
import {
  draftOf,
  emptyDraft,
  entryOfDraft,
  type BindingDraft,
  type DraftErrors,
} from "@/lib/binding-draft";

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

  return { draft, errors, creating, edit, validate };
}
