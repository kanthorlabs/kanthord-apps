import { useCallback, useState } from "react";

import type { ApiError } from "@/api/errors";
import { readBindingSet, writeBindingSet } from "@/api/resources/projects";
import type { BindingSet, BindingSetEntry } from "@/api/types";
import { asApiError, useResource, type Resource } from "@/hooks/use-resource";
import { nextBindings } from "@/lib/binding-change";

export interface BindingSetState {
  readonly resource: Resource<BindingSet>;
  readonly saving: boolean;
  readonly conflict: boolean;
  readonly error: ApiError | null;
  readonly write: (name: string, entry: BindingSetEntry | null, onWritten: () => void) => void;
  readonly clearFeedback: () => void;
}

export function useBindingSet(projectId: string): BindingSetState {
  const resource = useResource(() => readBindingSet(projectId), [projectId]);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { data, reload } = resource;

  const clearFeedback = useCallback(() => {
    setConflict(false);
    setError(null);
  }, []);

  const write = useCallback(
    (name: string, entry: BindingSetEntry | null, onWritten: () => void) => {
      if (saving || data === null) return;
      setSaving(true);
      clearFeedback();
      writeBindingSet(projectId, data.version, nextBindings(data.bindings, name, entry)).then(
        () => {
          setSaving(false);
          reload();
          onWritten();
        },
        (cause: unknown) => {
          setSaving(false);
          const failure = asApiError(cause);
          if (failure.status === 409) {
            setConflict(true);
            reload();
            return;
          }
          setError(failure);
        },
      );
    },
    [saving, data, projectId, reload, clearFeedback],
  );

  return { resource, saving, conflict, error, write, clearFeedback };
}
