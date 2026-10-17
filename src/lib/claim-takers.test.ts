import { describe, expect, it } from "vitest";

import type {
  MissionNodeRecord,
  NodeState,
  SchedulerJob,
  WorkerBindingRecord,
  WorkerCatalogItem,
  WorkerInstanceRecord,
  WorkerPlacement,
} from "@/api/types";

import { takerHintOf, uncoveredJobsOf, uncoveredStates } from "./claim-takers";

const CATALOG: readonly WorkerCatalogItem[] = [
  {
    name: "coder@1",
    host: "kanthord",
    declared_node_states: ["Available"],
    declared_works: ["implement", "examine"],
  },
  {
    name: "reviewer@1",
    host: "kanthord",
    declared_node_states: ["Waiting", "External.Requested"],
    declared_works: ["implement", "examine"],
  },
];

function node(id: string, state: NodeState): MissionNodeRecord {
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
    retired_at: null,
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

describe("uncoveredJobsOf", () => {
  it("groups the jobs of each uncovered state in the order of the queue", () => {
    const jobs = [job("w"), job("a"), job("x"), job("w2")];
    const nodes = [...NODES, node("w2", "Waiting")];

    const uncovered = uncoveredJobsOf(jobs, nodes, [instance("coder@1")], CATALOG);

    expect([...uncovered.keys()].sort()).toEqual(["External.Requested", "Waiting"]);
    expect(uncovered.get("Waiting")?.map((entry) => entry.node_id)).toEqual(["w", "w2"]);
  });
});

function binding(name: string, worker: string, placement?: WorkerPlacement): WorkerBindingRecord {
  return {
    id: `binding_${name}`,
    project_id: "prj-1",
    name,
    kind: "worker",
    resource_identity: `worker:kanthord:${name}`,
    revision: 1,
    config:
      placement === undefined
        ? { worker, instance_count: 1 }
        : { worker, instance_count: 1, placement },
    created_at: 1,
    removed_at: null,
  };
}

describe("takerHintOf", () => {
  it("names the binding at the server placement", () => {
    expect(
      takerHintOf("Waiting", [binding("reviewer-main", "reviewer@1", "server")], CATALOG),
    ).toEqual({
      kind: "server",
      binding: "reviewer-main",
      worker: "reviewer@1",
    });
  });

  it("reads an absent placement as the worker placement", () => {
    expect(takerHintOf("Waiting", [binding("reviewer-main", "reviewer@1")], CATALOG).kind).toBe(
      "worker",
    );
  });

  it("reads the worker placement of an explicit setting", () => {
    expect(
      takerHintOf("Waiting", [binding("reviewer-main", "reviewer@1", "worker")], CATALOG).kind,
    ).toBe("worker");
  });

  it("reads an external harness as the worker placement", () => {
    const harness: WorkerCatalogItem = {
      name: "claude-code@1",
      host: "external-harness",
      declared_node_states: ["Waiting"],
      declared_works: ["implement", "examine"],
    };

    expect(
      takerHintOf("Waiting", [binding("claude-main", "claude-code@1", "server")], [harness]),
    ).toEqual({ kind: "worker", binding: "claude-main", worker: "claude-code@1" });
  });

  it("takes the first binding by name that declares the state", () => {
    const hint = takerHintOf(
      "Waiting",
      [binding("z-review", "reviewer@1"), binding("a-review", "reviewer@1", "server")],
      CATALOG,
    );

    expect(hint).toMatchObject({ binding: "a-review" });
  });

  it("answers none when no binding declares the state", () => {
    expect(takerHintOf("Waiting", [binding("general-main", "coder@1")], CATALOG)).toEqual({
      kind: "none",
    });
    expect(takerHintOf("Waiting", [], CATALOG)).toEqual({ kind: "none" });
  });
});
