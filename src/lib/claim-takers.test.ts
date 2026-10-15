import { describe, expect, it } from "vitest";

import type {
  MissionNodeRecord,
  NodeState,
  SchedulerJob,
  WorkerCatalogItem,
  WorkerInstanceRecord,
} from "@/api/types";

import { uncoveredStates } from "./claim-takers";

const CATALOG: readonly WorkerCatalogItem[] = [
  {
    name: "coder@1",
    host: "kanthord",
    declared_node_states: ["Available"],
    required_node_format: ["objective"],
  },
  {
    name: "reviewer@1",
    host: "kanthord",
    declared_node_states: ["Waiting", "External.Requested"],
    required_node_format: ["objective"],
  },
];

function node(id: string, state: NodeState): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    parent_id: null,
    visible_revision: 1,
    content: { name: id, requirement: "", criterion: "", verifications: [], bindings: [] },
    retired_at: null,
    pinned_by_attempts: [],
    kind: "objective",
    state,
    attempt: 0,
    priority: 0,
    depends_on: [],
  };
}

function job(nodeId: string): SchedulerJob {
  return { job_id: `job_${nodeId}`, project_id: "prj-1", node_id: nodeId, priority: 0 };
}

function instance(
  workerName: string,
  overrides: { readonly draining?: boolean; readonly registered?: boolean } = {},
): WorkerInstanceRecord {
  return {
    runtime_identity: `worker_instance_${workerName}`,
    project_id: "prj-1",
    resource_identity: `worker:kanthord:${workerName}`,
    worker_name: workerName,
    host: "kanthord",
    placement: "server",
    activity: "idle",
    draining: overrides.draining ?? false,
    registered: overrides.registered ?? true,
  };
}

const NODES = [node("a", "Available"), node("w", "Waiting"), node("x", "External.Requested")];
const JOBS = [job("a"), job("w"), job("x")];

describe("uncoveredStates", () => {
  it("answers no state when the live instances declare every queued state", () => {
    const covered = uncoveredStates(
      JOBS,
      NODES,
      [instance("coder@1"), instance("reviewer@1")],
      CATALOG,
    );

    expect(covered.size).toBe(0);
  });

  it("answers the queued state that no live instance declares", () => {
    const uncovered = uncoveredStates(JOBS, NODES, [instance("coder@1")], CATALOG);

    expect([...uncovered].sort()).toEqual(["External.Requested", "Waiting"]);
  });

  it("ignores a draining instance and an instance that left the registration", () => {
    const uncovered = uncoveredStates(
      JOBS,
      NODES,
      [
        instance("coder@1"),
        instance("reviewer@1", { draining: true }),
        instance("reviewer@1", { registered: false }),
      ],
      CATALOG,
    );

    expect(uncovered.has("Waiting")).toBe(true);
  });

  it("answers every queued state when the project runs no instance", () => {
    const uncovered = uncoveredStates(JOBS, NODES, [], CATALOG);

    expect([...uncovered].sort()).toEqual(["Available", "External.Requested", "Waiting"]);
  });

  it("answers a state that holds no job as covered", () => {
    const uncovered = uncoveredStates([job("a")], NODES, [instance("coder@1")], CATALOG);

    expect(uncovered.size).toBe(0);
  });

  it("skips a job whose node the list omits", () => {
    expect(uncoveredStates([job("gone")], NODES, [], CATALOG).size).toBe(0);
  });

  it("treats a worker outside the catalog as declaring nothing", () => {
    const uncovered = uncoveredStates([job("a")], NODES, [instance("unknown@1")], CATALOG);

    expect([...uncovered]).toEqual(["Available"]);
  });
});
