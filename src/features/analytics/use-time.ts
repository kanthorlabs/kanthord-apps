import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { readAnalyticsDuration } from "@/api/resources/tracking";
import type { AnalyticsDurationItem, AnalyticsMeasure, AnalyticsPage, Project } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { timeRowsOf, type TimeRow } from "@/lib/analytics-time-rows";
import {
  timeGroupOf,
  timeMeasureOf,
  timeQueryOf,
  type AnalyticsFilters,
  type AnalyticsSelectableBucket,
  type TimeGroupName,
} from "@/lib/analytics-query";
import { withParam } from "@/lib/trace-query";

import { readNodeNames } from "../traces/list/read-node-names";

interface TimeRead {
  readonly measure: AnalyticsMeasure;
  readonly group: TimeGroupName;
  readonly bucket: AnalyticsSelectableBucket;
  readonly page: AnalyticsPage<AnalyticsDurationItem>;
}

export interface TimeView {
  readonly measure: AnalyticsMeasure;
  readonly group: TimeGroupName;
  readonly selectMeasure: (measure: string | null) => void;
  readonly selectGroup: (group: string | null) => void;
  readonly status: "loading" | "ready" | "error";
  readonly error: string | null;
  readonly retry: () => void;
  readonly rows: readonly TimeRow[];
  readonly truncated: boolean;
}

const NO_NAMES: ReadonlyMap<string, string> = new Map();

async function readTime(
  filters: AnalyticsFilters,
  measure: AnalyticsMeasure,
  group: TimeGroupName,
  now: number,
): Promise<TimeRead> {
  const page = await readAnalyticsDuration(timeQueryOf(filters, measure, group, now));
  return { measure, group, bucket: filters.bucket, page };
}

function nodeIdsOf(read: TimeRead | null): readonly string[] {
  if (read?.group !== "node_id") return [];
  return read.page.items.flatMap((item) => (item.key === null ? [] : [item.key]));
}

function namesOf(
  read: TimeRead | null,
  projects: readonly Project[],
  nodeNames: ReadonlyMap<string, string> | null,
): ReadonlyMap<string, string> {
  if (read?.group === "project_id") {
    return new Map(projects.map((project) => [project.id, project.name]));
  }
  return read?.group === "node_id" ? (nodeNames ?? NO_NAMES) : NO_NAMES;
}

export function useTime(
  filters: AnalyticsFilters,
  refreshCount: number,
  projects: readonly Project[],
): TimeView {
  const [params, setParams] = useSearchParams();
  const measure = timeMeasureOf(params);
  const group = timeGroupOf(params);
  const time = useResource(
    () => readTime(filters, measure, group, Date.now()),
    [filters.projectId, filters.range, filters.bucket, measure, group, refreshCount],
  );
  const read = time.data;
  const nodeIds = nodeIdsOf(read);
  const nodeNames = useResource(() => readNodeNames(nodeIds), [nodeIds.join(",")]);
  const names = useMemo(
    () => namesOf(read, projects, nodeNames.data),
    [read, projects, nodeNames.data],
  );

  const rows = useMemo(
    () =>
      read === null
        ? []
        : timeRowsOf(read.page.items, read.measure, read.bucket, read.group, names),
    [read, names],
  );

  const write = useCallback(
    (key: string, value: string | null) =>
      setParams((current) => withParam(current, key, value), { replace: true }),
    [setParams],
  );
  const selectMeasure = useCallback(
    (value: string | null) => write("time_measure", value),
    [write],
  );
  const selectGroup = useCallback((value: string | null) => write("time_group_by", value), [write]);

  const failed = time.error !== null;
  return {
    measure,
    group,
    selectMeasure,
    selectGroup,
    status: failed ? "error" : read === null ? "loading" : "ready",
    error: time.error?.message ?? null,
    retry: time.reload,
    rows,
    truncated: read?.page.truncated ?? false,
  };
}
