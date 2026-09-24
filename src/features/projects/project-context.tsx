import { createContext, use, useMemo, useState, type ReactNode } from "react";

import { listProjects } from "@/api/resources/projects";
import type { Project } from "@/api/types";
import { useResource } from "@/hooks/use-resource";

interface ProjectValue {
  readonly projects: readonly Project[];
  readonly project: Project | null;
  readonly select: (id: string) => void;
  readonly loading: boolean;
  readonly error: string | null;
}

const ProjectContext = createContext<ProjectValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { data, error, loading } = useResource(() => listProjects(), []);
  const [selected, setSelected] = useState<string | null>(null);

  const value = useMemo<ProjectValue>(() => {
    const projects = data ?? [];
    const project = projects.find((p) => p.id === selected) ?? projects[0] ?? null;
    return {
      projects,
      project,
      select: setSelected,
      loading,
      error: error === null ? null : error.message,
    };
  }, [data, selected, loading, error]);

  return <ProjectContext value={value}>{children}</ProjectContext>;
}

export function useProject(): ProjectValue {
  const value = use(ProjectContext);
  if (value === null) throw new Error("useProject requires a ProjectProvider");
  return value;
}

/** The screens read one project at a time. */
export function useProjectId(): string {
  const { project } = useProject();
  return project?.id ?? "";
}
