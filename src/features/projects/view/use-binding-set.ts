import { useCallback, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { readBindingSet, writeBindingSet } from "@/api/resources/projects";
import type { BindingSet, BindingSetEntry } from "@/api/types";
import { credentialMessage } from "@/features/credentials/credential-message";
import { asApiError, useResource, type Resource } from "@/hooks/use-resource";
import { nextBindings } from "@/lib/binding-change";
import { returnToOf } from "@/lib/return-to";

export const VERSION_CONFLICT = "project.binding_set.version_conflict";

export interface BindingSetState {
  readonly resource: Resource<BindingSet>;
  readonly saving: boolean;
  readonly conflict: boolean;
  readonly error: string | null;
  readonly write: (name: string, entry: BindingSetEntry | null, onWritten: () => void) => void;
  readonly clearFeedback: () => void;
}

export function useBindingSet(projectId: string, onSetWritten: () => void): BindingSetState {
  const resource = useResource(() => readBindingSet(projectId), [projectId]);
  const navigate = useNavigate();
  const returnTo = returnToOf(useLocation().state);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
          onSetWritten();
          onWritten();
          if (returnTo !== null) void navigate(returnTo);
        },
        (cause: unknown) => {
          setSaving(false);
          const failure = asApiError(cause);
          if (failure.status === 409 && failure.detail === VERSION_CONFLICT) {
            setConflict(true);
            reload();
            return;
          }
          setError(credentialMessage(failure));
        },
      );
    },
    [saving, data, projectId, reload, onSetWritten, clearFeedback, returnTo, navigate],
  );

  return { resource, saving, conflict, error, write, clearFeedback };
}
