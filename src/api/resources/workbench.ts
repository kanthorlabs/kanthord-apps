import { newIdempotencyKey } from "@/lib/idempotency-key";
import { ApiError } from "../errors";
import { type Connection, connectionBaseUrl, request } from "../client";
import type {
  WorkbenchAbortAnswer,
  WorkbenchActionReportAnswer,
  WorkbenchActionReportBody,
  WorkbenchApprovalAnswer,
  WorkbenchAutoModeAnswer,
  WorkbenchConfiguration,
  WorkbenchForkAnswer,
  WorkbenchGuestMessageAnswer,
  WorkbenchGuestMessageBody,
  WorkbenchGuestSession,
  WorkbenchInvite,
  WorkbenchInviteCreateBody,
  WorkbenchInviteCreated,
  WorkbenchInviteJoinAnswer,
  WorkbenchInviteJoinBody,
  WorkbenchInviteListAnswer,
  WorkbenchInviteRevokeAnswer,
  WorkbenchMessageAnswer,
  WorkbenchMessageDelivery,
  WorkbenchQueueRemoveAnswer,
  WorkbenchSession,
  WorkbenchSessionCreateBody,
  WorkbenchSessionEvents,
  WorkbenchSessionListItem,
} from "../types";

const SESSION_ROOT = "/api/workbench/session";
const INVITE_ROOT = "/api/workbench/invite";
const GUEST_ROOT = "/api/workbench/guest/session";

export type ForkWorkbenchInput = { text: string; signal?: AbortSignal };

function sessionPath(sessionId: string): string {
  return `${SESSION_ROOT}/${encodeURIComponent(sessionId)}`;
}

function idempotencyHeader(): Record<string, string> {
  return { "idempotency-key": newIdempotencyKey() };
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
  delivery: WorkbenchMessageDelivery = "queue",
): Promise<WorkbenchMessageAnswer> {
  return post<WorkbenchMessageAnswer>(`${sessionPath(sessionId)}/message`, { text, delivery });
}

export async function removeQueuedWorkbenchMessage(
  sessionId: string,
  queuedMessageId: string,
): Promise<WorkbenchQueueRemoveAnswer> {
  return request<WorkbenchQueueRemoveAnswer>(
    `${sessionPath(sessionId)}/queue/${encodeURIComponent(queuedMessageId)}`,
    { method: "DELETE", headers: idempotencyHeader() },
  );
}

export async function abortWorkbenchRun(sessionId: string): Promise<WorkbenchAbortAnswer> {
  return post<WorkbenchAbortAnswer>(`${sessionPath(sessionId)}/abort`);
}

export async function approveWorkbenchCall(
  sessionId: string,
  toolCallId: string,
  approved: boolean,
  nodeName?: string,
): Promise<WorkbenchApprovalAnswer> {
  return post<WorkbenchApprovalAnswer>(`${sessionPath(sessionId)}/approve`, {
    tool_call_id: toolCallId,
    approved,
    ...(nodeName === undefined ? {} : { node_name: nodeName }),
  });
}

export async function setWorkbenchAutoMode(
  sessionId: string,
  enabled: boolean,
): Promise<WorkbenchAutoModeAnswer> {
  return post<WorkbenchAutoModeAnswer>(`${sessionPath(sessionId)}/auto-mode`, { enabled });
}

export async function reportWorkbenchAction(
  sessionId: string,
  toolCallId: string,
  body: WorkbenchActionReportBody,
): Promise<WorkbenchActionReportAnswer> {
  return post<WorkbenchActionReportAnswer>(
    `${sessionPath(sessionId)}/action/${encodeURIComponent(toolCallId)}/report`,
    body,
  );
}

export async function forkWorkbenchSession(
  sessionId: string,
  input: ForkWorkbenchInput,
): Promise<WorkbenchForkAnswer> {
  return request<WorkbenchForkAnswer>(`${sessionPath(sessionId)}/fork`, {
    method: "POST",
    body: { text: input.text },
    headers: idempotencyHeader(),
    signal: input.signal,
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

export async function createInvite(
  sessionId: string,
  body: WorkbenchInviteCreateBody,
): Promise<WorkbenchInviteCreated> {
  return post<WorkbenchInviteCreated>(`${sessionPath(sessionId)}/invite`, {
    ...body,
    project_ids: [...body.project_ids].sort(),
  });
}

export async function listInvites(sessionId: string): Promise<readonly WorkbenchInvite[]> {
  const answer = await request<WorkbenchInviteListAnswer>(`${sessionPath(sessionId)}/invite`);
  return answer.items;
}

export async function revokeInvite(inviteId: string): Promise<WorkbenchInviteRevokeAnswer> {
  return request<WorkbenchInviteRevokeAnswer>(`${INVITE_ROOT}/${encodeURIComponent(inviteId)}`, {
    method: "DELETE",
    headers: idempotencyHeader(),
  });
}

export async function joinInvite(
  body: WorkbenchInviteJoinBody,
  baseUrl: string | null = connectionBaseUrl(),
): Promise<WorkbenchInviteJoinAnswer> {
  if (baseUrl === null) throw new ApiError("unreachable", "No server is connected.", 0);
  return request<WorkbenchInviteJoinAnswer>(
    `${INVITE_ROOT}/join`,
    { method: "POST", body, headers: idempotencyHeader() },
    { baseUrl, token: null },
  );
}

export async function readGuestSession(connection: Connection): Promise<WorkbenchGuestSession> {
  return request<WorkbenchGuestSession>(GUEST_ROOT, {}, connection);
}

export async function sendGuestMessage(
  connection: Connection,
  body: WorkbenchGuestMessageBody,
): Promise<WorkbenchGuestMessageAnswer> {
  return request<WorkbenchGuestMessageAnswer>(
    `${GUEST_ROOT}/message`,
    { method: "POST", body, headers: idempotencyHeader() },
    connection,
  );
}
