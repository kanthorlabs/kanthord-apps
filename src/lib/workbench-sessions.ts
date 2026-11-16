import type { AgentEnablementState, WorkbenchSessionListItem } from "@/api/types";

export const YUMI_AGENT = "ops@1";

export function sessionsNewestFirst(
  items: readonly WorkbenchSessionListItem[],
): readonly WorkbenchSessionListItem[] {
  return [...items].sort((left, right) => right.modified - left.modified);
}

export function sessionTitle(item: WorkbenchSessionListItem): string {
  if (item.name !== null && item.name !== "") return item.name;
  return item.first_message === "" ? "Empty Session" : item.first_message;
}

export function workbenchSessionPath(sessionId: string): string {
  return `/workbench/${encodeURIComponent(sessionId)}`;
}

interface NotHostFailure {
  readonly status: number;
  readonly detail: string;
  readonly details?: unknown;
}

export function hostSessionIdOf(error: NotHostFailure): string | null {
  if (error.status !== 409 || error.detail !== "workbench.session.not_host") return null;
  if (typeof error.details !== "object" || error.details === null) return null;
  const hostSessionId: unknown = Reflect.get(error.details, "host_session_id");
  return typeof hostSessionId === "string" ? hostSessionId : null;
}

export function newSessionUnavailableReason(
  enablementState: AgentEnablementState | null,
): string | null {
  return enablementState === "enabled" ? null : "Enable the agent before a session can start.";
}

export function workbenchListPath(agentName: string): string {
  return `/workbench?${new URLSearchParams({ agentName })}`;
}

export function agentPath(agentName: string): string {
  return `/agents/${encodeURIComponent(agentName)}`;
}

export function agentProviderCountText(count: number): string {
  return `${count} ${count === 1 ? "agent provider" : "agent providers"}`;
}
