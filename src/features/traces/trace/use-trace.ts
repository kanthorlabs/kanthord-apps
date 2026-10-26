import { useRef, useState } from "react";

import { readMissionNode } from "@/api/resources/mission";
import { listTraceSpans, readTrace } from "@/api/resources/tracking";
import type { ApiError } from "@/api/errors";
import type { TraceSpan, TraceSummary } from "@/api/types";
import { useProject } from "@/features/projects/project-context";
import { usePolledResource } from "@/hooks/use-polled-resource";
import { useResource } from "@/hooks/use-resource";
import { nodeNameOf, traceTitleOf } from "@/lib/trace-title";

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
  const spans = polled.data?.spans ?? NO_SPANS;
  const rootName = nodeNameOf(
    spans.find((span) => span.span_id === summary?.root_span_id)?.attributes,
  );
  const readName = useResource(
    () => (rootName === null ? readNodeName(nodeId) : Promise.resolve(null)),
    [nodeId, rootName],
  );
  const nodeName = rootName ?? readName.data;
  const { projects } = useProject();
  const projectName = projects.find((project) => project.id === projectId)?.name ?? null;

  return {
    summary,
    spans,
    error: polled.error,
    expired: polled.error?.code === "not_found",
    retry: polled.refresh,
    live: summary?.state === "open" && !paused,
    paused,
    togglePaused: () => setPaused((value) => !value),
    nodeName,
    projectName,
    title: summary === null ? null : traceTitleOf(summary, nodeName),
  };
}
