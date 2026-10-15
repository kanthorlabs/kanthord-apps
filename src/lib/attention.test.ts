import { describe, expect, it } from "vitest";

import type {
  MissionClosingEvent,
  MissionAssessmentResult,
  MissionNodeRecord,
  MissionRunnableNode,
  NodeState,
  Project,
} from "@/api/types";

import { blockedCauseOf, deriveAttention, detailKeyOf, groupItems } from "./attention";
import type { ProjectSnapshot } from "./attention";

function project(id: string, name: string): Project {
  return {
    id,
    name,
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: `/state/${id}`,
  };
}

function node(
  id: string,
  name: string,
  state: NodeState,
  overrides: Partial<MissionRunnableNode> = {},
): MissionRunnableNode {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    parent_id: null,
    visible_revision: 1,
    content: { name, requirement: "", criterion: "", verifications: [], bindings: [] },
    retired_at: null,
    pinned_by_attempts: [],
    kind: "objective",
    state,
    attempt: 2,
    priority: 0,
    depends_on: [],
    ...overrides,
  };
}

function blocked(
  id: string,
  name: string,
  createdAt: number,
  closingEvent: MissionClosingEvent = "assessment-not-passed",
  result: MissionAssessmentResult = "criterion-not-met",
): MissionRunnableNode {
  return node(id, name, "Blocked", {
    blocked_context: {
      outcome: {
        id: `outcome_${id}`,
        node_id: id,
        attempt: 2,
        node_revision: 1,
        closing_event: closingEvent,
        result,
        assessment_id: `assessment_${id}`,
        evidence_ids: [],
        created_at: createdAt,
      },
      requests: [],
    },
  });
}

function snapshot(
  id: string,
  nodes: readonly MissionNodeRecord[],
  missionVersion = 4,
): ProjectSnapshot {
  return { project: project(id, id), missionVersion, nodes };
}

describe("blockedCauseOf", () => {
  it.each<[MissionClosingEvent, MissionAssessmentResult, string]>([
    ["assessment-not-passed", "criterion-not-met", "Criterion not met"],
    ["assessment-not-passed", "undetermined", "Undetermined"],
    ["external-failed", "undetermined", "External action failed"],
    ["human-block", "undetermined", "Blocked by a human"],
  ])("names %s with %s as %s", (closingEvent, result, label) => {
    expect(blockedCauseOf(blocked("n", "n", 1, closingEvent, result).blocked_context)).toBe(label);
  });

  it("names a node without a context as Blocked", () => {
    expect(blockedCauseOf(undefined)).toBe("Blocked");
  });
});

describe("deriveAttention", () => {
  it("lists a Blocked node with its cause, age and project", () => {
    const items = deriveAttention([snapshot("atlas", [blocked("n1", "Add reset", 500)])]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "blocked:n1",
      kind: "blocked",
      group: "decisions",
      cause: "Criterion not met",
      at: 500,
      missionVersion: 4,
    });
    expect(items[0]?.project.id).toBe("atlas");
  });

  it("skips tasks, retired nodes and every state but Blocked", () => {
    const task: MissionNodeRecord = {
      id: "t1",
      filename: "t1.md",
      mission_id: "mission_1",
      parent_id: "n1",
      visible_revision: 1,
      content: { name: "task", requirement: "", criterion: "", verifications: [], bindings: [] },
      retired_at: null,
      pinned_by_attempts: [],
      kind: "task",
    };
    const items = deriveAttention([
      snapshot("atlas", [
        task,
        node("n2", "Retired", "Blocked", { retired_at: 9 }),
        node("n3", "Pending", "Pending"),
        node("n4", "Executing", "Executing"),
      ]),
    ]);

    expect(items).toEqual([]);
  });

  it("sorts the oldest first, then the unknown age, then the name", () => {
    const items = deriveAttention([
      snapshot("atlas", [
        blocked("n1", "Zeta", 300),
        node("n2", "Beta", "Blocked"),
        blocked("n3", "Alpha", 300),
        blocked("n4", "Newest", 900),
        blocked("n5", "Oldest", 100),
        node("n6", "Alpha unknown", "Blocked"),
      ]),
    ]);

    expect(items.map((item) => item.node.content.name)).toEqual([
      "Oldest",
      "Alpha",
      "Zeta",
      "Newest",
      "Alpha unknown",
      "Beta",
    ]);
  });

  it("merges the projects and breaks a tie by the identity", () => {
    const items = deriveAttention([
      snapshot("kanthord", [blocked("n2", "Same", 100)]),
      snapshot("atlas", [blocked("n1", "Same", 100)]),
    ]);

    expect(items.map((item) => item.id)).toEqual(["blocked:n1", "blocked:n2"]);
  });
});

describe("groupItems", () => {
  it("hides an empty group", () => {
    expect(groupItems([])).toEqual([]);
  });

  it("collects the Blocked items under Decisions", () => {
    const items = deriveAttention([snapshot("atlas", [blocked("n1", "A", 1)])]);

    expect(groupItems(items).map((entry) => [entry.group.heading, entry.items.length])).toEqual([
      ["Decisions", 1],
    ]);
  });
});

describe("detailKeyOf", () => {
  it("changes with the attempt, the state and the revision", () => {
    const base = node("n1", "A", "Blocked");

    expect(detailKeyOf(base)).toBe("n1:2:Blocked:1");
    expect(detailKeyOf({ ...base, attempt: 3 })).not.toBe(detailKeyOf(base));
    expect(detailKeyOf({ ...base, state: "Paused" })).not.toBe(detailKeyOf(base));
    expect(detailKeyOf({ ...base, visible_revision: 2 })).not.toBe(detailKeyOf(base));
  });
});
