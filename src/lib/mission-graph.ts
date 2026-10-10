import type {
  MissionEdge,
  MissionNodeRecord,
  MissionRunnableNode,
  MissionTaskNode,
} from "@/api/types";

import { isTerminal } from "./node-state";

export interface ObjectiveCell {
  readonly node: MissionRunnableNode;
  readonly rank: number;
  readonly tasks: readonly MissionTaskNode[];
}

export interface InitiativeBlock {
  readonly node: MissionRunnableNode;
  readonly rank: number;
  readonly rows: readonly (readonly ObjectiveCell[])[];
}

export interface DependencyLink {
  readonly dependentId: string;
  readonly dependsOnId: string;
}

export type GraphDiagnostic =
  | { readonly kind: "unresolved-dependency"; readonly link: DependencyLink }
  | { readonly kind: "unplaced-node"; readonly nodeId: string }
  | { readonly kind: "cycle"; readonly nodeIds: readonly string[] };

export interface GraphModel {
  readonly initiatives: readonly InitiativeBlock[];
  readonly nodeById: ReadonlyMap<string, MissionNodeRecord>;
  readonly dependsOn: ReadonlyMap<string, readonly string[]>;
  readonly dependents: ReadonlyMap<string, readonly string[]>;
  readonly children: ReadonlyMap<string, readonly MissionNodeRecord[]>;
  readonly links: readonly DependencyLink[];
  readonly diagnostics: readonly GraphDiagnostic[];
}

export type ClosureStatus = "holds" | "does not hold" | "unknown";

export interface ClosureMember {
  readonly nodeId: string;
  readonly node: MissionRunnableNode | null;
  readonly via: string;
}

export interface Closure {
  readonly members: readonly ClosureMember[];
  readonly status: ClosureStatus;
}

interface Ranking {
  readonly rank: ReadonlyMap<string, number>;
  readonly cyclic: readonly string[];
}

