import { listMissionNodes, readMission } from "@/api/resources/mission";
import type { MissionNodeRecord } from "@/api/types";
import { useResource, type Resource } from "./use-resource";

async function readMissionNodes(projectId: string): Promise<readonly MissionNodeRecord[]> {
  const mission = await readMission(projectId);
  return listMissionNodes(mission.id);
}

export function useMissionNodes(projectId: string): Resource<readonly MissionNodeRecord[]> {
  return useResource(() => readMissionNodes(projectId), [projectId]);
}
