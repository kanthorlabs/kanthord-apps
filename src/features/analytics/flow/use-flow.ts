import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import type { ApiError } from "@/api/errors";
import { listProjects } from "@/api/resources/projects";
import { readAnalyticsFlow } from "@/api/resources/tracking";
import type { FlowRead, Project } from "@/api/types";
import { usePolledResource } from "@/hooks/use-polled-resource";
import { useResource } from "@/hooks/use-resource";
import { awaitingOf, completenessOf, dataSignalOf } from "@/lib/flow-completeness";
import { contextLineOf } from "@/lib/flow-context";
import { flowDataTarget } from "@/lib/flow-drill";
import { countText, dayLabel, rateText, timeLabel } from "@/lib/flow-format";
import { type FlowFilters, flowFiltersOf, flowQueryOf } from "@/lib/flow-query";
import { evaluate, frameOf, isActive } from "@/lib/flow-status";
import { withParam } from "@/lib/trace-query";

import type { FilterOption } from "../../traces/list/components/filter-select";

export interface DataBadge {
  readonly text: string;
  readonly active: boolean;
  readonly href: string;
}

export interface FlowReadView {
  readonly read: FlowRead | null;
  readonly error: ApiError | null;
  readonly empty: boolean;
  readonly refresh: () => void;
}

export interface FlowView extends FlowReadView {
  readonly filters: FlowFilters;
  readonly projects: readonly Project[];
  readonly updatedAt: number | null;
  readonly now: number;
  readonly held: boolean;
  readonly setHeld: (held: boolean) => void;
  readonly workerOptions: readonly FilterOption[];
  readonly contextLine: string | null;
  readonly dataBadge: DataBadge | null;
  readonly rebuildNotice: string | null;
  readonly notRefreshedSince: string | null;
  readonly selectTab: (tab: string | null) => void;
  readonly selectProject: (projectId: string | null) => void;
  readonly selectWorker: (workerName: string | null) => void;
  readonly selectRange: (range: string | null) => void;
}

const POLL_MS = 60_000;
const NO_PROJECTS: readonly Project[] = [];

function workerOptionsOf(read: FlowRead | null, current: string | null): readonly FilterOption[] {
  const names = new Set<string>(current === null ? [] : [current]);
  const staged = (read?.stages ?? [])
    .flatMap((stage) => stage.dimensions)
    .filter((dimension) => dimension.by === "worker_name")
    .map((dimension) => dimension.key);
  const used = (read?.usage.by.worker_name ?? []).map((row) => row.key);
  for (const name of [...staged, ...used]) names.add(name);
  return [...names].sort().map((name) => ({ value: name, label: name }));
}

function dataBadgeOf(read: FlowRead, filters: FlowFilters): DataBadge {
  const frame = frameOf(read, filters.range);
  const awaiting = awaitingOf(read);
  const base = `Data ${rateText(completenessOf(read))}`;
  return {
    text: awaiting > 0 ? `${base} · ${countText(awaiting)} awaiting ingestion` : base,
    active: isActive(evaluate(dataSignalOf(read, frame), frame)),
    href: flowDataTarget(filters),
  };
}

function rebuildNoticeOf(read: FlowRead | null): string | null {
  if (read === null || read.rebuild === null) return null;
  return `Aggregates rebuild in progress. Numbers before ${dayLabel(read.rebuild.pending_until)} are incomplete.`;
}

export function useFlow(): FlowView {
  const [params, setParams] = useSearchParams();
  const [held, setHeld] = useState(false);
  const projects = useResource(() => listProjects(), []);
  const filters = useMemo(() => flowFiltersOf(params), [params]);
  const flow = usePolledResource(
    () => readAnalyticsFlow(flowQueryOf(filters, Date.now())),
    [filters.projectId, filters.workerName, filters.range],
    { intervalMs: POLL_MS, hold: held },
  );
  const read = flow.data;
  const projectList = projects.data ?? NO_PROJECTS;
  const workerOptions = useMemo(
    () => workerOptionsOf(read, filters.workerName),
    [read, filters.workerName],
  );

  const write = useCallback(
    (key: string, value: string | null) =>
      setParams((current) => withParam(current, key, value), {
        replace: true,
        preventScrollReset: true,
      }),
    [setParams],
  );
  const selectTab = useCallback((value: string | null) => write("tab", value), [write]);
  const selectProject = useCallback((value: string | null) => write("project_id", value), [write]);
  const selectWorker = useCallback((value: string | null) => write("worker_name", value), [write]);
  const selectRange = useCallback((value: string | null) => write("range", value), [write]);

  return {
    read,
    error: flow.error,
    empty: read !== null && read.completeness.executions === 0,
    refresh: flow.refresh,
    filters,
    projects: projectList,
    updatedAt: flow.updatedAt,
    now: flow.now,
    held,
    setHeld,
    workerOptions,
    contextLine: read === null ? null : contextLineOf(read, filters, projectList),
    dataBadge: read === null ? null : dataBadgeOf(read, filters),
    rebuildNotice: rebuildNoticeOf(read),
    notRefreshedSince:
      flow.error !== null && flow.updatedAt !== null ? timeLabel(flow.updatedAt) : null,
    selectTab,
    selectProject,
    selectWorker,
    selectRange,
  };
}
