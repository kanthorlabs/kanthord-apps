import type {
  BindingAgentView,
  Credential,
  EnvironmentState,
  MissionAssessment,
  MissionBlockedContext,
  MissionEvidence,
  MissionExternalAction,
  MissionNodeRecord,
  MissionProposal,
  Project,
  SchedulerExecutionRecord,
  SchedulerJob,
  WorkbenchSessionListItem,
  WorkerBindingRecord,
  WorkerCatalogItem,
  WorkerRegistrationRecord,
} from "@/api/types";

import { approvalItemsOf, type ToolApprovalItem } from "./approval-attention";
import { PAUSE_CAUSE_LABELS, pauseCauseOf, type PauseDerivation } from "./execution-stop";
import { deliveryRequestsOf, hasOpenAttempt, humanMergeRequestOf } from "./external-requests";
import { type FixAttentionItem, fixItemsOf } from "./fix-attention";

export type AttentionGroupId = "decisions" | "fixes" | "outside";

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
  {
    id: "fixes",
    heading: "Fixes",
    description: "The workforce cannot progress until a human changes the setup.",
    noun: "fix",
    plural: "fixes",
  },
  {
    id: "outside",
    heading: "Waiting outside kanthord",
    description: "The node waits for an act on an external platform.",
    noun: "waiting outside",
    plural: "waiting outside",
  },
];

export interface WorkerBindingView {
  readonly binding: WorkerBindingRecord;
  readonly agents: readonly BindingAgentView[] | null;
}

export interface ProjectSnapshot {
  readonly project: Project;
  readonly missionVersion: number;
  readonly nodes: readonly MissionNodeRecord[];
  readonly jobs: readonly SchedulerJob[] | null;
  readonly registrations: readonly WorkerRegistrationRecord[] | null;
  readonly executions: readonly SchedulerExecutionRecord[] | null;
  readonly bindings: readonly WorkerBindingView[] | null;
  readonly environments: readonly EnvironmentState[] | null;
}

