import { useState } from "react";

import { listQueue } from "@/api/resources/scheduler";
import type { ApiError } from "@/api/errors";
import type { WorkQueueEntry } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { useResource } from "@/hooks/use-resource";

export interface QueueState {
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly reload: () => void;
  readonly filtered: readonly WorkQueueEntry[];
  readonly heldOutOnly: boolean;
  readonly setHeldOutOnly: (v: boolean) => void;
  readonly selectedEntry: WorkQueueEntry | null;
  readonly select: (id: string | null) => void;
}

export function useSchedulerQueue(): QueueState {
  const projectId = useProjectId();
  const { data, loading, error, reload } = useResource(() => listQueue(projectId), [projectId]);
  const [heldOutOnly, setHeldOutOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sorted = [...(data ?? [])].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const filtered = heldOutOnly ? sorted.filter((e) => e.heldOut) : sorted;

  const selectedEntry =
    selectedId !== null ? ((data ?? []).find((e) => e.id === selectedId) ?? null) : null;

  return {
    loading,
    error,
    reload,
    filtered,
    heldOutOnly,
    setHeldOutOnly,
    selectedEntry,
    select: setSelectedId,
  };
}
