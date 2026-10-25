import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { listProjects } from "@/api/resources/projects";
import type { Project } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { analyticsFiltersOf, type AnalyticsFilters } from "@/lib/analytics-query";
import { withParam } from "@/lib/trace-query";

export interface AnalyticsView {
  readonly filters: AnalyticsFilters;
  readonly projects: readonly Project[];
  readonly refreshCount: number;
  readonly selectProject: (projectId: string | null) => void;
  readonly selectRange: (range: string | null) => void;
  readonly selectBucket: (bucket: string | null) => void;
  readonly refresh: () => void;
}

const NO_PROJECTS: readonly Project[] = [];

export function useAnalytics(): AnalyticsView {
  const [params, setParams] = useSearchParams();
  const [refreshCount, setRefreshCount] = useState(0);
  const projects = useResource(() => listProjects(), []);
  const filters = useMemo(() => analyticsFiltersOf(params), [params]);

  const write = useCallback(
    (key: string, value: string | null) =>
      setParams((current) => withParam(current, key, value), { replace: true }),
    [setParams],
  );
  const selectProject = useCallback((value: string | null) => write("project_id", value), [write]);
  const selectRange = useCallback((value: string | null) => write("range", value), [write]);
  const selectBucket = useCallback((value: string | null) => write("bucket", value), [write]);
  const refresh = useCallback(() => setRefreshCount((count) => count + 1), []);

  return {
    filters,
    projects: projects.data ?? NO_PROJECTS,
    refreshCount,
    selectProject,
    selectRange,
    selectBucket,
    refresh,
  };
}
