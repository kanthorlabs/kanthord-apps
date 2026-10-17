import type { MissionEdge, MissionNodeRecord } from "@/api/types";

export interface DependencyLink {
  readonly dependentId: string;
  readonly dependsOnId: string;
}

export type GraphDiagnostic =
  | { readonly kind: "unresolved-dependency"; readonly link: DependencyLink }
  | { readonly kind: "cycle"; readonly nodeIds: readonly string[] };

export interface GraphModel {
  readonly rows: readonly (readonly MissionNodeRecord[])[];
  readonly nodeById: ReadonlyMap<string, MissionNodeRecord>;
  readonly dependsOn: ReadonlyMap<string, readonly string[]>;
  readonly dependents: ReadonlyMap<string, readonly string[]>;
  readonly links: readonly DependencyLink[];
  readonly diagnostics: readonly GraphDiagnostic[];
}

export type ClosureStatus = "holds" | "does not hold" | "unknown";

export interface ClosureMember {
  readonly nodeId: string;
  readonly node: MissionNodeRecord | null;
}

export interface Closure {
  readonly members: readonly ClosureMember[];
  readonly status: ClosureStatus;
}

interface Ranking {
  readonly rank: ReadonlyMap<string, number>;
  readonly cyclic: readonly string[];
}

function byPriorityThenFilename(a: MissionNodeRecord, b: MissionNodeRecord): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.filename.localeCompare(b.filename);
}

function rankByLongestPath(ids: readonly string[], links: readonly DependencyLink[]): Ranking {
  const members = new Set(ids);
  const incoming = new Map<string, number>(ids.map((id) => [id, 0]));
  const outgoing = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const link of links) {
    if (!members.has(link.dependentId) || !members.has(link.dependsOnId)) continue;
    outgoing.get(link.dependsOnId)?.push(link.dependentId);
    incoming.set(link.dependentId, (incoming.get(link.dependentId) ?? 0) + 1);
  }
  const rank = new Map<string, number>();
  const ready = ids.filter((id) => incoming.get(id) === 0);
  for (const id of ready) rank.set(id, 0);
  for (let index = 0; index < ready.length; index += 1) {
    const id = ready[index] as string;
    const next = (rank.get(id) ?? 0) + 1;
    for (const dependent of outgoing.get(id) ?? []) {
      rank.set(dependent, Math.max(rank.get(dependent) ?? 0, next));
      const left = (incoming.get(dependent) ?? 0) - 1;
      incoming.set(dependent, left);
      if (left === 0) ready.push(dependent);
    }
  }
  const cyclic = ids.filter((id) => (incoming.get(id) ?? 0) > 0);
  return { rank, cyclic };
}

function pushTo<T>(map: Map<string, T[]>, key: string, value: T): void {
  const list = map.get(key);
  if (list === undefined) map.set(key, [value]);
  else list.push(value);
}

function reachableFrom(
  start: string,
  outgoing: ReadonlyMap<string, readonly string[]>,
): ReadonlySet<string> {
  const reached = new Set<string>();
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    for (const next of outgoing.get(queue[index] as string) ?? []) {
      if (reached.has(next)) continue;
      reached.add(next);
      queue.push(next);
    }
  }
  return reached;
}

function findCycles(ids: readonly string[], links: readonly DependencyLink[]): string[][] {
  const outgoing = new Map<string, string[]>(ids.map((id) => [id, []]));
  for (const link of links) outgoing.get(link.dependsOnId)?.push(link.dependentId);
  const reach = new Map(ids.map((id) => [id, reachableFrom(id, outgoing)]));
  const grouped = new Set<string>();
  const cycles: string[][] = [];
  for (const id of ids) {
    if (grouped.has(id) || reach.get(id)?.has(id) !== true) continue;
    const members = ids.filter((other) => reach.get(id)?.has(other) && reach.get(other)?.has(id));
    for (const member of members) grouped.add(member);
    cycles.push(members);
  }
  return cycles;
}

function placeCyclic(ranking: Ranking): ReadonlyMap<string, number> {
  if (ranking.cyclic.length === 0) return ranking.rank;
  const rank = new Map(ranking.rank);
  const last = Math.max(-1, ...rank.values()) + 1;
  for (const id of ranking.cyclic) rank.set(id, last);
  return rank;
}

function groupRows(
  nodes: readonly MissionNodeRecord[],
  rank: ReadonlyMap<string, number>,
): MissionNodeRecord[][] {
  const rows: MissionNodeRecord[][] = [];
  for (const node of nodes) {
    const index = rank.get(node.id) ?? 0;
    const row = rows[index];
    if (row === undefined) rows[index] = [node];
    else row.push(node);
  }
  return rows.filter((row) => row.length > 0);
}

export function buildGraph(
  records: readonly MissionNodeRecord[],
  edges: readonly MissionEdge[],
): GraphModel {
  const nodes = records.filter((node) => node.retired_at === null);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const diagnostics: GraphDiagnostic[] = [];

  const dependsOn = new Map<string, string[]>();
  const dependents = new Map<string, string[]>();
  const links: DependencyLink[] = [];
  for (const edge of edges) {
    const link = { dependentId: edge.dependent_id, dependsOnId: edge.depends_on_id };
    if (!nodeById.has(link.dependentId) || !nodeById.has(link.dependsOnId)) {
      diagnostics.push({ kind: "unresolved-dependency", link });
    } else {
      links.push(link);
    }
    if (nodeById.has(link.dependentId)) pushTo(dependsOn, link.dependentId, link.dependsOnId);
    if (nodeById.has(link.dependsOnId)) pushTo(dependents, link.dependsOnId, link.dependentId);
  }

  for (const nodeIds of findCycles(
    nodes.map((node) => node.id),
    links,
  )) {
    diagnostics.push({ kind: "cycle", nodeIds });
  }

  const ordered = [...nodes].sort(byPriorityThenFilename);
  const rank = placeCyclic(
    rankByLongestPath(
      ordered.map((node) => node.id),
      links,
    ),
  );

  return { rows: groupRows(ordered, rank), nodeById, dependsOn, dependents, links, diagnostics };
}

export function closureOf(model: GraphModel, nodeId: string): Closure {
  const members = (model.dependsOn.get(nodeId) ?? []).map((id): ClosureMember => ({
    nodeId: id,
    node: model.nodeById.get(id) ?? null,
  }));
  return { members, status: closureStatus(members) };
}

function closureStatus(members: readonly ClosureMember[]): ClosureStatus {
  if (
    members.some((member) => member.node?.state !== undefined && member.node.state !== "Completed")
  ) {
    return "does not hold";
  }
  return members.some((member) => member.node === null) ? "unknown" : "holds";
}

export function nameOf(model: GraphModel, nodeId: string): string {
  return model.nodeById.get(nodeId)?.content.name ?? nodeId;
}

export function dependencyNames(model: GraphModel, nodeId: string): readonly string[] {
  return (model.dependsOn.get(nodeId) ?? []).map((id) => nameOf(model, id));
}

export function diagnosticKey(diagnostic: GraphDiagnostic): string {
  if (diagnostic.kind === "unresolved-dependency") {
    return `${diagnostic.kind}:${diagnostic.link.dependentId}:${diagnostic.link.dependsOnId}`;
  }
  return `${diagnostic.kind}:${diagnostic.nodeIds.join(",")}`;
}
