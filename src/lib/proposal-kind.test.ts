import { describe, expect, it } from "vitest";

import type { MissionFollowupProposal, MissionProposal } from "@/api/types";

import { isFixProposal, isFollowupProposal } from "./proposal-kind";

const FIX: MissionProposal = {
  id: "proposal_1",
  node_id: "node_1",
  attempt: 1,
  assessment_id: "assessment_1",
  content: {
    dependency_id: "node_2",
    name: "Fix",
    requirement: "r",
    criterion: "c",
    task: { name: "t", requirement: "r", criterion: "c", verifications: ["v"] },
  },
  created_node_id: null,
  approved_at: null,
  rejected_at: null,
  created_at: 1,
};

const FOLLOWUP: MissionFollowupProposal = {
  id: "followup_1",
  node_id: "node_1",
  attempt: 1,
  assessment_id: null,
  content: { node_revision: 2 },
  created_node_id: null,
  approved_at: null,
  rejected_at: null,
  created_at: 1,
};

describe("proposal kind", () => {
  it("takes a row with a null assessment_id for a follow-up proposal", () => {
    expect(isFollowupProposal(FOLLOWUP)).toBe(true);
    expect(isFixProposal(FOLLOWUP)).toBe(false);
  });

  it("takes a row with an assessment_id string for a fix proposal", () => {
    expect(isFixProposal(FIX)).toBe(true);
    expect(isFollowupProposal(FIX)).toBe(false);
  });
});
