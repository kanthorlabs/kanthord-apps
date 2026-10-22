import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { listProjects } from "@/api/resources/projects";
import { listTracePage, readTraceFacets } from "@/api/resources/tracking";
import type { Project, TraceFacets, TraceSummary } from "@/api/types";
import { useCursorPages, type CursorPages } from "@/hooks/use-cursor-pages";
import { useResource, type Resource } from "@/hooks/use-resource";
import { TRACE_QUERY_KEYS, traceQueryOf, withParam } from "@/lib/trace-query";

import { readNodeNames } from "./read-node-names";

export const TRACE_PAGE_LIMIT = 50;

const SEARCH_DELAY_MS = 300;
const MS_PER_SECOND = 1000;

export type TraceQueryKey = (typeof TRACE_QUERY_KEYS)[number];

export type TraceSetter = (value: string | null) => void;

export interface TraceList {
  readonly pages: CursorPages<TraceSummary>;
  readonly projects: Resource<readonly Project[]>;
  readonly facets: Resource<TraceFacets>;
  readonly params: URLSearchParams;
  readonly projectId: string | null;
  readonly filtered: boolean;
  readonly setters: Readonly<Record<TraceQueryKey, TraceSetter>>;
  readonly search: string;
  readonly changeSearch: (text: string) => void;
  readonly durationSeconds: string;
  readonly changeDurationSeconds: (text: string) => void;
  readonly titleOf: (trace: TraceSummary) => string;
}

function millisecondsOf(seconds: string): string | null {
  if (seconds.trim() === "") return null;
  const value = Number(seconds);
  if (!Number.isFinite(value) || value < 0) return null;
  return String(Math.round(value * MS_PER_SECOND));
}

function secondsOf(milliseconds: string | null): string {
  if (milliseconds === null) return "";
  const value = Number(milliseconds);
  return Number.isFinite(value) ? String(value / MS_PER_SECOND) : "";
}

function nodeIdsOf(traces: readonly TraceSummary[]): readonly string[] {
  return traces.flatMap((trace) => (trace.node_id === null ? [] : [trace.node_id]));
}

export function useTraceList(): TraceList {
  const [params, setParams] = useSearchParams();
  const [now, setNow] = useState(() => Date.now());
  const [search, setSearch] = useState(() => params.get("q") ?? "");
  const [durationSeconds, setDurationSeconds] = useState(() =>
    secondsOf(params.get("min_duration_ms")),
  );
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const query = useMemo(() => traceQueryOf(params, now), [params, now]);
  const projectId = query.project_id ?? null;

  const pages = useCursorPages((cursor) => listTracePage(query, cursor, TRACE_PAGE_LIMIT), [query]);
  const projects = useResource(() => listProjects(), []);
  const facets = useResource(() => readTraceFacets(projectId), [projectId]);
  const nodeIds = nodeIdsOf(pages.items);
  const names = useResource(() => readNodeNames(nodeIds), [nodeIds.join(",")]);

  const write = useCallback(
    (key: TraceQueryKey, value: string | null) => {
      startTransition(() => setNow(Date.now()));
      setParams((current) => withParam(current, key, value), { replace: true });
    },
    [setParams],
  );
  const writeRef = useRef(write);
  useEffect(() => {
    writeRef.current = write;
  });
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const setters = useMemo(
    () =>
      Object.fromEntries(
        TRACE_QUERY_KEYS.map((key) => [key, (value: string | null) => write(key, value)]),
      ) as Record<TraceQueryKey, TraceSetter>,
    [write],
  );

  const changeSearch = useCallback((text: string) => {
    setSearch(text);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => writeRef.current("q", text), SEARCH_DELAY_MS);
  }, []);

  const changeDurationSeconds = useCallback((text: string) => {
    setDurationSeconds(text);
    writeRef.current("min_duration_ms", millisecondsOf(text));
  }, []);

  const titleOf = useCallback(
    (trace: TraceSummary) =>
      (trace.node_id === null ? undefined : names.data?.get(trace.node_id)) ??
      trace.execution_id ??
      trace.trace_id,
    [names.data],
  );

  const filtered = TRACE_QUERY_KEYS.some((key) => key !== "range" && params.has(key));

  return {
    pages,
    projects,
    facets,
    params,
    projectId,
    filtered,
    setters,
    search,
    changeSearch,
    durationSeconds,
    changeDurationSeconds,
    titleOf,
  };
}
