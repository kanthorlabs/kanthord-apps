import { readProject } from "@/api/resources/projects";
import type { Project } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

export function useProjectDetail(projectId: string): Resource<Project> {
  return useResource(() => readProject(projectId), [projectId]);
}
