import { useRef, useState } from "react";

import { readMissionNode } from "@/api/resources/mission";
import { listProjects } from "@/api/resources/projects";
import { listTraceSpans, readTrace } from "@/api/resources/tracking";
import type { ApiError } from "@/api/errors";
import type { TraceSpan, TraceSummary } from "@/api/types";
import { usePolledResource } from "@/hooks/use-polled-resource";
import { useResource } from "@/hooks/use-resource";
import { traceTitleOf } from "@/lib/trace-title";

export const TRACE_POLL_MS = 5000;

const NO_SPANS: readonly TraceSpan[] = [];

export interface TraceView {
  readonly summary: TraceSummary | null;
  readonly spans: readonly TraceSpan[];
  readonly error: ApiError | null;
  readonly expired: boolean;
  readonly retry: () => void;
  readonly live: boolean;
  readonly paused: boolean;
  readonly togglePaused: () => void;
  readonly nodeName: string | null;
  readonly projectName: string | null;
  readonly title: string | null;
}

interface SpanCache {
  readonly traceId: string;
  readonly signature: string;
  readonly spans: readonly TraceSpan[];
}

function signatureOf(summary: TraceSummary): string {
  return JSON.stringify([
    summary.span_count,
    summary.error_count,
    summary.total_tokens,
    summary.ended_at,
  ]);
}

async function readTraceData(traceId: string, cache: { current: SpanCache | null }) {
  const summary = await readTrace(traceId);
  const signature = signatureOf(summary);
  const cached = cache.current;
  if (cached !== null && cached.traceId === traceId && cached.signature === signature) {
    return { summary, spans: cached.spans };
  }
  const spans = await listTraceSpans(traceId);
  cache.current = { traceId, signature, spans };
  return { summary, spans };
}

async function readNodeName(nodeId: string | null): Promise<string | null> {
  if (nodeId === null) return null;
  try {
    return (await readMissionNode(nodeId)).content.name;
  } catch {
    return null;
  }
}

async function readProjectName(projectId: string | null): Promise<string | null> {
  if (projectId === null) return null;
  try {
    const projects = await listProjects();
    return projects.find((project) => project.id === projectId)?.name ?? null;
  } catch {
    return null;
  }
}

export function useTrace(traceId: string): TraceView {
  const [endedTraceId, setEndedTraceId] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const spanCache = useRef<SpanCache | null>(null);
  const polled = usePolledResource(
    async () => {
      const data = await readTraceData(traceId, spanCache);
      setEndedTraceId(data.summary.state === "open" ? null : traceId);
      return data;
    },
    [traceId],
    { intervalMs: TRACE_POLL_MS, hold: endedTraceId === traceId || paused },
  );
  const summary = polled.data?.summary ?? null;
  const nodeId = summary?.node_id ?? null;
  const projectId = summary?.project_id ?? null;
  const nodeName = useResource(() => readNodeName(nodeId), [nodeId]);
  const projectName = useResource(() => readProjectName(projectId), [projectId]);

  return {
    summary,
    spans: polled.data?.spans ?? NO_SPANS,
    error: polled.error,
    expired: polled.error?.code === "not_found",
    retry: polled.refresh,
    live: summary?.state === "open" && !paused,
    paused,
    togglePaused: () => setPaused((value) => !value),
    nodeName: nodeName.data,
    projectName: projectName.data,
    title: summary === null ? null : traceTitleOf(summary, nodeName.data),
  };
}
