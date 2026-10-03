import { useCallback, useState } from "react";

import {
  loadInstanceStore,
  saveInstanceStore,
  type Instance,
  type InstanceStore,
} from "./instance-storage";
import { validateDraft, type InstanceDraft, type InstanceErrors } from "./instance-validation";

export interface InstancesState {
  readonly instances: readonly Instance[];
  readonly defaultId: string | null;
  readonly save: (draft: InstanceDraft, id: string | null) => InstanceErrors | null;
  readonly remove: (id: string) => void;
  readonly setDefault: (id: string) => void;
}

export function useInstances(): InstancesState {
  const [store, setStore] = useState<InstanceStore>(loadInstanceStore);

  const commit = useCallback((next: InstanceStore) => {
    saveInstanceStore(next);
    setStore(next);
  }, []);

  const save = useCallback(
    (draft: InstanceDraft, id: string | null): InstanceErrors | null => {
      const others = store.instances.filter((instance) => instance.id !== id);
      const { errors, baseUrl } = validateDraft(draft, others);
      if (errors !== null || baseUrl === null) return errors;
      const saved: Instance = { id: id ?? crypto.randomUUID(), name: draft.name.trim(), baseUrl };
      const instances =
        id === null
          ? [...store.instances, saved]
          : store.instances.map((instance) => (instance.id === id ? saved : instance));
      const defaultId = store.instances.length === 0 ? saved.id : store.defaultId;
      commit({ instances, defaultId });
      return null;
    },
    [store, commit],
  );

  const remove = useCallback(
    (id: string) => {
      commit({
        instances: store.instances.filter((instance) => instance.id !== id),
        defaultId: store.defaultId === id ? null : store.defaultId,
      });
    },
    [store, commit],
  );

  const setDefault = useCallback(
    (id: string) => {
      commit({ instances: store.instances, defaultId: id });
    },
    [store, commit],
  );

  return {
    instances: store.instances,
    defaultId: store.defaultId,
    save,
    remove,
    setDefault,
  };
}
