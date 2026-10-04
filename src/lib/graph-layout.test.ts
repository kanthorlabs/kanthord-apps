import Elk from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";

import type { MissionEdge, MissionNodeRecord, MissionRunnableNode } from "@/api/types";

import {
  laneGrid,
  layoutRequest,
  placedNodeIds,
  readLayout,
  roundedPath,
  type Box,
} from "./graph-layout";
import { buildGraph } from "./mission-graph";

function runnable(
  id: string,
  kind: "initiative" | "objective",
  parentId: string | null,
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
    state: "Pending",
    attempt: 0,
    priority: 0,
    dependsOn: [],
  };
}

function dependency(dependentId: string, dependsOnId: string): MissionEdge {
  return { kind: "dependency", dependentId, dependsOnId };
}

const NODES: readonly MissionNodeRecord[] = [
  runnable("onboarding", "initiative", null),
  runnable("signup", "objective", "onboarding"),
  runnable("verify", "objective", "onboarding"),
  runnable("recovery", "initiative", null),
  runnable("codes", "objective", "recovery"),
  runnable("reset", "objective", "recovery"),
  runnable("audit", "objective", "recovery"),
];

const EDGES: readonly MissionEdge[] = [
  dependency("recovery", "onboarding"),
  dependency("verify", "signup"),
  dependency("reset", "codes"),
  dependency("audit", "signup"),
  dependency("signup", "audit"),
];

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

async function layoutAt(width: number) {
  const model = buildGraph(NODES, EDGES);
  const heights = new Map(placedNodeIds(model).map((id) => [id, 80]));
  const result = await new Elk().layout(layoutRequest(model, laneGrid(width), heights));
  return { model, layout: readLayout(model, result) };
}

describe("laneGrid", () => {
  it("gives a phone one full-width lane", () => {
    expect(laneGrid(366)).toEqual({ lanes: 1, laneWidth: 334, bandWidth: 334 });
  });

  it("gives a desktop at most four lanes", () => {
    expect(laneGrid(1000)).toEqual({ lanes: 4, laneWidth: 230, bandWidth: 968 });
  });

  it("refuses a width that is not positive", () => {
    expect(() => laneGrid(0)).toThrow("The graph width 0 is not a positive number.");
  });
});

describe("layoutRequest", () => {
  it("puts each initiative and its objectives into two consecutive partitions", () => {
    const model = buildGraph(NODES, EDGES);
    const heights = new Map(placedNodeIds(model).map((id) => [id, 80]));
    const request = layoutRequest(model, laneGrid(366), heights);

    const partitions = Object.fromEntries(
      (request.children ?? []).map((child) => [
        child.id,
        child.layoutOptions?.["elk.partitioning.partition"],
      ]),
    );
    expect(partitions).toEqual({
      onboarding: "0",
      signup: "1",
      verify: "1",
      recovery: "2",
      codes: "3",
      reset: "3",
      audit: "3",
    });
    expect(request.edges).toHaveLength(EDGES.length);
  });

  it("refuses a node without a measured height", () => {
    const model = buildGraph(NODES, EDGES);
    expect(() => layoutRequest(model, laneGrid(366), new Map())).toThrow(
      "The graph holds no measured height for onboarding.",
    );
  });
});

describe("roundedPath", () => {
  it("draws a straight segment without a corner", () => {
    expect(
      roundedPath([
        { x: 0, y: 0 },
        { x: 0, y: 40 },
      ]),
    ).toBe("M 0 0 L 0 40");
  });

  it("rounds a corner with a quadratic curve", () => {
    expect(
      roundedPath([
        { x: 0, y: 0 },
        { x: 0, y: 40 },
        { x: 40, y: 40 },
      ]),
    ).toBe("M 0 0 L 0 34 Q 0 40, 6 40 L 40 40");
  });

  it("refuses a path with one point", () => {
    expect(() => roundedPath([{ x: 0, y: 0 }])).toThrow("An edge path needs at least two points.");
  });
});

describe("readLayout", () => {
  it("places every card on a phone without an overlap and inside the width", async () => {
    const { model, layout } = await layoutAt(366);
    const boxes = [...layout.boxes.values()];

    expect(boxes).toHaveLength(placedNodeIds(model).length);
    for (const [index, box] of boxes.entries()) {
      for (const other of boxes.slice(index + 1)) expect(overlaps(box, other)).toBe(false);
    }
    expect(layout.width).toBeLessThanOrEqual(366 + 16);
  });

  it("routes every dependency, the cycle included", async () => {
    const { layout } = await layoutAt(366);

    expect(layout.edges.map((edge) => `${edge.dependsOnId}->${edge.dependentId}`).sort()).toEqual(
      EDGES.map((edge) =>
        edge.kind === "dependency" ? `${edge.dependsOnId}->${edge.dependentId}` : "",
      ).sort(),
    );
    for (const edge of layout.edges) expect(edge.path).toMatch(/^M [\d.]+ [\d.]+ /);
    expect(layout.edges.filter((edge) => edge.group === "stuck")).toHaveLength(2);
  });

  it("stacks the initiative bands in order without an overlap", async () => {
    const { layout } = await layoutAt(366);
    const [first, second] = layout.bands;

    expect(layout.bands.map((band) => band.initiativeId)).toEqual(["onboarding", "recovery"]);
    expect(first && second && first.box.y + first.box.height <= second.box.y).toBe(true);
  });
});
