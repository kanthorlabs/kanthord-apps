import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export type ProjectTab = "mission" | "bindings";

export interface ProjectTabState {
  readonly tab: ProjectTab;
  readonly selectTab: (tab: ProjectTab) => void;
}

export function projectTabPath(projectId: string, tab: ProjectTab): string {
  const path = `/projects/${encodeURIComponent(projectId)}`;
  return tab === "mission" ? path : `${path}?tab=${tab}`;
}

export function useProjectTab(): ProjectTabState {
  const [params, setParams] = useSearchParams();
  const tab: ProjectTab = params.get("tab") === "bindings" ? "bindings" : "mission";

  const selectTab = useCallback(
    (next: ProjectTab) => {
      setParams(next === "mission" ? {} : { tab: next }, { replace: true });
    },
    [setParams],
  );

  return { tab, selectTab };
}
