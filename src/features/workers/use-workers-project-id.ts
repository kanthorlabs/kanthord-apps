import { useProject } from "@/features/projects/project-context";
import { useScopedProject } from "@/hooks/use-scoped-project";

export function useWorkersProjectId(): string {
  const { projectId: requested } = useScopedProject();
  const { projects, project } = useProject();
  if (requested !== null && projects.some((candidate) => candidate.id === requested)) {
    return requested;
  }
  return project?.id ?? "";
}
