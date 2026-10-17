import { describe, expect, it } from "vitest";

import type { MissionNodeRecord, NodeState } from "@/api/types";

import { tallyStates } from "./state-tally";

function node(id: string, state: NodeState, retiredAt: number | null = null): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name: id,
      requirement: "",
      criterion: "",
      verifications: [],
      bindings: [],
      work: "implement",
      requires: [],
    },
    retired_at: retiredAt,
    pinned_by_attempts: [],
    work: "implement",
    requires: [],
    tasks: [],
    state,
    attempt: 0,
    priority: 0,
    depends_on: [],
  };
}

describe("tallyStates", () => {
  it("orders the tallies by the lifecycle and drops an empty state", () => {
    const tallies = tallyStates([
      node("a", "Completed"),
      node("b", "Pending"),
      node("c", "Completed"),
      node("d", "Executing"),
    ]);

    expect(tallies).toEqual([
      { state: "Pending", count: 1 },
      { state: "Executing", count: 1 },
      { state: "Completed", count: 2 },
    ]);
  });

  it("skips a retired node", () => {
    expect(tallyStates([node("a", "Pending", 5)])).toEqual([]);
  });
});
