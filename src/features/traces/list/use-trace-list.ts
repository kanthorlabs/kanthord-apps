import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { listProjects } from "@/api/resources/projects";
import { listTracePage, readTraceFacets } from "@/api/resources/tracking";
import type { Project, TraceFacets, TraceListItem } from "@/api/types";
import { useCursorPages, type CursorPages } from "@/hooks/use-cursor-pages";
import { useResource, type Resource } from "@/hooks/use-resource";
import { secondsOf, millisecondsOf, sheetChangesOf } from "@/lib/trace-filter-draft";
import { TRACE_QUERY_KEYS, traceQueryOf, withParam, type TraceQueryKey } from "@/lib/trace-query";
import { nodeNameOf, traceTitleOf } from "@/lib/trace-title";

import { useNodeNames } from "./use-node-names";

export const TRACE_PAGE_LIMIT = 50;

const SEARCH_DELAY_MS = 300;
const ALL_PILL = "all";

export type TraceSetter = (value: string | null) => void;

export interface TraceList {
  readonly pages: CursorPages<TraceListItem>;
  readonly projects: Resource<readonly Project[]>;
  readonly facets: Resource<TraceFacets>;
  readonly params: URLSearchParams;
  readonly projectId: string | null;
  readonly filtered: boolean;
  readonly setters: Readonly<Record<TraceQueryKey, TraceSetter>>;
  readonly now: number;
  readonly statePill: string;
  readonly choosePill: (pill: string) => void;
  readonly apply: (draft: URLSearchParams, draftDurationSeconds: string) => void;
  readonly search: string;
  readonly changeSearch: (text: string) => void;
  readonly durationSeconds: string;
  readonly changeDurationSeconds: (text: string) => void;
  readonly titleOf: (trace: TraceListItem) => string;
}

function nodeIdsOf(traces: readonly TraceListItem[]): readonly string[] {
  return traces.flatMap((trace) =>
    trace.node_id === null || nodeNameOf(trace.root_attributes) !== null ? [] : [trace.node_id],
  );
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
  const names = useNodeNames(nodeIdsOf(pages.items));

  const write = useCallback(
    (key: TraceQueryKey, value: string | null) => {
      startTransition(() => setNow(Date.now()));
      setParams((current) => withParam(current, key, value), { replace: true });
    },
    [setParams],
  );
  const choosePill = useCallback(
    (pill: string) => write("state", pill === ALL_PILL ? null : pill),
    [write],
  );
  const apply = useCallback(
    (draft: URLSearchParams, draftDurationSeconds: string) => {
      const changes = sheetChangesOf(draft, draftDurationSeconds);
      startTransition(() => setNow(Date.now()));
      setDurationSeconds(draftDurationSeconds);
      setParams(
        (current) =>
          Object.entries(changes).reduce(
            (next, [key, value]) => withParam(next, key, value),
            current,
          ),
        { replace: true },
      );
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
    (trace: TraceListItem) =>
      traceTitleOf(
        trace,
        nodeNameOf(trace.root_attributes) ??
          (trace.node_id === null ? undefined : names.get(trace.node_id)) ??
          null,
      ),
    [names],
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
    now,
    statePill: params.get("state") ?? ALL_PILL,
    choosePill,
    apply,
    search,
    changeSearch,
    durationSeconds,
    changeDurationSeconds,
    titleOf,
  };
}
