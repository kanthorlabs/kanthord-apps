import type {
  MissionAssessment,
  MissionBlockedContext,
  MissionExternalAction,
  MissionNodeRecord,
  MissionProposal,
  MissionRunnableNode,
  Project,
  SchedulerExecutionRecord,
} from "@/api/types";

import { PAUSE_CAUSE_LABELS, pauseCauseOf, type PauseDerivation } from "./execution-stop";
import { hasOpenAttempt } from "./external-requests";

export type AttentionGroupId = "decisions";

export interface AttentionGroup {
  readonly id: AttentionGroupId;
  readonly heading: string;
  readonly description: string;
  readonly noun: string;
  readonly plural: string;
}

export const ATTENTION_GROUPS: readonly AttentionGroup[] = [
  {
    id: "decisions",
    heading: "Decisions",
    description: "The work of a node stops until a human rules.",
    noun: "decision",
    plural: "decisions",
  },
];

export interface ProjectSnapshot {
  readonly project: Project;
  readonly missionVersion: number;
  readonly nodes: readonly MissionNodeRecord[];
}

export type DetailRead<T> =
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "failed"; readonly message: string };

export interface BlockedDetail {
  readonly kind: "blocked";
  readonly key: string;
  readonly assessment: DetailRead<MissionAssessment | null>;
  readonly proposals: DetailRead<readonly MissionProposal[]>;
}

export interface PausedDetail {
  readonly kind: "paused";
  readonly key: string;
  readonly executions: DetailRead<readonly SchedulerExecutionRecord[]>;
  readonly actions: DetailRead<readonly MissionExternalAction[]>;
}

export interface OpenDetail {
  readonly kind: "open";
  readonly key: string;
  readonly actions: DetailRead<readonly MissionExternalAction[]>;
}

export type AttentionDetail = BlockedDetail | PausedDetail | OpenDetail;

export type AttentionDetails = ReadonlyMap<string, AttentionDetail>;

interface ItemBase {
  readonly id: string;
  readonly group: AttentionGroupId;
  readonly project: Project;
  readonly missionVersion: number;
  readonly node: MissionRunnableNode;
  readonly nodes: readonly MissionNodeRecord[];
  readonly at: number | null;
}

export interface BlockedItem extends ItemBase {
  readonly kind: "blocked";
  readonly cause: string;
}

export interface PausedItem extends ItemBase {
  readonly kind: "paused";
  readonly pause: PauseDerivation | null;
  readonly cause: string | null;
}

export interface DiscardedDependency {
  readonly id: string;
  readonly name: string;
}

export interface DependencyItem extends ItemBase {
  readonly kind: "dependency_discarded";
  readonly cause: string;
  readonly discarded: readonly DiscardedDependency[];
}

export type AttentionItem = BlockedItem | PausedItem | DependencyItem;

export interface DetailTarget {
  readonly kind: "blocked" | "paused" | "open";
  readonly projectId: string;
  readonly node: MissionRunnableNode;
}

const KIND_ORDER: readonly AttentionItem["kind"][] = ["blocked", "paused", "dependency_discarded"];

function isRunnable(node: MissionNodeRecord): node is MissionRunnableNode {
  return node.kind !== "task" && node.retired_at === null;
}

export function detailKeyOf(node: MissionRunnableNode): string {
  return `${node.id}:${node.attempt}:${node.state}:${node.visible_revision}`;
}

export function detailOf(
  details: AttentionDetails,
  node: MissionRunnableNode,
): AttentionDetail | null {
  const detail = details.get(node.id);
  return detail !== undefined && detail.key === detailKeyOf(node) ? detail : null;
}

export function openProposalsOf(
  node: MissionRunnableNode,
  proposals: readonly MissionProposal[],
): readonly MissionProposal[] {
  return proposals.filter(
    (proposal) => proposal.approved_at === null && proposal.attempt === node.attempt,
  );
}

export function blockedCauseOf(context: MissionBlockedContext | undefined): string {
  if (context === undefined) return "Blocked";
  const { closing_event: event, result } = context.outcome;
  if (event === "external-failed") return "External action failed";
  if (event === "human-block") return "Blocked by a human";
  if (event === "assessment-not-passed") {
    if (result === "criterion-not-met") return "Criterion not met";
    if (result === "undetermined") return "Undetermined";
  }
  return "Blocked";
}

