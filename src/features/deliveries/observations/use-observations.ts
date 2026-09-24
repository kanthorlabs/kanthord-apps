import type { ObservationRecord } from "@/api/types";
import { listObservations } from "@/api/resources/deliveries";
import { useProjectId } from "@/features/projects/project-context";
import { useResource, type Resource } from "@/hooks/use-resource";

export interface ObservationsData {
  readonly resource: Resource<readonly ObservationRecord[]>;
}

export function useObservations(): ObservationsData {
  const projectId = useProjectId();
  const resource = useResource(() => listObservations(projectId), [projectId]);
  return { resource };
}
