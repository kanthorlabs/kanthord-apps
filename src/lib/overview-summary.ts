import type { MissionNodeRecord, Project } from "@/api/types";

import { ATTENTION_GROUPS, type AttentionItem, type ProjectSnapshot } from "./attention";
import { counted } from "./counted";
import type { StateTally } from "./state-tally";

export function attentionSummary(items: readonly AttentionItem[]): string {
  const parts = ATTENTION_GROUPS.flatMap((group) => {
    const count = items.filter((item) => item.group === group.id).length;
    return count === 0 ? [] : [counted(count, group.noun, group.plural)];
  });
  return parts.length === 0 ? "No item waits for you" : parts.join(" · ");
}

export function statusLineText(running: number, waiting: number): string {
  const executions = running === 1 ? "execution runs" : "executions run";
  const jobs = waiting === 1 ? "job waits" : "jobs wait";
  return `${running} ${executions} · ${waiting} ${jobs}`;
}

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

export function progressSummary(projects: readonly (readonly StateTally[])[]): string {
  const tallies = projects.flat();
  const nodes = tallies.reduce((total, tally) => total + tally.count, 0);
  const completed = tallies
    .filter((tally) => tally.state === "Completed")
    .reduce((total, tally) => total + tally.count, 0);
  return `${counted(projects.length, "project", "projects")} · ${counted(nodes, "node", "nodes")} · ${completed} completed`;
}
