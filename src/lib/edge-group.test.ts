import { describe, expect, it } from "vitest";

import type { MissionEdge, MissionRunnableNode, NodeState } from "@/api/types";

import { edgeGroupOf } from "./edge-group";
import { buildGraph } from "./mission-graph";

function runnable(
  id: string,
  kind: "initiative" | "objective",
  parentId: string | null,
  state: NodeState,
): MissionRunnableNode {
  return {
    id,
    kind,
    filename: `${id}.md`,
    missionId: "mission_1",
    parentId,
    visibleRevision: 1,
    content: { name: id, requirement: "r", criterion: "c", verifications: ["v"], bindings: [] },
    retiredAt: null,
    pinnedByAttempts: [],
    state,
    attempt: 0,
    priority: 0,
    dependsOn: [],
  };
}

function dependency(dependentId: string, dependsOnId: string): MissionEdge {
  return { kind: "dependency", dependentId, dependsOnId };
}

const NODES = [
  runnable("recovery", "initiative", null, "Available"),
  runnable("signup", "objective", "recovery", "Completed"),
  runnable("codes", "objective", "recovery", "Executing"),
  runnable("legacy", "objective", "recovery", "Discarded"),
  runnable("reset", "objective", "recovery", "Pending"),
  runnable("audit", "objective", "recovery", "Pending"),
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
