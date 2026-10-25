import { newIdempotencyKey } from "@/lib/idempotency-key";
import { request } from "../client";
import { readAllPages } from "../pages";
import type {
  AnalyticsCostItem,
  AnalyticsCostQuery,
  AnalyticsDurationItem,
  AnalyticsDurationQuery,
  AnalyticsPage,
  CauseLabel,
  CauseLabelBody,
  Page,
  TelemetryText,
  TimelineItem,
  TimelineQuery,
  TraceFacets,
  TraceListItem,
  TraceListQuery,
  TraceSessionEntry,
  TraceSpan,
  TraceSummary,
} from "../types";

const TRACE_PATH = "/api/tracking/trace";
const TIMELINE_PATH = "/api/tracking/timeline";
const TIMELINE_SCOPES = ["execution_id", "node_id", "project_id"] as const;
const TIMELINE_RANGE = ["from", "to"] as const;
const ANALYTICS_PATH = "/api/tracking/analytics";
const DEFAULT_TIMELINE_DEPTH = 2;

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
): Promise<Page<TraceListItem>> {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined) params.set(name, String(value));
  }
  params.set("limit", String(limit));
  if (cursor !== null) params.set("cursor", cursor);
  return request<Page<TraceListItem>>(`${TRACE_PATH}?${params}`);
}

export async function listTimelinePage(
  query: TimelineQuery,
  cursor: string | null,
  limit: number,
): Promise<Page<TimelineItem>> {
  const params = new URLSearchParams();
  for (const name of TIMELINE_SCOPES) {
    const value = query[name];
    if (value !== undefined) params.set(name, value);
  }
  params.set("depth", String(query.depth ?? DEFAULT_TIMELINE_DEPTH));
  for (const name of TIMELINE_RANGE) {
    const value = query[name];
    if (value !== undefined) params.set(name, String(value));
  }
  params.set("limit", String(limit));
  if (cursor !== null) params.set("cursor", cursor);
  return request<Page<TimelineItem>>(`${TIMELINE_PATH}?${params}`);
}

function analyticsUrl(path: string, query: object): string {
  const params = new URLSearchParams();
  for (const [name, value] of Object.entries(query)) {
    if (value !== undefined) params.set(name, String(value));
  }
  const text = params.toString();
  return text === "" ? path : `${path}?${text}`;
}

export async function readAnalyticsCost(
  query: AnalyticsCostQuery,
): Promise<AnalyticsPage<AnalyticsCostItem>> {
  return request<AnalyticsPage<AnalyticsCostItem>>(analyticsUrl(`${ANALYTICS_PATH}/cost`, query));
}

export async function readAnalyticsDuration(
  query: AnalyticsDurationQuery,
): Promise<AnalyticsPage<AnalyticsDurationItem>> {
  const { measure, ...rest } = query;
  return request<AnalyticsPage<AnalyticsDurationItem>>(
    analyticsUrl(`${ANALYTICS_PATH}/duration`, { measure, ...rest }),
  );
}

export async function readTrace(traceId: string): Promise<TraceSummary> {
  return request<TraceSummary>(tracePath(traceId));
}

export async function readTraceFacets(projectId: string | null): Promise<TraceFacets> {
  const query = projectId === null ? "" : `?project_id=${encodeURIComponent(projectId)}`;
  return request<TraceFacets>(`/api/tracking/facet${query}`);
}

export async function labelTraceCause(traceId: string, body: CauseLabelBody): Promise<CauseLabel> {
  return request<CauseLabel>(`${tracePath(traceId)}/cause/label`, {
    method: "POST",
    body,
    headers: { "idempotency-key": newIdempotencyKey() },
  });
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
