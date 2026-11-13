import { ApiError } from "@/api/errors";
import { readMission } from "@/api/resources/mission";
import { listProjects } from "@/api/resources/projects";
import { type Resource, useResource } from "@/hooks/use-resource";

async function projectOfMission(missionId: string | null): Promise<string | null> {
  if (missionId === null) return null;
  const projects = await listProjects();
  const reads = await Promise.allSettled(projects.map((project) => readMission(project.id)));
  const holder = reads
    .flatMap((read) => (read.status === "fulfilled" ? [read.value] : []))
    .find((mission) => mission.id === missionId);
  if (holder === undefined) {
    throw new ApiError("not_found", `No project holds the mission ${missionId}.`, 404);
  }
  return holder.project_id;
}

export function useNodeProject(missionId: string | null): Resource<string | null> {
  return useResource(() => projectOfMission(missionId), [missionId]);
}