function byPriorityThenFilename(a: MissionRunnableNode, b: MissionRunnableNode): number {
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

function liftedLinks(
  links: readonly DependencyLink[],
  initiativeOf: ReadonlyMap<string, string>,
): DependencyLink[] {
  const lifted: DependencyLink[] = [];
  for (const link of links) {
    const dependentId = initiativeOf.get(link.dependentId);
    const dependsOnId = initiativeOf.get(link.dependsOnId);
    if (dependentId === undefined || dependsOnId === undefined) continue;
    if (dependentId === dependsOnId) continue;
    lifted.push({ dependentId, dependsOnId });
  }
  return lifted;
}

function rankInitiatives(
  ids: readonly string[],
  links: readonly DependencyLink[],
  initiativeOf: ReadonlyMap<string, string>,
): Ranking {
  const lifted = rankByLongestPath(ids, liftedLinks(links, initiativeOf));
  if (lifted.cyclic.length === 0) return lifted;
  return rankByLongestPath(ids, links);
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

function groupRows(cells: readonly ObjectiveCell[]): ObjectiveCell[][] {
  const rows: ObjectiveCell[][] = [];
  for (const cell of cells) {
    const row = rows[cell.rank];
    if (row === undefined) rows[cell.rank] = [cell];
    else row.push(cell);
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
    if (edge.kind !== "dependency") continue;
    const link = { dependentId: edge.dependent_id, dependsOnId: edge.depends_on_id };
    if (!nodeById.has(link.dependentId) || !nodeById.has(link.dependsOnId)) {
      diagnostics.push({ kind: "unresolved-dependency", link });
    } else {
      links.push(link);
    }
    if (nodeById.has(link.dependentId)) pushTo(dependsOn, link.dependentId, link.dependsOnId);
    if (nodeById.has(link.dependsOnId)) pushTo(dependents, link.dependsOnId, link.dependentId);
  }

  const children = new Map<string, MissionNodeRecord[]>();
  for (const node of nodes) {
    if (node.parent_id !== null) pushTo(children, node.parent_id, node);
  }

  const initiatives = nodes
    .filter((node): node is MissionRunnableNode => node.kind === "initiative")
    .sort(byPriorityThenFilename);
  const initiativeOf = new Map<string, string>();
  const placed = new Set<string>();
  for (const initiative of initiatives) {
    initiativeOf.set(initiative.id, initiative.id);
    placed.add(initiative.id);
    for (const child of children.get(initiative.id) ?? []) {
      if (child.kind !== "objective") continue;
      initiativeOf.set(child.id, initiative.id);
      placed.add(child.id);
      for (const task of children.get(child.id) ?? []) {
        if (task.kind === "task") placed.add(task.id);
      }
    }
  }
  for (const node of nodes) {
    if (!placed.has(node.id)) diagnostics.push({ kind: "unplaced-node", nodeId: node.id });
  }
  for (const nodeIds of findCycles(
    nodes.map((node) => node.id),
    links,
  )) {
    diagnostics.push({ kind: "cycle", nodeIds });
  }

  const initiativeRank = placeCyclic(
    rankInitiatives(
      initiatives.map((node) => node.id),
      links,
      initiativeOf,
    ),
  );

  const blocks = initiatives.map((initiative): InitiativeBlock => {
    const objectives = (children.get(initiative.id) ?? [])
      .filter((node): node is MissionRunnableNode => node.kind === "objective")
      .sort(byPriorityThenFilename);
    const objectiveRank = placeCyclic(
      rankByLongestPath(
        objectives.map((node) => node.id),
        links,
      ),
    );
    const cells = objectives
      .map((node): ObjectiveCell => ({
        node,
        rank: objectiveRank.get(node.id) ?? 0,
        tasks: (children.get(node.id) ?? [])
          .filter((child): child is MissionTaskNode => child.kind === "task")
          .sort((a, b) => a.filename.localeCompare(b.filename)),
      }))
      .sort((a, b) => a.rank - b.rank);
    return {
      node: initiative,
      rank: initiativeRank.get(initiative.id) ?? 0,
      rows: groupRows(cells),
    };
  });
  blocks.sort((a, b) => a.rank - b.rank);

  return { initiatives: blocks, nodeById, dependsOn, dependents, children, links, diagnostics };
}

export function ancestorsOf(model: GraphModel, nodeId: string): readonly MissionNodeRecord[] {
  const ancestors: MissionNodeRecord[] = [];
  const seen = new Set<string>([nodeId]);
  let parentId = model.nodeById.get(nodeId)?.parent_id ?? null;
  while (parentId !== null && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = model.nodeById.get(parentId);
    if (parent === undefined) break;
    ancestors.push(parent);
    parentId = parent.parent_id;
  }
  return ancestors;
}

function asRunnable(node: MissionNodeRecord | undefined): MissionRunnableNode | null {
  return node === undefined || node.kind === "task" ? null : node;
}

export function closureOf(model: GraphModel, nodeId: string): Closure {
  const node = model.nodeById.get(nodeId);
  const owners = node === undefined ? [] : [node, ...ancestorsOf(model, nodeId)];
  const members: ClosureMember[] = [];
  const seen = new Set<string>();
  for (const owner of owners) {
    for (const id of model.dependsOn.get(owner.id) ?? []) {
      if (seen.has(id)) continue;
      seen.add(id);
      members.push({ nodeId: id, node: asRunnable(model.nodeById.get(id)), via: owner.id });
    }
  }
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

export interface ObjectiveProgress {
  readonly terminal: number;
  readonly total: number;
}

export function objectiveProgress(model: GraphModel, initiativeId: string): ObjectiveProgress {
  const objectives = (model.children.get(initiativeId) ?? []).filter(
    (child): child is MissionRunnableNode => child.kind === "objective",
  );
  return {
    terminal: objectives.filter((objective) => isTerminal(objective.state)).length,
    total: objectives.length,
  };
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
  if (diagnostic.kind === "unplaced-node") return `${diagnostic.kind}:${diagnostic.nodeId}`;
  return `${diagnostic.kind}:${diagnostic.nodeIds.join(",")}`;
}
