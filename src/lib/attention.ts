import type {
  MissionAssessment,
  MissionBlockedContext,
  MissionNodeRecord,
  MissionProposal,
  MissionRunnableNode,
  Project,
} from "@/api/types";

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

export type AttentionDetail = BlockedDetail;

export type AttentionDetails = ReadonlyMap<string, AttentionDetail>;

interface ItemBase {
  readonly id: string;
  readonly group: AttentionGroupId;
  readonly project: Project;
  readonly missionVersion: number;
  readonly node: MissionRunnableNode;
  readonly at: number | null;
}

export interface BlockedItem extends ItemBase {
  readonly kind: "blocked";
  readonly cause: string;
}

export type AttentionItem = BlockedItem;

export interface DetailTarget {
  readonly projectId: string;
  readonly node: MissionRunnableNode;
}

const KIND_ORDER: readonly AttentionItem["kind"][] = ["blocked"];

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
    at: node.blocked_context?.outcome.created_at ?? null,
    cause: blockedCauseOf(node.blocked_context),
  };
}

function itemsOf(snapshot: ProjectSnapshot): readonly AttentionItem[] {
  return snapshot.nodes
    .filter(isRunnable)
    .filter((node) => node.state === "Blocked")
    .map((node) => blockedItemOf(snapshot, node));
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

export function deriveAttention(snapshots: readonly ProjectSnapshot[]): readonly AttentionItem[] {
  return snapshots.flatMap(itemsOf).sort(compareItems);
}

export function detailTargetsOf(items: readonly AttentionItem[]): readonly DetailTarget[] {
  return items.map((item) => ({ projectId: item.project.id, node: item.node }));
}

export function groupItems(
  items: readonly AttentionItem[],
): readonly { readonly group: AttentionGroup; readonly items: readonly AttentionItem[] }[] {
  return ATTENTION_GROUPS.map((group) => ({
    group,
    items: items.filter((item) => item.group === group.id),
  })).filter((entry) => entry.items.length > 0);
}
