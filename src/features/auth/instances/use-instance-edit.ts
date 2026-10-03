import { useCallback, useState } from "react";

import type { SavedInstance } from "./instance-storage";
import { validateEdit, type InstanceDraft, type InstanceErrors } from "./instance-validation";
import type { InstancesState } from "./use-instances";

export interface InstanceEditState {
  readonly editingId: string | null;
  readonly draft: InstanceDraft;
  readonly errors: InstanceErrors;
  readonly start: (instance: SavedInstance) => void;
  readonly setField: (field: keyof InstanceDraft, value: string) => void;
  readonly save: () => string | null;
  readonly cancel: () => void;
}

const BLANK: InstanceDraft = { name: "", baseUrl: "", token: "" };

export function useInstanceEdit(
  store: Pick<InstancesState, "instances" | "put">,
): InstanceEditState {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<InstanceDraft>(BLANK);
  const [errors, setErrors] = useState<InstanceErrors>({});
  const { instances, put } = store;

  const start = useCallback((instance: SavedInstance) => {
    setEditingId(instance.id);
    setDraft({ name: instance.name, baseUrl: instance.baseUrl, token: instance.token });
    setErrors({});
  }, []);

  const cancel = useCallback(() => {
    setEditingId(null);
    setDraft(BLANK);
    setErrors({});
  }, []);

  const setField = useCallback((field: keyof InstanceDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const save = useCallback((): string | null => {
    if (editingId === null) return null;
    const { errors: failed, fields } = validateEdit(draft, instances, editingId);
    if (fields === null) {
      setErrors(failed ?? {});
      return null;
    }
    put({ id: editingId, ...fields });
    cancel();
    return editingId;
  }, [editingId, draft, instances, put, cancel]);

  return { editingId, draft, errors, start, setField, save, cancel };
}
