import type { AgentConsumer, AgentEnablementState, WorkbenchSessionListItem } from "@/api/types";

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

export function newSessionUnavailableReason(
  enablementState: AgentEnablementState | null,
  consumers: readonly AgentConsumer[],
): string | null {
  if (!consumers.includes("workbench")) return "This agent does not serve the Workbench.";
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
