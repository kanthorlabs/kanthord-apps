import { useMemo, useState } from "react";

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
): readonly ChainRow[] {
  const [now] = useState(Date.now);
  return useMemo(
    () =>
      chain.map((entry) => ({
        entry,
        active: entry.position === activePosition,
        cooldown: cooldownStateOf(entry, now),
      })),
    [chain, activePosition, now],
  );
}
