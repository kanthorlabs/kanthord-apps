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

import { factsOf, takerHintOf, uncoveredJobsOf, type UncoveredGroup } from "./claim-takers";

const CATALOG: readonly WorkerCatalogItem[] = [
  {
    name: "coder@1",
    host: "kanthord",
    declared_node_states: ["Available"],
    declared_intents: ["implement", "examine"],
  },
  {
    name: "reviewer@1",
    host: "kanthord",
    declared_node_states: ["Waiting", "External.Requested"],
    declared_intents: ["implement", "examine"],
  },
];

function node(id: string, state: NodeState, tags: readonly string[] = []): MissionNodeRecord {
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
      intent: "implement",
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    intent: "implement",
    tags,
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

function binding(
  name: string,
  worker: string,
  placement?: WorkerPlacement,
  tags?: readonly string[],
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
      ...(tags === undefined ? {} : { tags }),
    },
    created_at: 1,
    removed_at: null,
  };
}

function liveOf(...names: readonly string[]): WorkerInstanceRecord[] {
  return names.map((name) => instance(name));
}

function statesOf(groups: readonly UncoveredGroup[]): readonly NodeState[] {
  return groups.map((group) => group.facts.state);
}

function nodeIdsIn(groups: readonly UncoveredGroup[], state: NodeState): readonly string[] {
  return groups
    .filter((group) => group.facts.state === state)
    .flatMap((group) => group.jobs.map((entry) => entry.node_id));
}

const CODER = binding("coder@1", "coder@1");
const REVIEWER = binding("reviewer@1", "reviewer@1");

describe("uncoveredJobsOf", () => {
  it("groups the jobs of each uncovered state in the order of the queue", () => {
    const jobs = [job("w"), job("a"), job("x"), job("w2")];
    const nodes = [...NODES, node("w2", "Waiting")];

    const uncovered = uncoveredJobsOf(jobs, nodes, liveOf("coder@1"), [CODER, REVIEWER], CATALOG);

    expect([...statesOf(uncovered)].sort()).toEqual(["External.Requested", "Waiting"]);
    expect(nodeIdsIn(uncovered, "Waiting")).toEqual(["w", "w2"]);
  });

  it("answers no group when the live bindings cover every queued job", () => {
    const instances = liveOf("coder@1", "reviewer@1");

    expect(uncoveredJobsOf(JOBS, NODES, instances, [CODER, REVIEWER], CATALOG)).toEqual([]);
  });

  it("answers every queued state when the project runs no instance", () => {
    const uncovered = uncoveredJobsOf(JOBS, NODES, [], [CODER, REVIEWER], CATALOG);

    expect([...statesOf(uncovered)].sort()).toEqual(["Available", "External.Requested", "Waiting"]);
  });

  it("skips a job whose node the list omits", () => {
    expect(uncoveredJobsOf([job("gone")], NODES, [], [CODER], CATALOG)).toEqual([]);
  });

  it("splits the jobs of one state into a group for each tag set", () => {
    const nodes = [
      node("mac", "Available", ["platform.macos"]),
      node("linux", "Available", ["platform.linux"]),
      node("mac2", "Available", ["platform.macos"]),
    ];
    const jobs = [job("mac"), job("linux"), job("mac2")];

    const uncovered = uncoveredJobsOf(jobs, nodes, [], [CODER], CATALOG);

    expect(
      uncovered.map((group) => ({
        tags: group.facts.tags,
        nodeIds: group.jobs.map((entry) => entry.node_id),
      })),
    ).toEqual([
      { tags: ["platform.macos"], nodeIds: ["mac", "mac2"] },
      { tags: ["platform.linux"], nodeIds: ["linux"] },
    ]);
  });

  it("puts two tag sets that differ only in order into one group", () => {
    const nodes = [
      node("a", "Available", ["platform.macos", "toolchain.xcode_16"]),
      node("b", "Available", ["toolchain.xcode_16", "platform.macos"]),
    ];

    const uncovered = uncoveredJobsOf([job("a"), job("b")], nodes, [], [CODER], CATALOG);

    expect(uncovered).toHaveLength(1);
    expect(uncovered[0]?.facts.tags).toEqual(["platform.macos", "toolchain.xcode_16"]);
  });

  it("a node with tags [platform.macos] has no taker while every binding holds tags []", () => {
    const nodes = [node("a", "Available", ["platform.macos"]), node("b", "Available")];
    const jobs = [job("a"), job("b")];

    const uncovered = uncoveredJobsOf(jobs, nodes, liveOf("coder@1"), [CODER], CATALOG);

    expect(nodeIdsIn(uncovered, "Available")).toEqual(["a"]);
  });

  it("covers a node whose tags are a subset of the tags of a live binding", () => {
    const mac = binding("coder-mac", "coder@1", undefined, [
      "platform.macos",
      "toolchain.xcode_16",
    ]);
    const nodes = [node("a", "Available", ["platform.macos"])];

    expect(uncoveredJobsOf([job("a")], nodes, liveOf("coder-mac"), [mac], CATALOG)).toEqual([]);
  });

  it("leaves a node uncovered when its intent is not a declared intent of the worker", () => {
    const catalog: readonly WorkerCatalogItem[] = [
      { ...(CATALOG[0] as WorkerCatalogItem), declared_intents: ["examine"] },
    ];

    const uncovered = uncoveredJobsOf([job("a")], NODES, liveOf("coder@1"), [CODER], catalog);

    expect(statesOf(uncovered)).toEqual(["Available"]);
  });

  it("names the binding of an instance through its resource identity", () => {
    const uncovered = uncoveredJobsOf([job("a")], NODES, liveOf("other"), [CODER], CATALOG);

    expect(statesOf(uncovered)).toEqual(["Available"]);
  });

  it("admits nothing for a binding with no catalog item", () => {
    const unknown = binding("unknown", "unknown@1");

    const uncovered = uncoveredJobsOf([job("a")], NODES, liveOf("unknown"), [unknown], CATALOG);

    expect(statesOf(uncovered)).toEqual(["Available"]);
  });

  it("ignores a draining instance and an instance that left the registration", () => {
    const instances = [
      instance("coder@1", { draining: true }),
      instance("coder@1", { registered: false }),
    ];

    expect(statesOf(uncoveredJobsOf([job("a")], NODES, instances, [CODER], CATALOG))).toEqual([
      "Available",
    ]);
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
      declared_intents: ["implement", "examine"],
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

  it("a binding with the tag platform.macos and no instance is the hint", () => {
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
