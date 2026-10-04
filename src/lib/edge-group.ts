import type { DependencyLink, GraphModel } from "./mission-graph";

export const EDGE_GROUPS = ["done", "waiting", "stuck"] as const;

export type EdgeGroup = (typeof EDGE_GROUPS)[number];

export const EDGE_GROUP_LABELS: Record<EdgeGroup, string> = {
  done: "Done",
  waiting: "Waiting",
  stuck: "Stuck",
};

function inOneCycle(model: GraphModel, link: DependencyLink): boolean {
  return model.diagnostics.some(
    (diagnostic) =>
      diagnostic.kind === "cycle" &&
      diagnostic.nodeIds.includes(link.dependentId) &&
      diagnostic.nodeIds.includes(link.dependsOnId),
  );
}

export function edgeGroupOf(model: GraphModel, link: DependencyLink): EdgeGroup {
  const source = model.nodeById.get(link.dependsOnId);
  if (source === undefined || source.kind === "task") return "stuck";
  if (source.state === "Completed") return "done";
  if (source.state === "Discarded" || inOneCycle(model, link)) return "stuck";
  return "waiting";
}
