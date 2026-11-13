import type { AgentGuardClass, AgentSummary, AgentToolSource } from "@/api/types";

export type GuardClassBadgeVariant = "default" | "secondary";

export interface GuardClassFacts {
  readonly variant: GuardClassBadgeVariant;
  readonly undo: string;
}

export const GUARD_CLASS_FACTS: Readonly<Record<AgentGuardClass, GuardClassFacts>> = {
  read: { variant: "secondary", undo: "Reads only. Nothing to undo." },
  card: { variant: "default", undo: "Waits on your card." },
};

const TOOL_COUNT_ORDER: readonly AgentToolSource[] = [
  "builtin",
  "host",
  "kanthord-mcp",
  "operation",
];

export function toolCountsLine(toolCounts: AgentSummary["toolCounts"]): string {
  const parts = TOOL_COUNT_ORDER.filter((source) => toolCounts[source] > 0).map(
    (source) => `${toolCounts[source]} ${source}`,
  );
  return parts.length === 0 ? "No tools" : parts.join(", ");
}
