import { describe, expect, it } from "vitest";

import type { MissionFinding } from "@/api/types";

import { boardFindingGroupsOf } from "./board-section-facts";

function missionFinding(overrides: Partial<MissionFinding> = {}): MissionFinding {
  const human = overrides.source === "human";
  return {
    id: "finding_1",
    node_id: "n1",
    attempt: 1,
    round: human ? null : 2,
    assessment_id: "assessment_1",
    source: "reviewer",
    label: human ? "H1" : "S1",
    kind: "suggestion",
    action: "yes",
    task_id: null,
    ground: null,
    name: "Trim the email",
    description: "The form keeps the spaces around the email address.",
    fix: "Trim the email address before the check.",
    why: "A pasted address often holds a trailing space.",
    route: "report",
    status: "open",
    fixed_assessment_id: null,
    cause_owner: human ? "reviewer" : null,
    created_by: human ? { kind: "human", account: "ulrich", name: "Ulrich" } : null,
    created_at: 1,
    decision: null,
    decision_reason: null,
    decided_by: null,
    decided_at: null,
    ...overrides,
  };
}

describe("boardFindingGroupsOf", () => {
  it("groups the findings by attempt and round, blockers first, then by the label number", () => {
    const groups = boardFindingGroupsOf([
      missionFinding({ id: "f5", attempt: 2, round: 1, label: "S1" }),
      missionFinding({ id: "f4", source: "human", attempt: 1, round: null, label: "H1" }),
      missionFinding({ id: "f3", attempt: 1, round: 2, label: "S10" }),
      missionFinding({ id: "f2", attempt: 1, round: 2, label: "S2" }),
      missionFinding({ id: "f1", attempt: 1, round: 2, label: "B1", kind: "blocker" }),
    ]);

    expect(
      groups.map((group) => [group.title, group.findings.map((finding) => finding.id)]),
    ).toEqual([
      ["Attempt 1 · Round 2", ["f1", "f2", "f3"]],
      ["Attempt 1 · Found after delivery", ["f4"]],
      ["Attempt 2 · Round 1", ["f5"]],
    ]);
  });

  it("titles a human finding at attempt 0 as found after delivery", () => {
    const groups = boardFindingGroupsOf([
      missionFinding({ id: "f1", source: "human", attempt: 0, round: null }),
    ]);

    expect(groups.map((group) => group.title)).toEqual(["Attempt 0 · Found after delivery"]);
  });
});
