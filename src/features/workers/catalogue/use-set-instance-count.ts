import { useCallback, useState } from "react";

import { setInstanceCount } from "@/api/resources/projects";
import type { Binding } from "@/api/types";

export interface PendingDecrease {
  readonly projectId: string;
  readonly bindingId: string;
  readonly newCount: number;
  readonly busyCount: number;
}

export interface SetInstanceCountState {
  readonly pending: PendingDecrease | null;
  readonly executing: boolean;
  readonly request: (
    projectId: string,
    bindingId: string,
    newCount: number,
    currentCount: number,
    busyCount: number,
    onSuccess: () => void,
  ) => void;
  readonly confirm: (onSuccess: () => void) => Promise<Binding | null>;
  readonly cancel: () => void;
}

export function useSetInstanceCount(): SetInstanceCountState {
  const [pending, setPending] = useState<PendingDecrease | null>(null);
  const [executing, setExecuting] = useState(false);

  const request = useCallback(
    (
      projectId: string,
      bindingId: string,
      newCount: number,
      currentCount: number,
      busyCount: number,
      onSuccess: () => void,
    ) => {
      if (newCount < currentCount) {
        setPending({ projectId, bindingId, newCount, busyCount });
      } else {
        setExecuting(true);
        void setInstanceCount(projectId, bindingId, newCount).then(
          () => {
            setExecuting(false);
            onSuccess();
          },
          () => {
            setExecuting(false);
          },
        );
      }
    },
    [],
  );

  const confirm = useCallback(
    async (onSuccess: () => void): Promise<Binding | null> => {
      if (pending === null) return null;
      setExecuting(true);
      try {
        const result = await setInstanceCount(
          pending.projectId,
          pending.bindingId,
          pending.newCount,
        );
        onSuccess();
        return result;
      } finally {
        setExecuting(false);
        setPending(null);
      }
    },
    [pending],
  );

  const cancel = useCallback(() => setPending(null), []);

  return { pending, executing, request, confirm, cancel };
}
