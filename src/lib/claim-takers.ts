import type {
  MissionNodeRecord,
  NodeState,
  SchedulerJob,
  WorkerBindingRecord,
  WorkerCatalogItem,
  WorkerInstanceRecord,
  Work,
} from "@/api/types";

export interface NodeFacts {
  readonly state: NodeState;
  readonly work: Work;
  readonly requires: readonly string[];
}

export function factsOf(node: MissionNodeRecord): NodeFacts {
  return {
    state: node.state,
    work: node.work,
    requires: [...node.requires].sort((left, right) => left.localeCompare(right)),
  };
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

export interface UncoveredGroup {
  readonly facts: NodeFacts;
  readonly jobs: readonly SchedulerJob[];
}

function groupKeyOf(facts: NodeFacts): string {
  return `${facts.state}:${facts.work}:${facts.requires.join(",")}`;
}

export function uncoveredJobsOf(
  jobs: readonly SchedulerJob[],
  nodes: readonly MissionNodeRecord[],
  instances: readonly WorkerInstanceRecord[],
  bindings: readonly WorkerBindingRecord[],
  catalog: readonly WorkerCatalogItem[],
): readonly UncoveredGroup[] {
  const live = liveBindingsOf(instances, bindings);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const groups = new Map<string, UncoveredGroup>();
  for (const job of jobs) {
    const node = nodeById.get(job.node_id);
    if (node === undefined) continue;
    const facts = factsOf(node);
    if (live.some((binding) => admits(binding, catalog, facts))) continue;
    const key = groupKeyOf(facts);
    const group = groups.get(key);
    groups.set(key, { facts, jobs: [...(group?.jobs ?? []), job] });
  }
  return [...groups.values()];
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
