import { useCallback, useState } from "react";

import type { InstancesState } from "./use-instances";

export interface RemovalPrompt {
  readonly title: string;
  readonly consequences: readonly string[];
}

export interface InstanceRemovalState {
  readonly prompt: RemovalPrompt | null;
  readonly request: (id: string) => void;
  readonly confirm: () => void;
  readonly cancel: () => void;
}

export function useInstanceRemoval(
  store: Pick<InstancesState, "instances" | "defaultId" | "remove">,
  onRemoved: (id: string) => void,
): InstanceRemovalState {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const pending = store.instances.find((instance) => instance.id === pendingId) ?? null;

  const prompt: RemovalPrompt | null =
    pending === null
      ? null
      : {
          title: `Remove ${pending.name}?`,
          consequences: [
            "This browser forgets its URL. The instance itself is not changed.",
            ...(pending.id === store.defaultId
              ? ["No instance is the default after you remove it."]
              : []),
          ],
        };

  const { remove } = store;

  const confirm = useCallback(() => {
    if (pendingId === null) return;
    remove(pendingId);
    onRemoved(pendingId);
    setPendingId(null);
  }, [pendingId, remove, onRemoved]);

  const cancel = useCallback(() => setPendingId(null), []);

  return { prompt, request: setPendingId, confirm, cancel };
}
