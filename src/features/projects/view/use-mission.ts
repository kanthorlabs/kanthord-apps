import { readMission } from "@/api/resources/mission";
import type { Mission } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

export function useMission(projectId: string): Resource<Mission> {
  return useResource(() => readMission(projectId), [projectId]);
}
