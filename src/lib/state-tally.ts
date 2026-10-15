import type { MissionNodeRecord, NodeState } from "@/api/types";
import { NODE_STATES } from "@/api/types";

export interface StateTally {
  readonly state: NodeState;
  readonly count: number;
}

export function tallyStates(nodes: readonly MissionNodeRecord[]): readonly StateTally[] {
  const counts = new Map<NodeState, number>();
  for (const node of nodes) {
    if (node.kind === "task" || node.retired_at !== null) continue;
    counts.set(node.state, (counts.get(node.state) ?? 0) + 1);
  }
  return NODE_STATES.flatMap((state) => {
    const count = counts.get(state) ?? 0;
    return count === 0 ? [] : [{ state, count }];
  });
}
