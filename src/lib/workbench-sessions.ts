import type { AgentEnablementState, WorkbenchSessionListItem } from "@/api/types";

export function sessionsNewestFirst(
  items: readonly WorkbenchSessionListItem[],
): readonly WorkbenchSessionListItem[] {
  return [...items].sort((left, right) => right.modified - left.modified);
}

export function sessionTitle(item: WorkbenchSessionListItem): string {
  if (item.name !== null && item.name !== "") return item.name;
  return item.firstMessage === "" ? "Empty Session" : item.firstMessage;
}

export function workbenchSessionPath(sessionId: string): string {
  return `/workbench/${encodeURIComponent(sessionId)}`;
}

export function newSessionUnavailableReason(
  agentName: string | null,
  enablementState: AgentEnablementState | null,
): string | null {
  if (agentName === null) return "Pick an agent in the filter to start a session.";
  return enablementState === "enabled" ? null : "Enable the agent before a session can start.";
}

export function workbenchListPath(agentName: string): string {
  return `/workbench?${new URLSearchParams({ agentName })}`;
}
