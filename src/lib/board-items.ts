import type { Project } from "@/api/types";

import type { AttentionItem, ProjectSnapshot } from "./attention";
import type { CredentialRefusedItem } from "./fix-attention";
import { inboxReasonRankOf } from "./inbox-reasons";
import { isTerminal } from "./node-state";

export interface BoardGate {
  readonly itemId: string;
  readonly need: string;
  readonly short: string;
}

export function itemNodeIdsOf(item: AttentionItem): readonly string[] {
  if (item.kind === "tool_approval") return [];
  if (item.kind === "inbox_item") return item.inbox.linked_node_ids;
  if (item.group === "fixes") return item.nodeIds;
  return [item.node.id];
}

function dependentsOf(snapshot: ProjectSnapshot, seeds: readonly string[]): readonly string[] {
  const reached = new Set(seeds);
  const queue = [...seeds];
  for (const id of queue) {
    const dependents = snapshot.nodes.filter(
      (node) => !reached.has(node.id) && !isTerminal(node.state) && node.depends_on.includes(id),
    );
    for (const node of dependents) {
      reached.add(node.id);
      queue.push(node.id);
    }
  }
  return queue.slice(seeds.length);
}

function ownNodeIdsOf(
  item: AttentionItem,
  snapshots: readonly ProjectSnapshot[],
): readonly string[] {
  const own = itemNodeIdsOf(item);
  if (item.kind !== "inbox_item") return own;
  const terminal = new Set(
    snapshots.flatMap((snapshot) =>
      snapshot.nodes.filter((node) => isTerminal(node.state)).map((node) => node.id),
    ),
  );
  return own.filter((id) => !terminal.has(id));
}

export function heldNodeIdsOf(
  item: AttentionItem,
  snapshots: readonly ProjectSnapshot[],
): readonly string[] {
  if (item.kind === "finding_review" || item.kind === "followup_proposal") return [];
  const own = ownNodeIdsOf(item, snapshots);
  const dependents = snapshots.flatMap((snapshot) =>
    dependentsOf(
      snapshot,
      snapshot.nodes.map((node) => node.id).filter((id) => own.includes(id)),
    ),
  );
  return [...new Set([...own, ...dependents])];
}

export function pausedNodeCountOf(
  item: CredentialRefusedItem,
  snapshots: readonly ProjectSnapshot[],
): number {
  return snapshots
    .flatMap((snapshot) => snapshot.nodes)
    .filter((node) => node.state === "Paused" && item.nodeIds.includes(node.id)).length;
}

export function boardProjectsOf(item: AttentionItem): readonly Project[] {
  if (item.kind === "tool_approval") return [];
  if (item.group === "fixes") return item.projects;
  return [item.project];
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

export function compareAt(left: number | null, right: number | null): number {
  if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
  return left - right;
}

export function rankBoardItems(
  items: readonly AttentionItem[],
  held: ReadonlyMap<string, readonly string[]>,
  gates: ReadonlyMap<string, BoardGate>,
): readonly AttentionItem[] {
  const heldCountOf = (item: AttentionItem) => held.get(item.id)?.length ?? 0;
  return [...items].sort((left, right) => {
    const inbox = Number(left.kind === "inbox_item") - Number(right.kind === "inbox_item");
    if (inbox !== 0) return inbox;
    if (left.kind === "inbox_item" && right.kind === "inbox_item") {
      return (
        inboxReasonRankOf(left.inbox.reason) - inboxReasonRankOf(right.inbox.reason) ||
        heldCountOf(right) - heldCountOf(left) ||
        compareAt(left.at, right.at) ||
        left.id.localeCompare(right.id)
      );
    }
    return (
      Number(gates.has(left.id)) - Number(gates.has(right.id)) ||
      heldCountOf(right) - heldCountOf(left) ||
      compareAt(left.at, right.at) ||
      left.subject.localeCompare(right.subject) ||
      left.id.localeCompare(right.id)
    );
  });
}
