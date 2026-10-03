import { useCallback, useState } from "react";

import { loadInstances, saveInstances, type SavedInstance } from "./instance-storage";

export interface InstancesState {
  readonly instances: readonly SavedInstance[];
  readonly put: (instance: SavedInstance) => void;
  readonly remove: (id: string) => void;
}

export function useInstances(): InstancesState {
  const [instances, setInstances] = useState<readonly SavedInstance[]>(loadInstances);

  const commit = useCallback((next: readonly SavedInstance[]) => {
    saveInstances(next);
    setInstances(next);
  }, []);

  const put = useCallback(
    (instance: SavedInstance) => {
      const exists = instances.some((current) => current.id === instance.id);
      commit(
        exists
          ? instances.map((current) => (current.id === instance.id ? instance : current))
          : [...instances, instance],
      );
    },
    [instances, commit],
  );

  const remove = useCallback(
    (id: string) => commit(instances.filter((instance) => instance.id !== id)),
    [instances, commit],
  );

  return { instances, put, remove };
}
