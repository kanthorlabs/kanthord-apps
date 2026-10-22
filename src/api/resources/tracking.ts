import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  Page,
  TelemetryText,
  TraceFacets,
  TraceListQuery,
  TraceSessionEntry,
  TraceSpan,
  TraceSummary,
} from "../types";

const TRACE_PATH = "/api/tracking/trace";

function tracePath(traceId: string): string {
  return `${TRACE_PATH}/${encodeURIComponent(traceId)}`;
}

function sessionPath(traceId: string, sessionId: string): string {
  return `${tracePath(traceId)}/session/${encodeURIComponent(sessionId)}/entry`;
}

export async function listTracePage(
  query: TraceListQuery,
  cursor: string | null,
  limit: number,
): Promise<Page<TraceSummary>> {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined) params.set(name, String(value));
  }
  params.set("limit", String(limit));
  if (cursor !== null) params.set("cursor", cursor);
  return request<Page<TraceSummary>>(`${TRACE_PATH}?${params}`);
}

export async function readTrace(traceId: string): Promise<TraceSummary> {
  return request<TraceSummary>(tracePath(traceId));
}

export async function readTraceFacets(projectId: string | null): Promise<TraceFacets> {
  const query = projectId === null ? "" : `?project_id=${encodeURIComponent(projectId)}`;
  return request<TraceFacets>(`/api/tracking/facet${query}`);
}

export async function listTraceSpans(traceId: string): Promise<readonly TraceSpan[]> {
  return readAllPages<TraceSpan>(`${tracePath(traceId)}/span`);
}

export async function readTraceText(traceId: string, textId: string): Promise<TelemetryText> {
  return request<TelemetryText>(`${tracePath(traceId)}/text/${encodeURIComponent(textId)}`);
}

export async function listSessionEntryPage(
  traceId: string,
  sessionId: string,
  cursor: string | null,
  limit: number,
  toolCallId?: string,
): Promise<Page<TraceSessionEntry>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor !== null) params.set("cursor", cursor);
  if (toolCallId !== undefined) params.set("tool_call_id", toolCallId);
  return request<Page<TraceSessionEntry>>(`${sessionPath(traceId, sessionId)}?${params}`);
}

export async function readSessionEntry(
  traceId: string,
  sessionId: string,
  entryId: string,
): Promise<TraceSessionEntry> {
  return request<TraceSessionEntry>(
    `${sessionPath(traceId, sessionId)}/${encodeURIComponent(entryId)}`,
  );
}
