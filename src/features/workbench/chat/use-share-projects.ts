import { useCallback, useMemo } from "react";

import type { Project, WorkbenchProjectRef } from "@/api/types";
import { projectLabelOf } from "@/lib/share-invite";

type ListedProject = Pick<Project, "id" | "name">;

export interface ShareProjectsState {
  readonly projectIds: readonly string[];
  readonly lockedIds: readonly string[] | null;
  readonly labelOf: (id: string) => string;
}

const NO_PROJECTS: readonly ListedProject[] = [];

export function useShareProjects(
  listed: readonly ListedProject[] | null,
  locked: readonly WorkbenchProjectRef[] | null,
): ShareProjectsState {
  const projects = listed ?? NO_PROJECTS;
  const projectIds = useMemo(() => projects.map((project) => project.id), [projects]);
  const lockedIds = useMemo(() => locked?.map((project) => project.id) ?? null, [locked]);
  const labelOf = useCallback((id: string) => projectLabelOf(projects, id), [projects]);
  return { projectIds, lockedIds, labelOf };
}
