import { startTransition, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { ApiError } from "@/api/errors";
import { listProjects } from "@/api/resources/projects";
import type { Project } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import {
  timelineQueryOf,
  timelineRangeOf,
  type TimelineScope,
  timelineScopeOf,
} from "@/lib/timeline-query";
import { type TimelineRow, timelineRows } from "@/lib/timeline-rows";
import { type TimeRange, withParam } from "@/lib/trace-query";

import { readNodeNames } from "../traces/list/read-node-names";
import { type TimelinePages, useTimelinePages } from "./use-timeline-pages";

export type TimelineScopeView =
  | {
      readonly kind: "node";
      readonly nodeId: string;
      readonly nodeName: string;
      readonly projectId: string | null;
    }
  | {
      readonly kind: "project";
      readonly projectId: string | null;
      readonly projects: readonly Project[];
    };

export interface TimelineList {
  readonly status: TimelinePages["status"];
  readonly error: ApiError | null;
  readonly pending: boolean;
  readonly hasNext: boolean;
  readonly retry: () => void;
  readonly loadMore: () => void;
}

export interface TimelineView {
  readonly scope: TimelineScopeView;
  readonly range: TimeRange;
  readonly selectRange: (range: string | null) => void;
  readonly selectProject: (projectId: string | null) => void;
  readonly rows: readonly TimelineRow[];
  readonly nodeNameOf: ((nodeId: string | null) => string | null) | null;
  readonly list: TimelineList;
}

function byName(a: Project, b: Project): number {
  return a.name.localeCompare(b.name);
}

export function useTimeline(): TimelineView {
  const [params, setParams] = useSearchParams();
  const [now, setNow] = useState(() => Date.now());
  const projects = useResource(() => listProjects(), []);
  const sorted = useMemo(() => [...(projects.data ?? [])].sort(byName), [projects.data]);
  const scope = useMemo(() => timelineScopeOf(params, sorted[0]?.id ?? null), [params, sorted]);
  const range = timelineRangeOf(params);
  const query = useMemo(
    () => (scope === null ? null : timelineQueryOf(scope, range, now)),
    [scope, range, now],
  );
  const pages = useTimelinePages(query);
  const rows = useMemo(() => timelineRows(pages.items), [pages.items]);

  const nodeIds = nodeIdsOf(scope, pages);
  const names = useResource(() => readNodeNames(nodeIds), [nodeIds.join(",")]);

  const write = useCallback(
    (key: string, value: string | null) => {
      startTransition(() => setNow(Date.now()));
      setParams((current) => withParam(current, key, value), { replace: true });
    },
    [setParams],
  );
  const selectRange = useCallback((value: string | null) => write("range", value), [write]);
  const selectProject = useCallback((value: string | null) => write("project_id", value), [write]);

  const unscoped = scope === null;
  const list: TimelineList = {
    status: unscoped ? unscopedStatus(projects.loading, projects.error) : pages.status,
    error: unscoped ? projects.error : pages.error,
    pending: unscoped ? projects.loading : pages.pending,
    hasNext: pages.hasNext,
    retry: unscoped ? projects.reload : pages.retry,
    loadMore: pages.loadMore,
  };

  return {
    scope: scopeViewOf(scope, sorted, pages, names.data),
    range,
    selectRange,
    selectProject,
    rows,
    nodeNameOf: scope?.kind === "node" ? null : (nodeId) => nodeNameFor(nodeId, names.data),
    list,
  };
}

function nodeNameFor(
  nodeId: string | null,
  names: ReadonlyMap<string, string> | null,
): string | null {
  if (nodeId === null) return null;
  return names?.get(nodeId) ?? nodeId;
}

function unscopedStatus(loading: boolean, error: ApiError | null): TimelinePages["status"] {
  if (error !== null) return "error";
  return loading ? "loading" : "ready";
}

function nodeIdsOf(scope: TimelineScope | null, pages: TimelinePages): readonly string[] {
  if (scope?.kind === "node") return [scope.nodeId];
  const ids = pages.items.flatMap((item) => (item.node_id === null ? [] : [item.node_id]));
  return [...new Set(ids)];
}

function scopeViewOf(
  scope: TimelineScope | null,
  projects: readonly Project[],
  pages: TimelinePages,
  names: ReadonlyMap<string, string> | null,
): TimelineScopeView {
  if (scope?.kind !== "node") {
    return { kind: "project", projectId: scope?.projectId ?? null, projects };
  }
  return {
    kind: "node",
    nodeId: scope.nodeId,
    nodeName: names?.get(scope.nodeId) ?? scope.nodeId,
    projectId: pages.items[0]?.project_id ?? null,
  };
}
