import { describe, expect, it } from "vitest";

import type { MissionEdge, MissionNodeRecord, NodeState, Intent } from "@/api/types";

import { edgeGroupOf } from "./edge-group";
import { buildGraph } from "./mission-graph";

function node(id: string, intent: Intent, state: NodeState): MissionNodeRecord {
  return {
    id,
    intent,
    tags: [],
    tasks: [],
    filename: `${id}.md`,
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name: id,
      requirement: "r",
      criterion: "c",
      verifications: ["v"],
      bindings: [],
      intent,
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    state,
    attempt: 0,
    priority: 0,
    depends_on: [],
  };
}

function dependency(dependentId: string, dependsOnId: string): MissionEdge {
  return { dependent_id: dependentId, depends_on_id: dependsOnId };
}

const NODES = [
  node("recovery", "examine", "Available"),
  node("signup", "implement", "Completed"),
  node("codes", "implement", "Executing"),
  node("legacy", "implement", "Discarded"),
  node("reset", "implement", "Pending"),
  node("audit", "implement", "Pending"),
];

function groupOf(edges: readonly MissionEdge[], dependentId: string, dependsOnId: string) {
  return edgeGroupOf(buildGraph(NODES, edges), { dependentId, dependsOnId });
}

describe("edgeGroupOf", () => {
  it("is done when the node that the dependency names is Completed", () => {
    expect(groupOf([dependency("audit", "signup")], "audit", "signup")).toBe("done");
  });

  it("is waiting when the node that the dependency names is not terminal", () => {
    expect(groupOf([dependency("reset", "codes")], "reset", "codes")).toBe("waiting");
  });

  it("is stuck when the node that the dependency names is Discarded", () => {
    expect(groupOf([dependency("reset", "legacy")], "reset", "legacy")).toBe("stuck");
  });

  it("is stuck inside a cycle", () => {
    const edges = [dependency("reset", "audit"), dependency("audit", "reset")];

    expect(groupOf(edges, "reset", "audit")).toBe("stuck");
  });

  it("is waiting on an edge that only leads into a cycle", () => {
    const edges = [
      dependency("reset", "audit"),
      dependency("audit", "reset"),
      dependency("codes", "reset"),
    ];

    expect(groupOf(edges, "codes", "reset")).toBe("waiting");
  });
});
