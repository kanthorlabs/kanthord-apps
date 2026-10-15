import { useCallback } from "react";

import { useNodeCheck, type NodeCheckState } from "@/hooks/use-node-check";
import type { AttentionDetail, OutsideAttentionItem } from "@/lib/attention";

export interface OutsideActs {
  readonly check: NodeCheckState;
}

interface OutsideContext {
  readonly reload: () => void;
  readonly markActed: (itemId: string) => void;
}

export function useOutsideActs(
  item: OutsideAttentionItem,
  detail: AttentionDetail | null,
  { reload, markActed }: OutsideContext,
): OutsideActs {
  const actions =
    detail?.kind === "external" && detail.actions.status === "ready" ? detail.actions.data : null;
  const itemId = item.id;
  const acted = useCallback(() => markActed(itemId), [markActed, itemId]);
  const check = useNodeCheck(item.node, item.missionVersion, actions, acted, reload);
  return { check };
}
