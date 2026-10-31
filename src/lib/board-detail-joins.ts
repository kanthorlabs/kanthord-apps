import type { EnvironmentState, MissionNodeRecord, Project } from "@/api/types";

import type { AttentionItem, ProjectSnapshot } from "./attention";
import { boardProjectsOf } from "./board-items";

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

export function environmentsOf(
  item: AttentionItem,
  snapshots: readonly ProjectSnapshot[],
): readonly EnvironmentState[] | null {
  const project = boardProjectsOf(item)[0];
  if (project === undefined) return null;
  return snapshots.find((snapshot) => snapshot.project.id === project.id)?.environments ?? null;
}
