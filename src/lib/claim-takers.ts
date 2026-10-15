import type {
  MissionNodeRecord,
  SchedulerJob,
  WorkerCatalogItem,
  WorkerInstanceRecord,
} from "@/api/types";

function declaredStatesOf(
  instances: readonly WorkerInstanceRecord[],
  catalog: readonly WorkerCatalogItem[],
): ReadonlySet<string> {
  const declared = new Set<string>();
  for (const instance of instances) {
    if (!instance.registered || instance.draining) continue;
    const worker = catalog.find((item) => item.name === instance.worker_name);
    for (const state of worker?.declared_node_states ?? []) declared.add(state);
  }
  return declared;
}

export function uncoveredStates(
  jobs: readonly SchedulerJob[],
  nodes: readonly MissionNodeRecord[],
  instances: readonly WorkerInstanceRecord[],
  catalog: readonly WorkerCatalogItem[],
): ReadonlySet<string> {
  const declared = declaredStatesOf(instances, catalog);
  const stateOf = new Map<string, string>();
  for (const node of nodes) if (node.kind !== "task") stateOf.set(node.id, node.state);
  const uncovered = new Set<string>();
  for (const job of jobs) {
    const state = stateOf.get(job.node_id);
    if (state !== undefined && !declared.has(state)) uncovered.add(state);
  }
  return uncovered;
}
