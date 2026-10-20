import { listWorkerPlacements } from "@/api/resources/workers";
import { useResource } from "@/hooks/use-resource";
import { placementChoicesOf, type PlacementChoices } from "@/lib/placement-status";

export function usePlacementChoices(active: boolean): PlacementChoices {
  const read = useResource(() => (active ? listWorkerPlacements() : Promise.resolve([])), [active]);
  return placementChoicesOf(read.loading ? null : (read.data ?? []));
}
