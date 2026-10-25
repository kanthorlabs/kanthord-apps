import type { TimelineQuery } from "@/api/types";

import { isTimeRange, rangeStartOf, type TimeRange } from "./trace-query";

const NODE_RANGE: TimeRange = "all";
const PROJECT_RANGE: TimeRange = "24h";

export type TimelineScope =
  | { readonly kind: "node"; readonly nodeId: string }
  | { readonly kind: "project"; readonly projectId: string };

export function timelineScopeOf(
  params: URLSearchParams,
  firstProjectId: string | null,
): TimelineScope | null {
  const nodeId = params.get("node_id");
  if (nodeId) return { kind: "node", nodeId };
  const projectId = params.get("project_id") || firstProjectId;
  return projectId ? { kind: "project", projectId } : null;
}

export function timelineRangeOf(params: URLSearchParams): TimeRange {
  const requested = params.get("range");
  if (isTimeRange(requested)) return requested;
  return params.get("node_id") === null ? PROJECT_RANGE : NODE_RANGE;
}

export function timelineQueryOf(
  scope: TimelineScope,
  range: TimeRange,
  now: number,
): TimelineQuery {
  const from = rangeStartOf(range, now);
  const base: TimelineQuery =
    scope.kind === "node" ? { node_id: scope.nodeId } : { project_id: scope.projectId };
  return from === null ? base : { ...base, from };
}
