import { listWorkerPlacements } from "@/api/resources/workers";
import { useResource } from "@/hooks/use-resource";
import { type PlacementChoices, placementChoicesOf } from "@/lib/placement-status";

export function usePlacementChoices(active: boolean): PlacementChoices {
  const read = useResource(() => (active ? listWorkerPlacements() : Promise.resolve([])), [active]);
  return placementChoicesOf(
    read.loading ? "checking" : read.error !== null ? "failed" : (read.data ?? []),
  );
}
