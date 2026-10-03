import { readMissionNode } from "@/api/resources/mission";
import type { MissionNodeRecord } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export function useNodeRecord(nodeId: string): Resource<MissionNodeRecord> {
  return useResource(() => readMissionNode(nodeId), [nodeId]);
}
