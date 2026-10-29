import { useEffect } from "react";

import type { Resource } from "@/hooks/use-resource";
import { withHostDefault } from "@/lib/binding-draft";
import type { BindingDraftState } from "./use-binding-draft";
import type { WorkerAgents } from "./use-worker-agents";

export interface PlacementDefault {
  readonly waiting: boolean;
  readonly reason: string | null;
}

export function usePlacementDefault(
  form: BindingDraftState,
  agents: Resource<WorkerAgents>,
): PlacementDefault {
  const { draft, creating, edit } = form;
  const loaded = agents.data;
  const pickedWorker = creating && draft.kind === "worker" && draft.worker !== "";

  useEffect(() => {
    if (!pickedWorker || draft.kind !== "worker" || loaded === null) return;
    const next = withHostDefault(draft, loaded.external);
    if (next !== draft) edit(next);
  }, [pickedWorker, draft, loaded, edit]);

  const waiting = pickedWorker && loaded === null;
  const reason = !waiting
    ? null
    : agents.error === null
      ? "Save waits for the agents of the worker."
      : "Retry the agent list to save.";
  return { waiting, reason };
}
