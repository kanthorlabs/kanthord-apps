import type {
  EnvironmentState,
  MissionAssessment,
  MissionFinding,
  MissionProposal,
} from "@/api/types";

import {
  type AttentionDetails,
  type AttentionItem,
  type BlockedDetail,
  detailOf,
  type FollowupDetail,
} from "./attention";
import type { DiscardReason, EvidenceLine } from "./board-evidence";
import type { BoardGate } from "./board-items";
import { proposalSourceOf, type Suggestion, suggestionOf } from "./board-suggestion";
import { heldText } from "./board-text";
import { counted } from "./counted";
import { spreadTextOf } from "./fix-attention";
import { type FindingGroup, findingGroupsOf, HUMAN_FINDING_GROUP } from "./review-findings";

const COMPACT_EVIDENCE_LINES = 3;

const BLOCKER_FIRST: readonly MissionFinding["kind"][] = ["blocker", "suggestion"];

export interface EnvironmentFailureLine {
  readonly command: string;
  readonly ended: string;
  readonly reproduce: string;
}

export interface EvidenceWindow {
  readonly shown: readonly EvidenceLine[];
  readonly hidden: number;
}

export function environmentFailureOf(
  item: AttentionItem,
  environments: readonly EnvironmentState[] | null,
): EnvironmentFailureLine | null {
  if (item.kind !== "environment_failed") return null;
  const failure = environments?.find((state) => state.binding_id === item.bindingId)?.failure;
  if (failure === null || failure === undefined) return null;
  return {
    command: failure.command,
    ended: failure.exit_code === null ? " did not finish." : ` exited with ${failure.exit_code}.`,
    reproduce: failure.reproduce,
  };
}

export function discardReasonTextOf(
  reasons: readonly DiscardReason[],
  dependencyId: string,
): string {
  const reason = reasons.find((candidate) => candidate.id === dependencyId)?.reason;
  return reason === null || reason === undefined ? "No reason is recorded." : `Reason: "${reason}"`;
}

export function evidenceWindowOf(
  lines: readonly EvidenceLine[],
  collapsible: boolean,
  expanded: boolean,
): EvidenceWindow {
  const hidden = collapsible && !expanded ? lines.length - COMPACT_EVIDENCE_LINES : 0;
  return { shown: hidden > 0 ? lines.slice(0, COMPACT_EVIDENCE_LINES) : lines, hidden };
}

export function evidenceSettledOf(
  item: AttentionItem,
  read: { readonly status: string } | null,
): boolean {
  return item.kind !== "blocked" || read?.status === "ready";
}

export function failureLimitOf(item: AttentionItem): boolean {
  return item.kind === "paused" && item.pause?.cause === "failure-limit";
}

export function impactHeldTextOf(count: number): string {
  return count === 0 ? "No node waits on this card." : `${heldText(count)} in total.`;
}

export function noCauseTextOf(item: AttentionItem): string {
  const undetermined =
    item.kind === "blocked" && item.node.blocked_context?.outcome.result === "undetermined";
  return undetermined
    ? "No cause assigned: the assessment was undetermined."
    : "No cause: this is a wait, not a fault.";
}

export function spreadOf(item: AttentionItem): string | null {
  return item.group === "fixes" ? spreadTextOf(item) : null;
}

export function blockedDetailOf(
  item: AttentionItem,
  details: AttentionDetails,
): BlockedDetail | null {
  const detail = item.kind === "blocked" ? detailOf(details, item.node) : null;
  return detail?.kind === "blocked" ? detail : null;
}

export function followupDetailOf(
  item: AttentionItem,
  details: AttentionDetails,
): FollowupDetail | null {
  const detail = item.kind === "followup_proposal" ? detailOf(details, item.node) : null;
  return detail?.kind === "followup" ? detail : null;
}

export function proposedNameOf(detail: FollowupDetail | null, revision: number): string | null {
  if (detail?.revisions.status !== "ready") return null;
  return detail.revisions.data.find((read) => read.revision === revision)?.content.name ?? null;
}

export function showProposalsOf(
  item: AttentionItem,
  proposals: readonly MissionProposal[],
  detail: BlockedDetail | null,
): boolean {
  const read = detail?.proposals ?? null;
  return item.kind === "blocked" && (proposals.length > 0 || read?.status === "failed");
}

export function boardSuggestionOf(
  item: AttentionItem,
  gate: BoardGate | null,
  proposals: readonly MissionProposal[],
  detail: BlockedDetail | null,
): Suggestion {
  const assessment: MissionAssessment | null =
    detail?.assessment.status === "ready" ? detail.assessment.data : null;
  return suggestionOf(item, gate, proposalSourceOf(proposals, assessment));
}

function compareFindings(left: MissionFinding, right: MissionFinding): number {
  return (
    BLOCKER_FIRST.indexOf(left.kind) - BLOCKER_FIRST.indexOf(right.kind) ||
    Number(left.label.slice(1)) - Number(right.label.slice(1)) ||
    left.id.localeCompare(right.id)
  );
}

function boardGroupTitleOf(group: FindingGroup): string {
  const [first] = group.findings;
  if (first === undefined || first.source === "human" || first.round === null) {
    return HUMAN_FINDING_GROUP;
  }
  return `Round ${first.round}`;
}

export function boardFindingGroupsOf(findings: readonly MissionFinding[]): readonly FindingGroup[] {
  const attempts = [...new Set(findings.map((finding) => finding.attempt))].sort(
    (left, right) => left - right,
  );
  return attempts.flatMap((attempt) =>
    findingGroupsOf(
      findings.filter((finding) => finding.attempt === attempt).sort(compareFindings),
    ).map((group) => ({
      ...group,
      key: `${attempt}:${group.key}`,
      title: `Attempt ${attempt} · ${boardGroupTitleOf(group)}`,
    })),
  );
}

export function findingWhatTextOf(findings: readonly MissionFinding[]): string {
  const waits = counted(findings.length, "finding waits", "findings wait");
  return `${waits} for your decision. KanthorD fixes none of them. Accept or dismiss each finding.`;
}
