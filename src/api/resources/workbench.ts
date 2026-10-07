import { newUlid } from "@/lib/ulid";
import { request } from "../client";
import type {
  WorkbenchAbortAnswer,
  WorkbenchApprovalAnswer,
  WorkbenchConfiguration,
  WorkbenchMessageAnswer,
  WorkbenchSession,
  WorkbenchSessionCreateBody,
  WorkbenchSessionEvents,
  WorkbenchSessionListItem,
} from "../types";

const SESSION_ROOT = "/api/workbench/session";

function sessionPath(sessionId: string): string {
  return `${SESSION_ROOT}/${encodeURIComponent(sessionId)}`;
}

function idempotencyHeader(): Record<string, string> {
  return { "idempotency-key": newUlid() };
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body, headers: idempotencyHeader() });
}

export async function listWorkbenchSessions(
  agentName: string | null,
): Promise<readonly WorkbenchSessionListItem[]> {
  const query = agentName === null ? "" : `?${new URLSearchParams({ agent_name: agentName })}`;
  const answer = await request<{ items: readonly WorkbenchSessionListItem[] }>(
    `${SESSION_ROOT}${query}`,
  );
  return answer.items;
}

export async function createWorkbenchSession(
  body: WorkbenchSessionCreateBody,
): Promise<WorkbenchSession> {
  return post<WorkbenchSession>(SESSION_ROOT, body);
}

export async function readWorkbenchSession(sessionId: string): Promise<WorkbenchSession> {
  return request<WorkbenchSession>(sessionPath(sessionId));
}

export async function configureWorkbenchSession(
  sessionId: string,
  body: WorkbenchConfiguration,
): Promise<WorkbenchConfiguration> {
  return request<WorkbenchConfiguration>(`${sessionPath(sessionId)}/configuration`, {
    method: "PUT",
    body,
    headers: idempotencyHeader(),
  });
}

export async function sendWorkbenchMessage(
  sessionId: string,
  text: string,
): Promise<WorkbenchMessageAnswer> {
  return post<WorkbenchMessageAnswer>(`${sessionPath(sessionId)}/message`, { text });
}

export async function abortWorkbenchRun(sessionId: string): Promise<WorkbenchAbortAnswer> {
  return post<WorkbenchAbortAnswer>(`${sessionPath(sessionId)}/abort`);
}

export async function approveWorkbenchCall(
  sessionId: string,
  toolCallId: string,
  approved: boolean,
): Promise<WorkbenchApprovalAnswer> {
  return post<WorkbenchApprovalAnswer>(`${sessionPath(sessionId)}/approve`, {
    tool_call_id: toolCallId,
    approved,
  });
}

export async function readWorkbenchEvents(
  sessionId: string,
  after: string | null,
  version: number | null,
  signal?: AbortSignal,
): Promise<WorkbenchSessionEvents> {
  const params = new URLSearchParams();
  if (after !== null) params.set("after", after);
  if (version !== null) params.set("version", String(version));
  const query = params.size === 0 ? "" : `?${params}`;
  return request<WorkbenchSessionEvents>(`${sessionPath(sessionId)}/events${query}`, { signal });
}
