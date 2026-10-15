import { useEffect } from "react";

import { useNodeDiscard, type NodeDiscardState } from "@/hooks/use-node-discard";
import { useNodeUnblock, type NodeUnblockState } from "@/hooks/use-node-unblock";
import type { AttentionDetail, AttentionItem } from "@/lib/attention";

export interface DecisionActs {
  readonly unblock: NodeUnblockState;
  readonly discard: NodeDiscardState;
  readonly ready: boolean;
  readonly waiting: string | null;
}

interface DecisionContext {
  readonly reload: () => void;
  readonly setDialogOpen: (nodeId: string, open: boolean) => void;
}

function proposalsStateOf(
  item: AttentionItem,
  detail: AttentionDetail | null,
): { readonly ready: boolean; readonly waiting: string | null } {
  if (item.node.kind !== "initiative") return { ready: true, waiting: null };
  if (detail === null) {
    return { ready: false, waiting: "Reading the fix proposals. The acts show after the read." };
  }
  if (detail.proposals.status === "failed") {
    return {
      ready: false,
      waiting: `The fix proposals could not be read: ${detail.proposals.message}. Unblock and Discard wait for them.`,
    };
  }
  return { ready: true, waiting: null };
}

export function useDecisionActs(
  item: AttentionItem,
  detail: AttentionDetail | null,
  { reload, setDialogOpen }: DecisionContext,
): DecisionActs {
  const { node, missionVersion } = item;
  const proposals = detail?.proposals.status === "ready" ? detail.proposals.data : [];
  const unblock = useNodeUnblock(node, missionVersion, proposals, reload);
  const discard = useNodeDiscard(node, missionVersion, reload);
  const open = unblock.open || discard.open;

  useEffect(() => {
    setDialogOpen(node.id, open);
    return () => setDialogOpen(node.id, false);
  }, [node.id, open, setDialogOpen]);

  return { unblock, discard, ...proposalsStateOf(item, detail) };
}
