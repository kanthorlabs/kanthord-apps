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

import { factsOf, takerHintOf, uncoveredJobsOf, uncoveredStates } from "./claim-takers";

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

function node(id: string, state: NodeState, requires: readonly string[] = []): MissionNodeRecord {
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
    requires,
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

function binding(
  name: string,
  worker: string,
  placement?: WorkerPlacement,
  traits?: readonly string[],
): WorkerBindingRecord {
  return {
    id: `binding_${name}`,
    project_id: "prj-1",
    name,
    kind: "worker",
    resource_identity: `worker:kanthord:${name}`,
    revision: 1,
    config: {
      worker,
      instance_count: 1,
      ...(placement === undefined ? {} : { placement }),
      ...(traits === undefined ? {} : { traits }),
    },
    created_at: 1,
    removed_at: null,
  };
}

function liveOf(...names: readonly string[]): WorkerInstanceRecord[] {
  return names.map((name) => instance(name));
}

const CODER = binding("coder@1", "coder@1");
const REVIEWER = binding("reviewer@1", "reviewer@1");

describe("uncoveredJobsOf", () => {
  it("groups the jobs of each uncovered state in the order of the queue", () => {
    const jobs = [job("w"), job("a"), job("x"), job("w2")];
    const nodes = [...NODES, node("w2", "Waiting")];

    const uncovered = uncoveredJobsOf(jobs, nodes, liveOf("coder@1"), [CODER, REVIEWER], CATALOG);

    expect([...uncovered.keys()].sort()).toEqual(["External.Requested", "Waiting"]);
    expect(uncovered.get("Waiting")?.map((entry) => entry.node_id)).toEqual(["w", "w2"]);
  });

  it("a node with requires [platform.macos] has no taker while every binding holds traits []", () => {
    const nodes = [node("a", "Available", ["platform.macos"]), node("b", "Available")];
    const jobs = [job("a"), job("b")];

    const uncovered = uncoveredJobsOf(jobs, nodes, liveOf("coder@1"), [CODER], CATALOG);

    expect(uncovered.get("Available")?.map((entry) => entry.node_id)).toEqual(["a"]);
  });

  it("covers a node whose requires list is a subset of the traits of a live binding", () => {
    const mac = binding("coder-mac", "coder@1", undefined, [
      "platform.macos",
      "toolchain.xcode_16",
    ]);
    const nodes = [node("a", "Available", ["platform.macos"])];

    expect(uncoveredJobsOf([job("a")], nodes, liveOf("coder-mac"), [mac], CATALOG).size).toBe(0);
  });

  it("leaves a node uncovered when its work is not a declared work of the worker", () => {
    const catalog: readonly WorkerCatalogItem[] = [
      { ...(CATALOG[0] as WorkerCatalogItem), declared_works: ["examine"] },
    ];

    const uncovered = uncoveredJobsOf([job("a")], NODES, liveOf("coder@1"), [CODER], catalog);

    expect([...uncovered.keys()]).toEqual(["Available"]);
  });

  it("names the binding of an instance through its resource identity", () => {
    const uncovered = uncoveredJobsOf([job("a")], NODES, liveOf("other"), [CODER], CATALOG);

    expect([...uncovered.keys()]).toEqual(["Available"]);
  });

  it("admits nothing for a binding with no catalog item", () => {
    const unknown = binding("unknown", "unknown@1");

    const uncovered = uncoveredJobsOf([job("a")], NODES, liveOf("unknown"), [unknown], CATALOG);

    expect([...uncovered.keys()]).toEqual(["Available"]);
  });

  it("ignores a draining instance and an instance that left the registration", () => {
    const instances = [
      instance("coder@1", { draining: true }),
      instance("coder@1", { registered: false }),
    ];

    expect(uncoveredJobsOf([job("a")], NODES, instances, [CODER], CATALOG).has("Available")).toBe(
      true,
    );
  });
});

const WAITING = factsOf(node("w", "Waiting"));

describe("takerHintOf", () => {
  it("names the binding at the server placement", () => {
    expect(
      takerHintOf(WAITING, [binding("reviewer-main", "reviewer@1", "server")], CATALOG),
    ).toEqual({
      kind: "server",
      binding: "reviewer-main",
      worker: "reviewer@1",
    });
  });

  it("reads an absent placement as the worker placement", () => {
    expect(takerHintOf(WAITING, [binding("reviewer-main", "reviewer@1")], CATALOG).kind).toBe(
      "worker",
    );
  });

  it("reads the worker placement of an explicit setting", () => {
    expect(
      takerHintOf(WAITING, [binding("reviewer-main", "reviewer@1", "worker")], CATALOG).kind,
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
      takerHintOf(WAITING, [binding("claude-main", "claude-code@1", "server")], [harness]),
    ).toEqual({ kind: "worker", binding: "claude-main", worker: "claude-code@1" });
  });

  it("takes the first binding by name that admits the node", () => {
    const hint = takerHintOf(
      WAITING,
      [binding("z-review", "reviewer@1"), binding("a-review", "reviewer@1", "server")],
      CATALOG,
    );

    expect(hint).toMatchObject({ binding: "a-review" });
  });

  it("a binding with the trait platform.macos and no instance is the hint", () => {
    const facts = factsOf(node("a", "Available", ["platform.macos"]));
    const bindings = [
      binding("a-general", "coder@1"),
      binding("m-mac", "coder@1", "server", ["platform.macos"]),
    ];

    expect(takerHintOf(facts, bindings, CATALOG)).toEqual({
      kind: "server",
      binding: "m-mac",
      worker: "coder@1",
    });
  });

  it("answers none when no binding admits the node", () => {
    expect(takerHintOf(WAITING, [binding("general-main", "coder@1")], CATALOG)).toEqual({
      kind: "none",
    });
    expect(takerHintOf(WAITING, [], CATALOG)).toEqual({ kind: "none" });
  });
});
