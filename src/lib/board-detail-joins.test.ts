import { describe, expect, it } from "vitest";

import type { EnvironmentState, MissionNodeRecord, Project } from "@/api/types";

import type { AttentionItem, ProjectSnapshot } from "./attention";
import { environmentsOf, heldNodesOf } from "./board-detail-joins";

const PROJECT: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const OTHER: Project = { ...PROJECT, id: "prj-2", name: "beta" };

const ENVIRONMENT = { binding_id: "binding_1" } as unknown as EnvironmentState;

function nodeOf(id: string): MissionNodeRecord {
  return { id } as unknown as MissionNodeRecord;
}

function snapshotOf(
  project: Project,
  nodes: readonly MissionNodeRecord[],
  environments: readonly EnvironmentState[] | null,
): ProjectSnapshot {
  return {
    project,
    missionVersion: 1,
    nodes,
    jobs: null,
    registrations: null,
    executions: null,
    bindings: null,
    environments,
  };
}

function itemOf(project: Project): AttentionItem {
  return { kind: "blocked", group: "decisions", project } as unknown as AttentionItem;
}

describe("heldNodesOf", () => {
  const snapshots = [
    snapshotOf(PROJECT, [nodeOf("a")], null),
    snapshotOf(OTHER, [nodeOf("b")], null),
  ];

  it("joins each id to its node and project in id order", () => {
    expect(heldNodesOf(["b", "a"], snapshots)).toEqual([
      { node: nodeOf("b"), project: OTHER },
      { node: nodeOf("a"), project: PROJECT },
    ]);
  });

  it("skips an id that no snapshot holds", () => {
    expect(heldNodesOf(["missing", "a"], snapshots)).toEqual([
      { node: nodeOf("a"), project: PROJECT },
    ]);
  });

  it("returns nothing for no ids", () => {
    expect(heldNodesOf([], snapshots)).toEqual([]);
  });
});

describe("environmentsOf", () => {
  it("returns the environments of the project of the item", () => {
    const snapshots = [snapshotOf(PROJECT, [], null), snapshotOf(OTHER, [], [ENVIRONMENT])];
    expect(environmentsOf(itemOf(OTHER), snapshots)).toEqual([ENVIRONMENT]);
  });

  it("returns null when the snapshot of the project is missing", () => {
    expect(environmentsOf(itemOf(OTHER), [snapshotOf(PROJECT, [], [ENVIRONMENT])])).toBeNull();
  });

  it("returns null when the snapshot has no environments read", () => {
    expect(environmentsOf(itemOf(PROJECT), [snapshotOf(PROJECT, [], null)])).toBeNull();
  });

  it("returns null for an item without a project", () => {
    const item = { kind: "tool_approval" } as unknown as AttentionItem;
    expect(environmentsOf(item, [snapshotOf(PROJECT, [], [ENVIRONMENT])])).toBeNull();
  });
});
