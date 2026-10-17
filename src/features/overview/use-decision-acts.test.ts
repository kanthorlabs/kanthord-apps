import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  MissionExternalAction,
  MissionProposal,
  MissionNodeRecord,
  NodeState,
  Project,
  Work,
} from "@/api/types";
import { detailKeyOf, type AttentionDetail, type DecisionAttentionItem } from "@/lib/attention";

vi.mock("@/api/resources/mission");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { useDecisionActs } from "./use-decision-acts";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

function node(work: Work, state: NodeState): MissionNodeRecord {
  return {
    id: "node_1",
    work,
    requires: [],
    tasks: [],
    filename: "node_1.md",
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name: "Team",
      requirement: "r",
      criterion: "c",
      verifications: [],
      bindings: [],
      work,
      requires: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    state,
    attempt: 2,
    priority: 0,
    depends_on: [],
  };
}

function proposal(id: string, attempt: number, approvedAt: number | null): MissionProposal {
  return {
    id,
    node_id: "node_1",
    attempt,
    assessment_id: "assessment_1",
    content: {
      dependency_id: "node_2",
      name: id,
      requirement: "r",
      criterion: "c",
      task: { name: "t", requirement: "r", criterion: "c", verifications: ["v"] },
    },
    created_node_id: null,
    approved_at: approvedAt,
    created_at: 1,
  };
}

function unresolved(): MissionExternalAction {
  return {
    node_id: "node_1",
    attempt: 2,
    action: {
      key: "repo.pull_request",
      binding_id: "binding_1",
      action: "pull_request",
      expected_end_state: "pull_request_merged",
      follows: null,
      configuration: { base_branch: "main", landing: "human" },
    },
    requested: true,
    request_evidence_id: "evidence_1",
    resolution: "unresolved",
  };
}

function actsOf(item: DecisionAttentionItem, detail: AttentionDetail | null) {
  return renderHook(() =>
    useDecisionActs(item, detail, { reload: vi.fn(), markActed: vi.fn(), setDialogOpen: vi.fn() }),
  ).result.current;
}

describe("useDecisionActs", () => {
  it("exposes the open proposals of a Blocked examine node", () => {
    const target = node("examine", "Blocked");
    const item: DecisionAttentionItem = {
      id: "blocked:node_1",
      kind: "blocked",
      group: "decisions",
      project: PROJECT,
      subject: target.content.name,
      missionVersion: 7,
      node: target,
      nodes: [target],
      at: null,
      cause: "Criterion not met",
    };
    const detail: AttentionDetail = {
      kind: "blocked",
      key: detailKeyOf(target),
      assessment: { status: "ready", data: null },
      proposals: {
        status: "ready",
        data: [proposal("open", 2, null), proposal("approved", 2, 5), proposal("old", 1, null)],
      },
    };

    expect(actsOf(item, detail).proposals.map((entry) => entry.id)).toEqual(["open"]);
    expect(actsOf(item, null).proposals).toEqual([]);
  });

  it("exposes the unresolved request sentence of a Paused node", () => {
    const target = node("implement", "Paused");
    const item: DecisionAttentionItem = {
      id: "paused:node_1",
      kind: "paused",
      group: "decisions",
      project: PROJECT,
      subject: target.content.name,
      missionVersion: 7,
      node: target,
      nodes: [target],
      at: null,
      pause: null,
      cause: null,
    };
    const detail: AttentionDetail = {
      kind: "paused",
      key: detailKeyOf(target),
      executions: { status: "ready", data: [] },
      actions: { status: "ready", data: [unresolved()] },
    };

    const acts = actsOf(item, detail);

    expect(acts.unresolved).toBe(
      "Attempt 2 has an unresolved pull request. Override and discard wait for its end state. Resume the node.",
    );
    expect(acts.discard.available).toBe(false);
    expect(actsOf(item, null).unresolved).toBeNull();
  });
});
