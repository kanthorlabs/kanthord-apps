import { listMissionDependencies, listMissionNodes, readMission } from "@/api/resources/mission";
import type { Mission } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";
import { buildGraph, type GraphModel } from "@/lib/mission-graph";

export interface MissionGraphRead {
  readonly mission: Mission;
  readonly model: GraphModel;
  readonly changedDuringRead: boolean;
}

const READ_TRIES = 2;

async function readOnce(projectId: string): Promise<MissionGraphRead> {
  const before = await readMission(projectId);
  const [nodes, edges] = await Promise.all([
    listMissionNodes(before.id),
    listMissionDependencies(before.id),
  ]);
  const after = await readMission(projectId);
  const model = buildGraph(nodes, edges);
  const unresolved = model.diagnostics.some((item) => item.kind === "unresolved-dependency");
  return {
    mission: after,
    model,
    changedDuringRead: before.version !== after.version || unresolved,
  };
}

async function readGraph(projectId: string): Promise<MissionGraphRead> {
  let read = await readOnce(projectId);
  for (let tries = 1; tries < READ_TRIES && read.changedDuringRead; tries += 1) {
    read = await readOnce(projectId);
  }
  return read;
}

export function useMissionGraph(projectId: string): Resource<MissionGraphRead> {
  return useResource(() => readGraph(projectId), [projectId]);
}
