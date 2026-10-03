import { useCallback, useState } from "react";

export interface InstanceRemovalState {
  readonly pendingId: string | null;
  readonly request: (id: string) => void;
  readonly confirm: () => void;
  readonly cancel: () => void;
}

export function useInstanceRemoval(
  remove: (id: string) => void,
  onRemoved: (id: string) => void,
): InstanceRemovalState {
  const [pendingId, setPendingId] = useState<string | null>(null);

  const confirm = useCallback(() => {
    if (pendingId === null) return;
    remove(pendingId);
    onRemoved(pendingId);
    setPendingId(null);
  }, [pendingId, remove, onRemoved]);

  const cancel = useCallback(() => setPendingId(null), []);

  return { pendingId, request: setPendingId, confirm, cancel };
}
