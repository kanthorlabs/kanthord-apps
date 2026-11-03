import type {
  MissionFinding,
  MissionFindingCauseOwner,
  MissionFindingKind,
  MissionFindingReport,
  MissionTaskContent,
} from "@/api/types";

import { utf8Bytes } from "./prompt-text";

export const FINDING_TEXT_MAX_BYTES = 8192;
export const NODE_TASK = "node";

export const FINDING_KINDS: readonly MissionFindingKind[] = ["blocker", "suggestion"];
export const FINDING_CAUSE_OWNERS: readonly MissionFindingCauseOwner[] = [
  "plan",
  "agent",
  "reviewer",
  "gate",
  "engine",
  "apps",
  "load",
  "human",
];

export interface FindingDraft {
  readonly assessment_id: string;
  readonly kind: string;
  readonly task: string;
  readonly name: string;
  readonly description: string;
  readonly fix: string;
  readonly why: string;
  readonly cause_owner: string;
}

export type FindingDraftField = keyof FindingDraft;
export type FindingDraftErrors = Partial<Record<FindingDraftField, string>>;

const TEXT_FIELDS = ["name", "description", "fix", "why"] as const;

export function emptyFindingDraft(assessmentId: string): FindingDraft {
  return {
    assessment_id: assessmentId,
    kind: "blocker",
    task: NODE_TASK,
    name: "",
    description: "",
    fix: "",
    why: "",
    cause_owner: "",
  };
}

export function draftOfFinding(finding: MissionFinding): FindingDraft {
  return {
    assessment_id: finding.assessment_id,
    kind: finding.kind,
    task: finding.task_id ?? NODE_TASK,
    name: finding.name,
    description: finding.description,
    fix: finding.fix,
    why: finding.why,
    cause_owner: finding.cause_owner ?? "",
  };
}

function isKind(value: string): value is MissionFindingKind {
  return (FINDING_KINDS as readonly string[]).includes(value);
}

function isCauseOwner(value: string): value is MissionFindingCauseOwner {
  return (FINDING_CAUSE_OWNERS as readonly string[]).includes(value);
}

function textError(text: string): string | undefined {
  if (text.trim().length === 0) return "Write the text.";
  if (utf8Bytes(text) > FINDING_TEXT_MAX_BYTES)
    return `The text holds more than ${FINDING_TEXT_MAX_BYTES} bytes.`;
  return undefined;
}

export function findingDraftErrors(
  draft: FindingDraft,
  taskIds: readonly string[],
): FindingDraftErrors {
  const errors: FindingDraftErrors = {};
  if (draft.assessment_id === "") errors.assessment_id = "Choose the assessment that missed it.";
  if (!isKind(draft.kind)) errors.kind = "Choose the kind.";
  if (draft.task !== NODE_TASK && !taskIds.includes(draft.task))
    errors.task = "Choose a task of the revision of that assessment, or the node.";
  for (const field of TEXT_FIELDS) {
    const error = textError(draft[field]);
    if (error !== undefined) errors[field] = error;
  }
  if (!isCauseOwner(draft.cause_owner)) errors.cause_owner = "Choose the owner of the cause.";
  return errors;
}

export function findingReportOf(draft: FindingDraft): MissionFindingReport | null {
  if (!isKind(draft.kind) || !isCauseOwner(draft.cause_owner)) return null;
  return {
    kind: draft.kind,
    task_id: draft.task === NODE_TASK ? null : draft.task,
    name: draft.name,
    description: draft.description,
    fix: draft.fix,
    why: draft.why,
    cause_owner: draft.cause_owner,
  };
}

export function taskChoiceText(task: string, tasks: readonly MissionTaskContent[]): string {
  if (task === NODE_TASK) return "The node";
  return tasks.find((item) => item.id === task)?.content.name ?? task;
}
