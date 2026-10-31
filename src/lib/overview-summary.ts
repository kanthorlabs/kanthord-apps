import type { MissionNodeRecord, Project } from "@/api/types";

import type { ProjectSnapshot } from "./attention";

export function claimedNodeCount(nodes: readonly MissionNodeRecord[]): number {
  return nodes.filter(
    (node) =>
      node.retired_at === null && (node.state === "Executing" || node.state === "Evaluating"),
  ).length;
}

export interface CoolingFact {
  readonly key: string;
  readonly agent: string;
  readonly binding: string;
  readonly project: Project;
  readonly availableAt: number;
}

export function coolingFactsOf(snapshots: readonly ProjectSnapshot[]): readonly CoolingFact[] {
  return snapshots.flatMap((snapshot) =>
    (snapshot.bindings ?? []).flatMap((entry) =>
      (entry.agents ?? []).flatMap((view) =>
        view.cooling === null
          ? []
          : [
              {
                key: `${snapshot.project.id}:${entry.binding.id}:${view.agent}`,
                agent: view.agent,
                binding: entry.binding.name,
                project: snapshot.project,
                availableAt: view.cooling.available_at,
              },
            ],
      ),
    ),
  );
}

export function projectsWithoutSetup(
  snapshots: readonly ProjectSnapshot[],
  setupProjects: readonly { readonly project: Project }[],
): number {
  return snapshots.filter(
    (snapshot) => !setupProjects.some((entry) => entry.project.id === snapshot.project.id),
  ).length;
}
