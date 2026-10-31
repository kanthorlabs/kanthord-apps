import type { Project } from "@/api/types";

import type { AttentionItem, ProjectSnapshot } from "./attention";
import type { CredentialRefusedItem } from "./fix-attention";
import { isTerminal } from "./node-state";

export interface BoardGate {
  readonly itemId: string;
  readonly need: string;
  readonly short: string;
}

export function itemNodeIdsOf(item: AttentionItem): readonly string[] {
  if (item.kind === "tool_approval") return [];
  if (item.group === "fixes") return item.nodeIds;
  return [item.node.id];
}

function dependentsOf(snapshot: ProjectSnapshot, seeds: readonly string[]): readonly string[] {
  const reached = new Set(seeds);
  const queue = [...seeds];
  for (const id of queue) {
    for (const node of snapshot.nodes) {
      if (reached.has(node.id) || isTerminal(node.state) || !node.depends_on.includes(id)) continue;
      reached.add(node.id);
      queue.push(node.id);
    }
  }
  return queue.slice(seeds.length);
}

export function heldNodeIdsOf(
  item: AttentionItem,
  snapshots: readonly ProjectSnapshot[],
): readonly string[] {
  const own = itemNodeIdsOf(item);
  const dependents = snapshots.flatMap((snapshot) =>
    dependentsOf(
      snapshot,
      snapshot.nodes.map((node) => node.id).filter((id) => own.includes(id)),
    ),
  );
  return [...new Set([...own, ...dependents])];
}

export function boardProjectsOf(item: AttentionItem): readonly Project[] {
  if (item.kind === "tool_approval") return [];
  if (item.group === "fixes") return item.projects;
  return [item.project];
}

export function isInProject(item: AttentionItem, projectId: string): boolean {
  if (item.kind === "tool_approval") return true;
  return boardProjectsOf(item).some((project) => project.id === projectId);
}

function isCredentialRefused(item: AttentionItem): item is CredentialRefusedItem {
  return item.kind === "credential_refused";
}

export function gateOf(item: AttentionItem, items: readonly AttentionItem[]): BoardGate | null {
  if (item.kind !== "paused") return null;
  const execution = item.pause?.execution ?? null;
  const stop = execution?.stop ?? null;
  if (execution === null || stop?.reason !== "provider_failed" || stop.code !== "unauthorized") {
    return null;
  }
  const credentials = execution.agent_selections.map((selection) => selection.credential);
  const refused = items
    .filter(isCredentialRefused)
    .find((candidate) => credentials.includes(candidate.credential));
  if (refused === undefined) return null;
  return {
    itemId: refused.id,
    need: `Rotate ${refused.credential} in Fix setup`,
    short: `Rotate ${refused.credential}`,
  };
}

function compareAt(left: number | null, right: number | null): number {
  if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
  return left - right;
}

export function rankBoardItems(
  items: readonly AttentionItem[],
  held: ReadonlyMap<string, readonly string[]>,
  gates: ReadonlyMap<string, BoardGate>,
): readonly AttentionItem[] {
  const heldCountOf = (item: AttentionItem) => held.get(item.id)?.length ?? 0;
  return [...items].sort(
    (left, right) =>
      Number(gates.has(left.id)) - Number(gates.has(right.id)) ||
      heldCountOf(right) - heldCountOf(left) ||
      compareAt(left.at, right.at) ||
      left.subject.localeCompare(right.subject) ||
      left.id.localeCompare(right.id),
  );
}

export function startItemOf(ranked: readonly AttentionItem[]): AttentionItem | null {
  return ranked[0] ?? null;
}
