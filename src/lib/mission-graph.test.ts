import { describe, expect, it } from "vitest";

import type { Intent, MissionEdge, MissionNodeRecord, NodeState } from "@/api/types";

import { buildGraph, closureOf, diagnosticKey } from "./mission-graph";

function node(
  id: string,
  intent: Intent,
  state: NodeState = "Pending",
  priority = 0,
): MissionNodeRecord {
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
    pinned_revision: null,
    state,
    attempt: 0,
    priority,
    depends_on: [],
  };
}

function dependency(dependentId: string, dependsOnId: string): MissionEdge {
  return { dependent_id: dependentId, depends_on_id: dependsOnId };
}

const NODES: readonly MissionNodeRecord[] = [
  node("recovery", "examine"),
  node("onboarding", "examine", "Completed"),
  node("signup", "implement", "Completed"),
  node("codes", "implement", "Executing"),
  node("reset", "implement"),
  node("audit", "implement", "Blocked"),
];

function rowIds(nodes: readonly MissionNodeRecord[], edges: readonly MissionEdge[]) {
  return buildGraph(nodes, edges).rows.map((row) => row.map((item) => item.id));
}

describe("buildGraph", () => {
  it("a node ranks below every node that it depends on", () => {
    const rows = rowIds(NODES, [
      dependency("reset", "codes"),
      dependency("recovery", "reset"),
      dependency("recovery", "audit"),
      dependency("onboarding", "signup"),
    ]);

    expect(rows).toEqual([["audit", "codes", "signup"], ["onboarding", "reset"], ["recovery"]]);
  });

  it("ranks a node by the longest dependency path", () => {
    const rows = rowIds(NODES, [
      dependency("reset", "codes"),
      dependency("audit", "reset"),
      dependency("recovery", "audit"),
      dependency("recovery", "codes"),
    ]);

    expect(rows[rows.length - 1]).toEqual(["recovery"]);
    expect(rows).toHaveLength(4);
  });

  it("sorts a row by priority, then by filename", () => {
    const nodes = [
      node("b", "implement", "Pending", 0),
      node("a", "implement", "Pending", 0),
      node("c", "examine", "Pending", 5),
    ];

    expect(rowIds(nodes, [])).toEqual([["c", "a", "b"]]);
  });

  it("leaves out retired nodes", () => {
    const retired = { ...node("old", "implement"), retired_at: 1 };
    const model = buildGraph([...NODES, retired], []);

    expect(model.nodeById.has("old")).toBe(false);
    expect(model.rows.flat().map((item) => item.id)).not.toContain("old");
  });

  it("reports a dependency whose endpoint is not in the read", () => {
    const model = buildGraph(NODES, [dependency("reset", "node_missing")]);

    expect(model.diagnostics).toEqual([
      {
        kind: "unresolved-dependency",
        link: { dependentId: "reset", dependsOnId: "node_missing" },
      },
    ]);
    expect(model.links).toEqual([]);
  });

  it("reports a cycle instead of hiding it", () => {
    const model = buildGraph(NODES, [dependency("codes", "reset"), dependency("reset", "codes")]);

    expect(model.diagnostics).toContainEqual({ kind: "cycle", nodeIds: ["codes", "reset"] });
  });

  it("places the members of a cycle in the last row", () => {
    const rows = rowIds(NODES, [dependency("codes", "reset"), dependency("reset", "codes")]);

    expect(rows[rows.length - 1]).toEqual(["codes", "reset"]);
  });

  it("reports only the members of a cycle, not the nodes that wait for it", () => {
    const model = buildGraph(NODES, [
      dependency("codes", "reset"),
      dependency("reset", "codes"),
      dependency("audit", "reset"),
    ]);

    expect(model.diagnostics).toEqual([{ kind: "cycle", nodeIds: ["codes", "reset"] }]);
  });
});

describe("closureOf", () => {
  it("the closure holds the direct dependencies alone", () => {
    const model = buildGraph(NODES, [
      dependency("recovery", "reset"),
      dependency("reset", "codes"),
    ]);
    const closure = closureOf(model, "recovery");

    expect(closure.members.map((member) => member.nodeId)).toEqual(["reset"]);
    expect(closure.status).toBe("does not hold");
  });

  it("holds when every member is Completed", () => {
    const model = buildGraph(NODES, [dependency("recovery", "onboarding")]);

    expect(closureOf(model, "recovery").status).toBe("holds");
  });

  it("is unknown when a member is not in the read", () => {
    const model = buildGraph(NODES, [dependency("codes", "node_missing")]);

    expect(closureOf(model, "codes").status).toBe("unknown");
  });
});

describe("diagnosticKey", () => {
  it("keys an unresolved dependency by both ends", () => {
    const model = buildGraph(NODES, [dependency("reset", "node_missing")]);
    const [diagnostic] = model.diagnostics;

    expect(diagnostic && diagnosticKey(diagnostic)).toBe(
      "unresolved-dependency:reset:node_missing",
    );
  });
});
