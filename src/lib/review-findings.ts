import type {
  MissionAssessment,
  MissionFinding,
  MissionFindingDecision,
  MissionFindingRoute,
  MissionTaskContent,
} from "@/api/types";

import { utcDateTime } from "./format";
import { actorText } from "./mission-labels";

export interface FindingGroup {
  readonly key: string;
  readonly title: string;
  readonly findings: readonly MissionFinding[];
}

export const HUMAN_FINDING_GROUP = "Found after delivery";

const ROUTE_TEXT: Readonly<Record<MissionFindingRoute, string>> = {
  fix: "KanthorD fixes",
  report: "Report only",
  record: "Record",
};

const DECISION_VERB: Readonly<Record<MissionFindingDecision, string>> = {
  accepted: "Accepted",
  dismissed: "Dismissed",
};

const DECISION_MEANING: Readonly<Record<MissionFindingDecision, string>> = {
  accepted:
    "Accept states that the finding is a defect and that you own its fix outside KanthorD. KanthorD creates no node for it.",
  dismissed: "Dismiss states that the finding is no defect.",
};

function isReportOnlyRound(findings: readonly MissionFinding[]): boolean {
  const actionItems = findings.filter((finding) => finding.action === "yes");
  return actionItems.length > 0 && actionItems.every((finding) => finding.route === "report");
}

export function findingGroupsOf(findings: readonly MissionFinding[]): readonly FindingGroup[] {
  const rounds = new Map<number, MissionFinding[]>();
  const human: MissionFinding[] = [];
  for (const finding of findings) {
    if (finding.source === "human" || finding.round === null) {
      human.push(finding);
      continue;
    }
    rounds.set(finding.round, [...(rounds.get(finding.round) ?? []), finding]);
  }
  const numbers = [...rounds.keys()].sort((left, right) => left - right);
  const last = numbers.at(-1);
  const groups: FindingGroup[] = numbers.map((round) => {
    const items = rounds.get(round) ?? [];
    const final = round === last && isReportOnlyRound(items);
    return {
      key: `round-${round}`,
      title: final ? `Round ${round} · final, report only` : `Round ${round}`,
      findings: items,
    };
  });
  if (human.length > 0) groups.push({ key: "human", title: HUMAN_FINDING_GROUP, findings: human });
  return groups;
}

export function routeText(route: MissionFindingRoute): string {
  return ROUTE_TEXT[route];
}

export function waitsForHuman(finding: MissionFinding): boolean {
  return finding.route === "report" && finding.decision === null;
}

export function isEditableFinding(finding: MissionFinding): boolean {
  return finding.source === "human" && finding.decision === null;
}

export function decisionText(finding: MissionFinding): string | null {
  if (finding.decision === null) return null;
  const actor = finding.decided_by === null ? "" : ` by ${actorText(finding.decided_by)}`;
  return `${DECISION_VERB[finding.decision]}${actor}: ${finding.decision_reason ?? ""}`;
}

export function decisionMeaning(decision: MissionFindingDecision): string {
  return DECISION_MEANING[decision];
}

export function taskNameOf(
  finding: MissionFinding,
  tasks: readonly MissionTaskContent[],
): string | null {
  if (finding.task_id === null) return null;
  return tasks.find((task) => task.id === finding.task_id)?.content.name ?? finding.task_id;
}

export function assessmentChoiceText(
  assessmentId: string,
  assessments: readonly MissionAssessment[],
): string {
  const assessment = assessments.find((item) => item.id === assessmentId);
  if (assessment === undefined) return assessmentId;
  const round = assessment.round === null ? "" : `, round ${assessment.round}`;
  return `Attempt ${assessment.attempt}${round}: ${assessment.result} by ${actorText(assessment.actor)}`;
}

export function missedAssessmentText(
  finding: MissionFinding,
  assessments: readonly MissionAssessment[],
): string {
  const assessment = assessments.find((item) => item.id === finding.assessment_id);
  if (assessment === undefined) return `Missed by assessment ${finding.assessment_id}`;
  const round = assessment.round === null ? "" : ` of round ${assessment.round}`;
  return `Missed by the ${assessment.result} assessment${round} by ${actorText(assessment.actor)}`;
}

export function reporterText(finding: MissionFinding): string {
  const actor = finding.created_by === null ? "" : ` by ${actorText(finding.created_by)}`;
  return `Reported${actor}, ${utcDateTime(finding.created_at)}`;
}

export function causeOwnerText(finding: MissionFinding): string | null {
  return finding.cause_owner === null ? null : `Cause owner: ${finding.cause_owner}`;
}
