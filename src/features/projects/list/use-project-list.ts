import { listProjectPage } from "@/api/resources/projects";
import type { Project } from "@/api/types";
import { useCursorPages, type CursorPages } from "@/hooks/use-cursor-pages";

export function useProjectList(): CursorPages<Project> {
  return useCursorPages((cursor) => listProjectPage(cursor), []);
}
