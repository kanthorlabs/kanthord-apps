import { describe, expect, it } from "vitest";

import type { MissionNodeRecord, NodeState } from "@/api/types";

import { deriveAttention } from "./attention";
import { attentionSummary, claimedNodeCount, statusLineText } from "./overview-summary";

function node(id: string, state: NodeState, retiredAt: number | null = null): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    parent_id: null,
    visible_revision: 1,
    content: { name: id, requirement: "", criterion: "", verifications: [], bindings: [] },
    retired_at: retiredAt,
    pinned_by_attempts: [],
    kind: "objective",
    state,
    attempt: 1,
    priority: 0,
    depends_on: [],
  };
}

describe("statusLineText", () => {
  it("counts the executions and the jobs", () => {
    expect(statusLineText(3, 4)).toBe("3 executions run · 4 jobs wait");
  });

  it("uses the singular for one", () => {
    expect(statusLineText(1, 1)).toBe("1 execution runs · 1 job waits");
  });
});

describe("claimedNodeCount", () => {
  it("counts the nodes in Executing and Evaluating", () => {
    expect(
      claimedNodeCount([
        node("a", "Executing"),
        node("b", "Evaluating"),
        node("c", "Waiting"),
        node("d", "Executing", 7),
      ]),
    ).toBe(2);
  });
});

describe("attentionSummary", () => {
  const project = {
    id: "p",
    name: "p",
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: "/p",
  };

  it("names the count of each group", () => {
    const items = deriveAttention([
      { project, missionVersion: 1, nodes: [node("a", "Blocked"), node("b", "Blocked")] },
    ]);

    expect(attentionSummary(items)).toBe("2 decisions");
  });

  it("says that no item waits when the list is empty", () => {
    expect(attentionSummary([])).toBe("No item waits for you");
  });
});
