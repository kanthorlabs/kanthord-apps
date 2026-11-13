import type { MissionFinding } from "@/api/types";

import { type FindingGroup, findingGroupsOf, HUMAN_FINDING_GROUP } from "./review-findings";

const BLOCKER_FIRST: readonly MissionFinding["kind"][] = ["blocker", "suggestion"];

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
