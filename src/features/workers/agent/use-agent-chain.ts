import { useMemo } from "react";

import type { AgentChainEntry } from "@/api/types";

export type ChainCooldownState = "none" | "live" | "expired";

export interface ChainRow {
  readonly entry: AgentChainEntry;
  readonly active: boolean;
  readonly cooldown: ChainCooldownState;
}

function cooldownStateOf(entry: AgentChainEntry, now: number): ChainCooldownState {
  if (entry.cooldown === null) return "none";
  return entry.cooldown.available_at > now ? "live" : "expired";
}

export function useAgentChain(
  chain: readonly AgentChainEntry[],
  activePosition: number | null,
  readAt: number,
): readonly ChainRow[] {
  return useMemo(
    () =>
      chain.map((entry) => ({
        entry,
        active: entry.position === activePosition,
        cooldown: cooldownStateOf(entry, readAt),
      })),
    [chain, activePosition, readAt],
  );
}