function blockedItemOf(snapshot: ProjectSnapshot, node: MissionRunnableNode): BlockedItem {
  return {
    id: `blocked:${node.id}`,
    kind: "blocked",
    group: "decisions",
    project: snapshot.project,
    missionVersion: snapshot.missionVersion,
    node,
    nodes: snapshot.nodes,
    at: node.blocked_context?.outcome.created_at ?? null,
    cause: blockedCauseOf(node.blocked_context),
  };
}

function pausedItemOf(
  snapshot: ProjectSnapshot,
  node: MissionRunnableNode,
  details: AttentionDetails,
): PausedItem {
  const detail = detailOf(details, node);
  const executions = detail?.kind === "paused" ? detail.executions : null;
  const pause = executions?.status === "ready" ? pauseCauseOf(executions.data) : null;
  return {
    id: `paused:${node.id}`,
    kind: "paused",
    group: "decisions",
    project: snapshot.project,
    missionVersion: snapshot.missionVersion,
    node,
    nodes: snapshot.nodes,
    at: pause?.endedAt ?? null,
    pause,
    cause: pause === null ? null : PAUSE_CAUSE_LABELS[pause.cause],
  };
}

function discardedDependenciesOf(
  snapshot: ProjectSnapshot,
  node: MissionRunnableNode,
): readonly DiscardedDependency[] {
  return node.depends_on.flatMap((id) => {
    const target = snapshot.nodes.find((candidate) => candidate.id === id);
    return target !== undefined && target.kind !== "task" && target.state === "Discarded"
      ? [{ id, name: target.content.name }]
      : [];
  });
}

function isDependencyItem(snapshot: ProjectSnapshot, node: MissionRunnableNode): boolean {
  return node.state === "Pending" && discardedDependenciesOf(snapshot, node).length > 0;
}

function itemsOf(snapshot: ProjectSnapshot, details: AttentionDetails): readonly AttentionItem[] {
  return snapshot.nodes.filter(isRunnable).flatMap((node): readonly AttentionItem[] => {
    if (node.state === "Blocked") return [blockedItemOf(snapshot, node)];
    if (node.state === "Paused") return [pausedItemOf(snapshot, node, details)];
    if (node.state !== "Pending") return [];
    const discarded = discardedDependenciesOf(snapshot, node);
    if (discarded.length === 0) return [];
    return [
      {
        id: `dependency_discarded:${node.id}`,
        kind: "dependency_discarded",
        group: "decisions",
        project: snapshot.project,
        missionVersion: snapshot.missionVersion,
        node,
        nodes: snapshot.nodes,
        at: null,
        cause: "Discarded dependency",
        discarded,
      },
    ];
  });
}

function compareAt(left: number | null, right: number | null): number {
  if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
  return left - right;
}

function compareItems(left: AttentionItem, right: AttentionItem): number {
  return (
    KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind) ||
    compareAt(left.at, right.at) ||
    left.node.content.name.localeCompare(right.node.content.name) ||
    left.id.localeCompare(right.id)
  );
}

export function deriveAttention(
  snapshots: readonly ProjectSnapshot[],
  details: AttentionDetails,
): readonly AttentionItem[] {
  return snapshots.flatMap((snapshot) => itemsOf(snapshot, details)).sort(compareItems);
}

export function detailTargetsOf(snapshots: readonly ProjectSnapshot[]): readonly DetailTarget[] {
  return snapshots.flatMap((snapshot) =>
    snapshot.nodes.filter(isRunnable).flatMap((node): readonly DetailTarget[] => {
      if (node.state === "Blocked")
        return [{ kind: "blocked", projectId: snapshot.project.id, node }];
      if (node.state === "Paused")
        return [{ kind: "paused", projectId: snapshot.project.id, node }];
      if (isDependencyItem(snapshot, node) && hasOpenAttempt(node))
        return [{ kind: "open", projectId: snapshot.project.id, node }];
      return [];
    }),
  );
}

export function groupItems(
  items: readonly AttentionItem[],
): readonly { readonly group: AttentionGroup; readonly items: readonly AttentionItem[] }[] {
  return ATTENTION_GROUPS.map((group) => ({
    group,
    items: items.filter((item) => item.group === group.id),
  })).filter((entry) => entry.items.length > 0);
}
