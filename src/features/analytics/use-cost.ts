import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { readAnalyticsCost } from "@/api/resources/tracking";
import type { AnalyticsCostItem, AnalyticsPage, Project } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { costFieldsOf, costRowsOf, type CostField, type CostRow } from "@/lib/analytics-cost-rows";
import {
  costGroupOf,
  costQueriesOf,
  type AnalyticsFilters,
  type AnalyticsSelectableBucket,
  type CostGroupName,
} from "@/lib/analytics-query";
import { withParam } from "@/lib/trace-query";

import { readNodeNames } from "../traces/list/read-node-names";
import { rangeRetryOf } from "./range-retry";

interface CostRead {
  readonly group: CostGroupName;
  readonly bucket: AnalyticsSelectableBucket;
  readonly grouped: AnalyticsPage<AnalyticsCostItem>;
  readonly totals: AnalyticsCostItem | null;
}

export interface CostView {
  readonly group: CostGroupName;
  readonly selectGroup: (group: string | null) => void;
  readonly status: "loading" | "ready" | "error";
  readonly error: string | null;
  readonly retry: (() => void) | undefined;
  readonly rows: readonly CostRow[];
  readonly totals: readonly CostField[] | null;
  readonly truncated: boolean;
}

const NO_NAMES: ReadonlyMap<string, string> = new Map();

async function readCost(
  filters: AnalyticsFilters,
  group: CostGroupName,
  now: number,
): Promise<CostRead> {
  const queries = costQueriesOf(filters, group, now);
  const [grouped, totals] = await Promise.all([
    readAnalyticsCost(queries.grouped),
    readAnalyticsCost(queries.totals),
  ]);
  return { group, bucket: filters.bucket, grouped, totals: totals.items[0] ?? null };
}

function nodeIdsOf(read: CostRead | null): readonly string[] {
  if (read?.group !== "node_id") return [];
  return read.grouped.items.flatMap((item) => (item.key === null ? [] : [item.key]));
}

function namesOf(
  read: CostRead | null,
  projects: readonly Project[],
  nodeNames: ReadonlyMap<string, string> | null,
): ReadonlyMap<string, string> {
  if (read?.group === "project_id") {
    return new Map(projects.map((project) => [project.id, project.name]));
  }
  return read?.group === "node_id" ? (nodeNames ?? NO_NAMES) : NO_NAMES;
}

export function useCost(
  filters: AnalyticsFilters,
  refreshCount: number,
  projects: readonly Project[],
): CostView {
  const [params, setParams] = useSearchParams();
  const group = costGroupOf(params);
  const cost = useResource(
    () => readCost(filters, group, Date.now()),
    [filters.projectId, filters.range, filters.bucket, group, refreshCount],
  );
  const read = cost.data;
  const nodeIds = nodeIdsOf(read);
  const nodeNames = useResource(() => readNodeNames(nodeIds), [nodeIds.join(",")]);
  const names = useMemo(
    () => namesOf(read, projects, nodeNames.data),
    [read, projects, nodeNames.data],
  );

  const rows = useMemo(
    () => (read === null ? [] : costRowsOf(read.grouped.items, read.bucket, read.group, names)),
    [read, names],
  );

  const selectGroup = useCallback(
    (value: string | null) =>
      setParams((current) => withParam(current, "group_by", value), { replace: true }),
    [setParams],
  );

  const failed = cost.error !== null;
  return {
    group,
    selectGroup,
    status: failed ? "error" : read === null ? "loading" : "ready",
    error: cost.error?.message ?? null,
    retry: rangeRetryOf(cost.error, cost.reload),
    rows,
    totals: read === null || read.totals === null ? null : costFieldsOf(read.totals),
    truncated: read?.grouped.truncated ?? false,
  };
}
