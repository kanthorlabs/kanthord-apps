import { describe, expect, it } from "vitest";

import type {
  MissionEdge,
  MissionNodeRecord,
  MissionRunnableNode,
  MissionTaskNode,
  NodeState,
} from "@/api/types";

import { buildGraph, closureOf, diagnosticText, objectiveProgress } from "./mission-graph";

function runnable(
  id: string,
  kind: "initiative" | "objective",
  parentId: string | null,
  state: NodeState = "Pending",
  priority = 0,
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
    priority,
  };
}

function task(id: string, parentId: string): MissionTaskNode {
  return {
    id,
    kind: "task",
    filename: `${id}.md`,
    missionId: "mission_1",
    parentId,
    visibleRevision: 1,
    content: { name: id, requirement: "r", criterion: "c", verifications: ["v"], bindings: [] },
    retiredAt: null,
    pinnedByAttempts: [],
  };
}

function dependency(dependentId: string, dependsOnId: string): MissionEdge {
  return { kind: "dependency", dependentId, dependsOnId };
}

const NODES: readonly MissionNodeRecord[] = [
  runnable("recovery", "initiative", null),
  runnable("onboarding", "initiative", null, "Completed"),
  runnable("signup", "objective", "onboarding", "Completed"),
  runnable("codes", "objective", "recovery", "Executing"),
  runnable("reset", "objective", "recovery"),
  runnable("audit", "objective", "recovery", "Blocked"),
  task("expiry", "reset"),
  task("email", "reset"),
];

describe("buildGraph", () => {
  it("orders initiatives after the initiatives they wait for", () => {
    const model = buildGraph(NODES, [dependency("recovery", "onboarding")]);

    expect(model.initiatives.map((block) => [block.node.id, block.rank])).toEqual([
      ["onboarding", 0],
      ["recovery", 1],
    ]);
  });

  it("lifts a cross-initiative objective dependency into the initiative order", () => {
    const model = buildGraph(NODES, [dependency("audit", "signup")]);

    expect(model.initiatives.map((block) => block.node.id)).toEqual(["onboarding", "recovery"]);
  });

  it("puts an objective in the row after the objective that it depends on", () => {
    const model = buildGraph(NODES, [dependency("reset", "codes")]);
    const recovery = model.initiatives.find((block) => block.node.id === "recovery");

    expect(recovery?.rows.map((row) => row.map((cell) => cell.node.id))).toEqual([
      ["audit", "codes"],
      ["reset"],
    ]);
  });

  it("nests tasks inside their objective in filename order", () => {
    const model = buildGraph(NODES, []);
    const reset = model.initiatives
      .flatMap((block) => block.rows.flat())
      .find((cell) => cell.node.id === "reset");

    expect(reset?.tasks.map((item) => item.id)).toEqual(["email", "expiry"]);
  });

  it("sorts ties by priority, then by filename", () => {
    const nodes = [
      runnable("b", "initiative", null, "Pending", 0),
      runnable("a", "initiative", null, "Pending", 0),
      runnable("c", "initiative", null, "Pending", 5),
    ];

    expect(buildGraph(nodes, []).initiatives.map((block) => block.node.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("leaves out retired nodes", () => {
    const retired = { ...runnable("old", "objective", "recovery"), retiredAt: 1 };
    const model = buildGraph([...NODES, retired], []);

    expect(model.nodeById.has("old")).toBe(false);
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

  it("reports a node that has no place in the containment tree", () => {
    const model = buildGraph([...NODES, runnable("stray", "objective", "node_missing")], []);

    expect(model.diagnostics).toContainEqual({ kind: "unplaced-node", nodeId: "stray" });
  });
});

describe("closureOf", () => {
  it("holds the dependencies of the node and of its ancestors", () => {
    const model = buildGraph(NODES, [
      dependency("recovery", "onboarding"),
      dependency("reset", "codes"),
    ]);
    const closure = closureOf(model, "expiry");

    expect(closure.members.map((member) => [member.nodeId, member.via])).toEqual([
      ["codes", "reset"],
      ["onboarding", "recovery"],
    ]);
    expect(closure.status).toBe("does not hold");
  });

  it("holds when every member is Completed", () => {
    const model = buildGraph(NODES, [dependency("recovery", "onboarding")]);

    expect(closureOf(model, "codes").status).toBe("holds");
  });

  it("is unknown when a member is not in the read", () => {
    const model = buildGraph(NODES, [dependency("codes", "node_missing")]);

    expect(closureOf(model, "codes").status).toBe("unknown");
  });
});

describe("objectiveProgress", () => {
  it("counts the terminal objectives of an initiative", () => {
    const model = buildGraph(NODES, []);

    expect(objectiveProgress(model, "recovery")).toEqual({ terminal: 0, total: 3 });
    expect(objectiveProgress(model, "onboarding")).toEqual({ terminal: 1, total: 1 });
  });
});

describe("diagnosticText", () => {
  it("names both ends of an unresolved dependency", () => {
    const model = buildGraph(NODES, [dependency("reset", "node_missing")]);
    const [diagnostic] = model.diagnostics;

    expect(diagnostic && diagnosticText(model, diagnostic)).toBe(
      "A dependency of reset names node_missing, and the read does not hold that node.",
    );
  });
});
