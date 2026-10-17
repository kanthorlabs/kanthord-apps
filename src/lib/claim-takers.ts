import type {
  MissionNodeRecord,
  NodeState,
  SchedulerJob,
  WorkerBindingRecord,
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

export function uncoveredJobsOf(
  jobs: readonly SchedulerJob[],
  nodes: readonly MissionNodeRecord[],
  instances: readonly WorkerInstanceRecord[],
  catalog: readonly WorkerCatalogItem[],
): ReadonlyMap<NodeState, readonly SchedulerJob[]> {
  const declared = declaredStatesOf(instances, catalog);
  const stateOf = new Map<string, NodeState>();
  for (const node of nodes) stateOf.set(node.id, node.state);
  const uncovered = new Map<NodeState, SchedulerJob[]>();
  for (const job of jobs) {
    const state = stateOf.get(job.node_id);
    if (state === undefined || declared.has(state)) continue;
    uncovered.set(state, [...(uncovered.get(state) ?? []), job]);
  }
  return uncovered;
}

export function uncoveredStates(
  jobs: readonly SchedulerJob[],
  nodes: readonly MissionNodeRecord[],
  instances: readonly WorkerInstanceRecord[],
  catalog: readonly WorkerCatalogItem[],
): ReadonlySet<NodeState> {
  return new Set(uncoveredJobsOf(jobs, nodes, instances, catalog).keys());
}

export type TakerHint =
  | { readonly kind: "none" }
  | { readonly kind: "server" | "worker"; readonly binding: string; readonly worker: string };

export function takerHintOf(
  state: NodeState,
  bindings: readonly WorkerBindingRecord[],
  catalog: readonly WorkerCatalogItem[],
): TakerHint {
  const ordered = [...bindings].sort((left, right) => left.name.localeCompare(right.name));
  for (const binding of ordered) {
    const worker = catalog.find((item) => item.name === binding.config.worker);
    if (worker === undefined || !worker.declared_node_states.includes(state)) continue;
    const atServer = worker.host === "kanthord" && binding.config.placement === "server";
    return {
      kind: atServer ? "server" : "worker",
      binding: binding.name,
      worker: binding.config.worker,
    };
  }
  return { kind: "none" };
}