export interface AttentionContext {
  readonly now: number;
  readonly catalog: readonly WorkerCatalogItem[] | null;
  readonly credentials: readonly Credential[] | null;
  readonly sessions: readonly WorkbenchSessionListItem[] | null;
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

export interface ExternalDetail {
  readonly kind: "external";
  readonly key: string;
  readonly actions: DetailRead<readonly MissionExternalAction[]>;
  readonly evidence: DetailRead<readonly MissionEvidence[]>;
  readonly refreshFault: string | null;
}

export type AttentionDetail = BlockedDetail | PausedDetail | OpenDetail | ExternalDetail;

export type AttentionDetails = ReadonlyMap<string, AttentionDetail>;

export interface ItemBase {
  readonly id: string;
  readonly group: AttentionGroupId;
  readonly project: Project;
  readonly subject: string;
  readonly at: number | null;
}

interface NodeItemBase extends ItemBase {
  readonly missionVersion: number;
  readonly node: MissionNodeRecord;
  readonly nodes: readonly MissionNodeRecord[];
}

export interface BlockedItem extends NodeItemBase {
  readonly group: "decisions";
  readonly kind: "blocked";
  readonly cause: string;
}

export interface PausedItem extends NodeItemBase {
  readonly group: "decisions";
  readonly kind: "paused";
  readonly pause: PauseDerivation | null;
  readonly cause: string | null;
}

export interface DiscardedDependency {
  readonly id: string;
  readonly name: string;
}

export interface DependencyItem extends NodeItemBase {
  readonly group: "decisions";
  readonly kind: "dependency_discarded";
  readonly cause: string;
  readonly discarded: readonly DiscardedDependency[];
}

export interface OutsideRequest {
  readonly action: MissionExternalAction;
  readonly evidence: MissionEvidence | null;
}

export interface MergeWaitItem extends NodeItemBase {
  readonly group: "outside";
  readonly kind: "merge_wait";
  readonly cause: string;
  readonly request: OutsideRequest;
}

export interface DeliveryItem extends NodeItemBase {
  readonly group: "outside";
  readonly kind: "delivery_unconfirmed";
  readonly cause: string;
  readonly request: OutsideRequest;
}

export type DecisionAttentionItem = BlockedItem | PausedItem | DependencyItem;

export type OutsideAttentionItem = MergeWaitItem | DeliveryItem;

export type AttentionItem =
  DecisionAttentionItem | ToolApprovalItem | FixAttentionItem | OutsideAttentionItem;

export interface DetailTarget {
  readonly kind: "blocked" | "paused" | "open" | "external";
  readonly projectId: string;
  readonly node: MissionNodeRecord;
}

const DELIVERY_GRACE_MS = 10 * 60_000;

const KIND_ORDER: readonly AttentionItem["kind"][] = [
  "blocked",
  "paused",
  "dependency_discarded",
  "tool_approval",
  "project_paused",
  "no_taker",
  "agent_invalid",
  "credential_refused",
  "request_rejected",
  "merge_wait",
  "delivery_unconfirmed",
];

function isRunnable(node: MissionNodeRecord): boolean {
  return node.retired_at === null;
}

export function detailKeyOf(node: MissionNodeRecord): string {
  return `${node.id}:${node.attempt}:${node.state}:${node.visible_revision}`;
}

function keptReadOf<T>(previous: DetailRead<T>, next: DetailRead<T>): DetailRead<T> {
  return next.status === "failed" && previous.status === "ready" ? previous : next;
}

export function refreshedDetailOf(
  previous: AttentionDetail | undefined,
  next: AttentionDetail,
): AttentionDetail {
  if (previous?.kind !== "external" || next.kind !== "external" || previous.key !== next.key) {
    return next;
  }
  const failed = [next.actions, next.evidence].find((read) => read.status === "failed");
  return {
    ...next,
    actions: keptReadOf(previous.actions, next.actions),
    evidence: keptReadOf(previous.evidence, next.evidence),
    refreshFault: failed?.status === "failed" ? failed.message : null,
  };
}

export function detailOf(
  details: AttentionDetails,
  node: MissionNodeRecord,
): AttentionDetail | null {
  const detail = details.get(node.id);
  return detail !== undefined && detail.key === detailKeyOf(node) ? detail : null;
}

export function openProposalsOf(
  node: MissionNodeRecord,
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

function blockedItemOf(snapshot: ProjectSnapshot, node: MissionNodeRecord): BlockedItem {
  return {
    id: `blocked:${node.id}`,
    kind: "blocked",
    group: "decisions",
    project: snapshot.project,
    subject: node.content.name,
    missionVersion: snapshot.missionVersion,
    node,
    nodes: snapshot.nodes,
    at: node.blocked_context?.outcome.created_at ?? null,
    cause: blockedCauseOf(node.blocked_context),
  };
}

function pausedItemOf(
  snapshot: ProjectSnapshot,
  node: MissionNodeRecord,
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
    subject: node.content.name,
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
  node: MissionNodeRecord,
): readonly DiscardedDependency[] {
  return node.depends_on.flatMap((id) => {
    const target = snapshot.nodes.find((candidate) => candidate.id === id);
    return target !== undefined && target.state === "Discarded"
      ? [{ id, name: target.content.name }]
      : [];
  });
}

function isDependencyItem(snapshot: ProjectSnapshot, node: MissionNodeRecord): boolean {
  return node.state === "Pending" && discardedDependenciesOf(snapshot, node).length > 0;
}

function evidenceOf(detail: ExternalDetail, action: MissionExternalAction): MissionEvidence | null {
  if (detail.evidence.status !== "ready") return null;
  return detail.evidence.data.find((item) => item.id === action.request_evidence_id) ?? null;
}

interface AgedDelivery {
  readonly action: MissionExternalAction;
  readonly evidence: MissionEvidence;
}

function agedDeliveryOf(
  detail: ExternalDetail,
  actions: readonly MissionExternalAction[],
  now: number,
): AgedDelivery | null {
  let oldest: AgedDelivery | null = null;
  for (const action of deliveryRequestsOf(actions)) {
    const evidence = evidenceOf(detail, action);
    if (evidence === null || now - evidence.created_at <= DELIVERY_GRACE_MS) continue;
    if (oldest === null || evidence.created_at < oldest.evidence.created_at) {
      oldest = { action, evidence };
    }
  }
  return oldest;
}

function outsideItemOf(
  snapshot: ProjectSnapshot,
  node: MissionNodeRecord,
  details: AttentionDetails,
  now: number,
): readonly AttentionItem[] {
  const detail = detailOf(details, node);
  if (detail?.kind !== "external" || detail.actions.status !== "ready") return [];
  const base = {
    group: "outside",
    project: snapshot.project,
    subject: node.content.name,
    missionVersion: snapshot.missionVersion,
    node,
    nodes: snapshot.nodes,
  } as const;
  const merge = humanMergeRequestOf(detail.actions.data);
  if (merge !== null) {
    const evidence = evidenceOf(detail, merge);
    return [
      {
        ...base,
        id: `merge_wait:${node.id}`,
        kind: "merge_wait",
        at: evidence?.created_at ?? null,
        cause: "Waits for merge",
        request: { action: merge, evidence },
      },
    ];
  }
  const delivery = agedDeliveryOf(detail, detail.actions.data, now);
  if (delivery === null) return [];
  return [
    {
      ...base,
      id: `delivery_unconfirmed:${node.id}`,
      kind: "delivery_unconfirmed",
      at: delivery.evidence.created_at,
      cause: "Delivery not confirmed",
      request: delivery,
    },
  ];
}

function itemsOf(
  snapshot: ProjectSnapshot,
  details: AttentionDetails,
  now: number,
): readonly AttentionItem[] {
  return snapshot.nodes.filter(isRunnable).flatMap((node): readonly AttentionItem[] => {
    if (node.state === "Blocked") return [blockedItemOf(snapshot, node)];
    if (node.state === "Paused") return [pausedItemOf(snapshot, node, details)];
    if (node.state === "External.Requested") return outsideItemOf(snapshot, node, details, now);
    if (node.state !== "Pending") return [];
    const discarded = discardedDependenciesOf(snapshot, node);
    if (discarded.length === 0) return [];
    return [
      {
        id: `dependency_discarded:${node.id}`,
        kind: "dependency_discarded",
        group: "decisions",
        project: snapshot.project,
        subject: node.content.name,
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
    left.subject.localeCompare(right.subject) ||
    left.id.localeCompare(right.id)
  );
}

export function deriveAttention(
  snapshots: readonly ProjectSnapshot[],
  details: AttentionDetails,
  context: AttentionContext,
): readonly AttentionItem[] {
  return [
    ...snapshots.flatMap((snapshot) => itemsOf(snapshot, details, context.now)),
    ...approvalItemsOf(context.sessions),
    ...fixItemsOf(snapshots, context),
  ].sort(compareItems);
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
      if (node.state === "External.Requested")
        return [{ kind: "external", projectId: snapshot.project.id, node }];
      return [];
    }),
  );
}

export interface ExternalReadFailure {
  readonly target: DetailTarget;
  readonly message: string;
}

export interface ExternalReadState {
  readonly pending: number;
  readonly failures: readonly ExternalReadFailure[];
}

export function externalReadStateOf(
  targets: readonly DetailTarget[],
  details: AttentionDetails,
): ExternalReadState {
  let pending = 0;
  const failures: ExternalReadFailure[] = [];
  for (const target of targets) {
    if (target.kind !== "external") continue;
    const detail = detailOf(details, target.node);
    if (detail?.kind !== "external") {
      pending += 1;
      continue;
    }
    const failed = [detail.actions, detail.evidence].find((read) => read.status === "failed");
    const message = failed?.status === "failed" ? failed.message : detail.refreshFault;
    if (message !== null) failures.push({ target, message });
  }
  return { pending, failures };
}

export function groupItems(
  items: readonly AttentionItem[],
): readonly { readonly group: AttentionGroup; readonly items: readonly AttentionItem[] }[] {
  return ATTENTION_GROUPS.map((group) => ({
    group,
    items: items.filter((item) => item.group === group.id),
  })).filter((entry) => entry.items.length > 0);
}
