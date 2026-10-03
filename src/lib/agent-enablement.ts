import type { AgentEnablement } from "@/api/types";

export type EnablementBadgeVariant = "default" | "secondary" | "outline";

export function enablementLabel(enablement: AgentEnablement | null): string {
  return enablement === null ? "not enabled" : enablement.state;
}

export function enablementVariant(enablement: AgentEnablement | null): EnablementBadgeVariant {
  if (enablement === null) return "outline";
  return enablement.state === "enabled" ? "default" : "secondary";
}
