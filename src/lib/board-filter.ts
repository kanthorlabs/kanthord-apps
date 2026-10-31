import type { Project } from "@/api/types";

import type { BoardTab } from "./board-tabs";
import { counted } from "./counted";

const ALL_PROJECTS = "All projects";

export function projectNameOf(
  projects: readonly Project[],
  projectId: string | null,
): string | null {
  return projects.find((project) => project.id === projectId)?.name ?? null;
}

export function filterNameOf(projects: readonly Project[], projectId: string | null): string {
  return projectNameOf(projects, projectId) ?? ALL_PROJECTS;
}

export function pickedProjectIdOf(
  projects: readonly Project[],
  value: string | undefined,
): string | null {
  return projects.find((project) => project.id === value)?.id ?? null;
}

export function filterMessageOf(
  name: string,
  tab: BoardTab,
  tabCount: number,
  viewCount: number,
): string {
  return `${name}: ${counted(tabCount, "act", "acts")} in ${tab.name}, ${counted(viewCount, "act", "acts")} in all tabs.`;
}
