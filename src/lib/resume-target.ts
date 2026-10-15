import type { MissionExternalAction, MissionNodeRecord, MissionRunnableNode } from "@/api/types";

import type { PauseCause } from "./execution-stop";
import { unresolvedRequestsOf } from "./external-requests";
import { isTerminal } from "./node-state";

export type ResumeTarget = "Available" | "Waiting";

export interface ResumeContext {
  readonly node: MissionRunnableNode;
  readonly nodes: readonly MissionNodeRecord[];
  readonly actions: readonly MissionExternalAction[];
  readonly cause: PauseCause | null;
}

export type WaitingNeed =
  | { readonly kind: "objectives" }
  | { readonly kind: "requests" }
  | { readonly kind: "dependency"; readonly name: string };

export type ResumeEnd =
  | { readonly kind: "external-failed" }
  | { readonly kind: "external-success" }
  | { readonly kind: "external-requested"; readonly open: boolean }
  | { readonly kind: "available" }
  | { readonly kind: "pending"; readonly dependency: string }
  | { readonly kind: "waiting" };

export type ResumeNote = "failure-count" | "stall-count" | "stall-count-waiting-offered";

function byId(nodes: readonly MissionNodeRecord[]): ReadonlyMap<string, MissionNodeRecord> {
  return new Map(nodes.map((node) => [node.id, node]));
}

function ownersOf(
  node: MissionRunnableNode,
  nodes: ReadonlyMap<string, MissionNodeRecord>,
): readonly MissionRunnableNode[] {
  const owners: MissionRunnableNode[] = [node];
  const seen = new Set<string>([node.id]);
  let parentId = node.parent_id;
  while (parentId !== null && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = nodes.get(parentId);
    if (parent === undefined || parent.kind === "task") break;
    owners.push(parent);
    parentId = parent.parent_id;
  }
  return owners;
}

function unsatisfiedDependencyOf(
  node: MissionRunnableNode,
  nodes: readonly MissionNodeRecord[],
): string | null {
  const known = byId(nodes);
  for (const owner of ownersOf(node, known)) {
    for (const id of owner.depends_on) {
      const target = known.get(id);
      if (target === undefined) return id;
      if (target.kind === "task" || target.state !== "Completed") return target.content.name;
    }
  }
  return null;
}

function objectivesTerminal(
  node: MissionRunnableNode,
  nodes: readonly MissionNodeRecord[],
): boolean {
  if (node.kind !== "initiative") return true;
  return nodes
    .filter(
      (child) =>
        child.parent_id === node.id && child.kind === "objective" && child.retired_at === null,
    )
    .every((child) => child.kind !== "task" && isTerminal(child.state));
}

export function waitingNeedsOf(context: ResumeContext): readonly WaitingNeed[] {
  const needs: WaitingNeed[] = [];
  if (!objectivesTerminal(context.node, context.nodes)) needs.push({ kind: "objectives" });
  if (unresolvedRequestsOf(context.actions).length > 0) needs.push({ kind: "requests" });
  const dependency = unsatisfiedDependencyOf(context.node, context.nodes);
  if (dependency !== null) needs.push({ kind: "dependency", name: dependency });
  return needs;
}

export function defaultTargetOf(context: ResumeContext): ResumeTarget {
  return context.cause === "further-work-limit" && waitingNeedsOf(context).length === 0
    ? "Waiting"
    : "Available";
}

export function resumeEndOf(context: ResumeContext, target: ResumeTarget): ResumeEnd {
  const { actions } = context;
  if (actions.some((action) => action.resolution === "other-end")) {
    return { kind: "external-failed" };
  }
  if (actions.some((action) => action.requested)) {
    return actions.every((action) => action.resolution === "expected-end")
      ? { kind: "external-success" }
      : { kind: "external-requested", open: unresolvedRequestsOf(actions).length > 0 };
  }
  if (target === "Waiting") return { kind: "waiting" };
  const dependency = unsatisfiedDependencyOf(context.node, context.nodes);
  return dependency === null ? { kind: "available" } : { kind: "pending", dependency };
}

export function choosesTarget(end: ResumeEnd): boolean {
  return end.kind === "available" || end.kind === "pending" || end.kind === "waiting";
}

export function resumeNotesOf(context: ResumeContext, target: ResumeTarget): readonly ResumeNote[] {
  if (!choosesTarget(resumeEndOf(context, target))) return [];
  if (context.cause === "failure-limit") return ["failure-count"];
  if (context.cause === "further-work-limit" && target === "Available") {
    return [waitingNeedsOf(context).length === 0 ? "stall-count-waiting-offered" : "stall-count"];
  }
  return [];
}
