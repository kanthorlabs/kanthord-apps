import type { MissionNodeRecord, Project } from "@/api/types";

import type { ProjectSnapshot } from "./attention";

export interface HeldNode {
  readonly node: MissionNodeRecord;
  readonly project: Project;
}

export function heldNodesOf(
  ids: readonly string[],
  snapshots: readonly ProjectSnapshot[],
): readonly HeldNode[] {
  return ids.flatMap((id): readonly HeldNode[] => {
    for (const snapshot of snapshots) {
      const node = snapshot.nodes.find((candidate) => candidate.id === id);
      if (node !== undefined) return [{ node, project: snapshot.project }];
    }
    return [];
  });
}
