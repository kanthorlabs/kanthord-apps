import type {
  MissionNodeRecord,
  NodeState,
  SchedulerJob,
  WorkerBindingRecord,
  WorkerCatalogItem,
  WorkerInstanceRecord,
  Work,
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

export interface NodeFacts {
  readonly state: NodeState;
  readonly work: Work;
  readonly requires: readonly string[];
}

export function factsOf(node: MissionNodeRecord): NodeFacts {
  return { state: node.state, work: node.work, requires: node.requires };
}

function admits(
  binding: WorkerBindingRecord,
  catalog: readonly WorkerCatalogItem[],
  facts: NodeFacts,
): boolean {
  const worker = catalog.find((item) => item.name === binding.config.worker);
  if (worker === undefined) return false;
  const traits = binding.config.traits ?? [];
  return (
    worker.declared_node_states.includes(facts.state) &&
    worker.declared_works.includes(facts.work) &&
    facts.requires.every((trait) => traits.includes(trait))
  );
}

function liveBindingsOf(
  instances: readonly WorkerInstanceRecord[],
  bindings: readonly WorkerBindingRecord[],
): readonly WorkerBindingRecord[] {
  const live = new Set(
    instances
      .filter((instance) => instance.registered && !instance.draining)
      .map((instance) => instance.resource_identity),
  );
  return bindings.filter((binding) => live.has(binding.resource_identity));
}

export function uncoveredJobsOf(
  jobs: readonly SchedulerJob[],
  nodes: readonly MissionNodeRecord[],
  instances: readonly WorkerInstanceRecord[],
  bindings: readonly WorkerBindingRecord[],
  catalog: readonly WorkerCatalogItem[],
): ReadonlyMap<NodeState, readonly SchedulerJob[]> {
  const live = liveBindingsOf(instances, bindings);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const uncovered = new Map<NodeState, SchedulerJob[]>();
  for (const job of jobs) {
    const node = nodeById.get(job.node_id);
    if (node === undefined) continue;
    const facts = factsOf(node);
    if (live.some((binding) => admits(binding, catalog, facts))) continue;
    uncovered.set(node.state, [...(uncovered.get(node.state) ?? []), job]);
  }
  return uncovered;
}

export function uncoveredStates(
  jobs: readonly SchedulerJob[],
  nodes: readonly MissionNodeRecord[],
  instances: readonly WorkerInstanceRecord[],
  catalog: readonly WorkerCatalogItem[],
): ReadonlySet<NodeState> {
  const declared = declaredStatesOf(instances, catalog);
  const stateOf = new Map(nodes.map((node) => [node.id, node.state]));
  const states = new Set<NodeState>();
  for (const job of jobs) {
    const state = stateOf.get(job.node_id);
    if (state !== undefined && !declared.has(state)) states.add(state);
  }
  return states;
}

export type TakerHint =
  | { readonly kind: "none" }
  | { readonly kind: "server" | "worker"; readonly binding: string; readonly worker: string };

export function takerHintOf(
  facts: NodeFacts,
  bindings: readonly WorkerBindingRecord[],
  catalog: readonly WorkerCatalogItem[],
): TakerHint {
  const ordered = [...bindings].sort((left, right) => left.name.localeCompare(right.name));
  for (const binding of ordered) {
    if (!admits(binding, catalog, facts)) continue;
    const worker = catalog.find((item) => item.name === binding.config.worker);
    const atServer = worker?.host === "kanthord" && binding.config.placement === "server";
    return {
      kind: atServer ? "server" : "worker",
      binding: binding.name,
      worker: binding.config.worker,
    };
  }
  return { kind: "none" };
}
