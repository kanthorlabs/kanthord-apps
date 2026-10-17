import Elk from "elkjs/lib/elk.bundled.js";
import { describe, expect, it } from "vitest";

import type { MissionEdge, MissionNodeRecord, Work } from "@/api/types";

import {
  laneGrid,
  layoutRequest,
  placedNodeIds,
  readLayout,
  roundedPath,
  type Box,
} from "./graph-layout";
import { buildGraph } from "./mission-graph";

function node(id: string, work: Work): MissionNodeRecord {
  return {
    id,
    work,
    requires: [],
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
      work,
      requires: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    state: "Pending",
    attempt: 0,
    priority: 0,
    depends_on: [],
  };
}

function dependency(dependentId: string, dependsOnId: string): MissionEdge {
  return { dependent_id: dependentId, depends_on_id: dependsOnId };
}

const NODES: readonly MissionNodeRecord[] = [
  node("onboarding", "examine"),
  node("signup", "implement"),
  node("verify", "implement"),
  node("recovery", "examine"),
  node("codes", "implement"),
  node("reset", "implement"),
  node("audit", "implement"),
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
    expect(laneGrid(366)).toEqual({ lanes: 1, laneWidth: 334 });
  });

  it("gives a desktop at most four lanes", () => {
    expect(laneGrid(1000)).toEqual({ lanes: 4, laneWidth: 230 });
  });

  it("refuses a width that is not positive", () => {
    expect(() => laneGrid(0)).toThrow("The graph width 0 is not a positive number.");
  });
});

describe("layoutRequest", () => {
  it("puts the nodes of each row into the partition of that row", () => {
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
      codes: "0",
      onboarding: "0",
      recovery: "1",
      reset: "1",
      audit: "2",
      signup: "2",
      verify: "2",
    });
    expect(request.edges).toHaveLength(EDGES.length);
  });

  it("refuses a node without a measured height", () => {
    const model = buildGraph(NODES, EDGES);
    expect(() => layoutRequest(model, laneGrid(366), new Map())).toThrow(
      "The graph holds no measured height for codes.",
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
      EDGES.map((edge) => `${edge.depends_on_id}->${edge.dependent_id}`).sort(),
    );
    for (const edge of layout.edges) expect(edge.path).toMatch(/^M [\d.]+ [\d.]+ /);
    expect(layout.edges.filter((edge) => edge.group === "stuck")).toHaveLength(2);
  });

  it("places each row below the rows before it", async () => {
    const { model, layout } = await layoutAt(1000);
    const boxesOf = (index: number) =>
      (model.rows[index] ?? []).map((item) => layout.boxes.get(item.id) as Box);

    for (let index = 1; index < model.rows.length; index += 1) {
      const top = Math.min(...boxesOf(index).map((box) => box.y));
      const bottom = Math.max(...boxesOf(index - 1).map((box) => box.y + box.height));
      expect(top).toBeGreaterThanOrEqual(bottom);
    }
  });
});
