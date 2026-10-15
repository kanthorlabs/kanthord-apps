import { describe, expect, it } from "vitest";

import type {
  MissionClosingEvent,
  MissionAssessmentResult,
  MissionExternalAction,
  MissionNodeRecord,
  MissionRunnableNode,
  NodeState,
  Project,
  SchedulerExecutionRecord,
} from "@/api/types";

import {
  blockedCauseOf,
  deriveAttention,
  detailKeyOf,
  detailOf,
  detailTargetsOf,
  groupItems,
} from "./attention";
import type { AttentionDetail, AttentionDetails, ProjectSnapshot } from "./attention";

const NO_DETAILS: AttentionDetails = new Map();

function derive(snapshots: readonly ProjectSnapshot[], details: AttentionDetails = NO_DETAILS) {
  return deriveAttention(snapshots, details);
}

function execution(
  id: string,
  overrides: Partial<SchedulerExecutionRecord> = {},
): SchedulerExecutionRecord {
  return {
    execution_id: id,
    project_id: "atlas",
    node_id: "n1",
    claimant: {
      worker_binding_id: "binding_1",
      resource_identity: "worker:kanthord:general-main",
      runtime_identity: "worker_instance_01",
    },
    attempt: 2,
    pinned_revision: 1,
    node_branch: "kanthord/n1",
    credentials: [],
    agent_selections: [],
    claim_state: "finished",
    expired_at: 5_000,
    created_at: 1_000,
    ended_at: 2_000,
    stop: null,
    trace_id: "0".repeat(32),
    root_span_id: "0".repeat(16),
    ...overrides,
  };
}

function pausedDetail(
  node: MissionRunnableNode,
  executions: readonly SchedulerExecutionRecord[],
  actions: readonly MissionExternalAction[] = [],
): AttentionDetail {
  return {
    kind: "paused",
    key: detailKeyOf(node),
    executions: { status: "ready", data: executions },
    actions: { status: "ready", data: actions },
  };
}

function project(id: string, name: string): Project {
  return {
    id,
    name,
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: `/state/${id}`,
  };
}

function node(
  id: string,
  name: string,
  state: NodeState,
  overrides: Partial<MissionRunnableNode> = {},
): MissionRunnableNode {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    parent_id: null,
    visible_revision: 1,
    content: { name, requirement: "", criterion: "", verifications: [], bindings: [] },
    retired_at: null,
    pinned_by_attempts: [],
    kind: "objective",
    state,
    attempt: 2,
    priority: 0,
    depends_on: [],
    ...overrides,
  };
}

function blocked(
  id: string,
  name: string,
  createdAt: number,
  closingEvent: MissionClosingEvent = "assessment-not-passed",
  result: MissionAssessmentResult = "criterion-not-met",
): MissionRunnableNode {
  return node(id, name, "Blocked", {
    blocked_context: {
      outcome: {
        id: `outcome_${id}`,
        node_id: id,
        attempt: 2,
        node_revision: 1,
        closing_event: closingEvent,
        result,
        assessment_id: `assessment_${id}`,
        evidence_ids: [],
        created_at: createdAt,
      },
      requests: [],
    },
  });
}

function snapshot(
  id: string,
  nodes: readonly MissionNodeRecord[],
  missionVersion = 4,
): ProjectSnapshot {
  return { project: project(id, id), missionVersion, nodes };
}

describe("blockedCauseOf", () => {
  it.each<[MissionClosingEvent, MissionAssessmentResult, string]>([
    ["assessment-not-passed", "criterion-not-met", "Criterion not met"],
    ["assessment-not-passed", "undetermined", "Undetermined"],
    ["external-failed", "undetermined", "External action failed"],
    ["human-block", "undetermined", "Blocked by a human"],
  ])("names %s with %s as %s", (closingEvent, result, label) => {
    expect(blockedCauseOf(blocked("n", "n", 1, closingEvent, result).blocked_context)).toBe(label);
  });

  it("names a node without a context as Blocked", () => {
    expect(blockedCauseOf(undefined)).toBe("Blocked");
  });
});

describe("deriveAttention", () => {
  it("lists a Blocked node with its cause, age and project", () => {
    const items = derive([snapshot("atlas", [blocked("n1", "Add reset", 500)])]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "blocked:n1",
      kind: "blocked",
      group: "decisions",
      cause: "Criterion not met",
      at: 500,
      missionVersion: 4,
    });
    expect(items[0]?.project.id).toBe("atlas");
  });

  it("skips tasks, retired nodes and every state but Blocked", () => {
    const task: MissionNodeRecord = {
      id: "t1",
      filename: "t1.md",
      mission_id: "mission_1",
      parent_id: "n1",
      visible_revision: 1,
      content: { name: "task", requirement: "", criterion: "", verifications: [], bindings: [] },
      retired_at: null,
      pinned_by_attempts: [],
      kind: "task",
    };
    const items = derive([
      snapshot("atlas", [
        task,
        node("n2", "Retired", "Blocked", { retired_at: 9 }),
        node("n3", "Pending", "Pending"),
        node("n4", "Executing", "Executing"),
      ]),
    ]);

    expect(items).toEqual([]);
  });

  it("sorts the oldest first, then the unknown age, then the name", () => {
    const items = derive([
      snapshot("atlas", [
        blocked("n1", "Zeta", 300),
        node("n2", "Beta", "Blocked"),
        blocked("n3", "Alpha", 300),
        blocked("n4", "Newest", 900),
        blocked("n5", "Oldest", 100),
        node("n6", "Alpha unknown", "Blocked"),
      ]),
    ]);

    expect(items.map((item) => item.node.content.name)).toEqual([
      "Oldest",
      "Alpha",
      "Zeta",
      "Newest",
      "Alpha unknown",
      "Beta",
    ]);
  });

  it("merges the projects and breaks a tie by the identity", () => {
    const items = derive([
      snapshot("kanthord", [blocked("n2", "Same", 100)]),
      snapshot("atlas", [blocked("n1", "Same", 100)]),
    ]);

    expect(items.map((item) => item.id)).toEqual(["blocked:n1", "blocked:n2"]);
  });
});

describe("groupItems", () => {
  it("hides an empty group", () => {
    expect(groupItems([])).toEqual([]);
  });

  it("collects the Blocked items under Decisions", () => {
    const items = derive([snapshot("atlas", [blocked("n1", "A", 1)])]);

    expect(groupItems(items).map((entry) => [entry.group.heading, entry.items.length])).toEqual([
      ["Decisions", 1],
    ]);
  });
});

describe("detailKeyOf", () => {
  it("changes with the attempt, the state and the revision", () => {
    const base = node("n1", "A", "Blocked");

    expect(detailKeyOf(base)).toBe("n1:2:Blocked:1");
    expect(detailKeyOf({ ...base, attempt: 3 })).not.toBe(detailKeyOf(base));
    expect(detailKeyOf({ ...base, state: "Paused" })).not.toBe(detailKeyOf(base));
    expect(detailKeyOf({ ...base, visible_revision: 2 })).not.toBe(detailKeyOf(base));
  });
});

describe("deriveAttention paused", () => {
  const paused = node("n1", "Compute the shipping rates", "Paused");

  function derived(details: AttentionDetails) {
    return derive([snapshot("atlas", [paused])], details).filter((item) => item.kind === "paused");
  }

  it("lists a Paused node before its executions are read, with an unknown cause and age", () => {
    const [item] = derived(NO_DETAILS);

    expect(item).toMatchObject({ kind: "paused", cause: null, at: null, pause: null });
  });

  it("names the Failure limit after a lost execution and takes the expiry as the end", () => {
    const details = new Map([
      [
        "n1",
        pausedDetail(paused, [
          execution("e1", { claim_state: "lost", ended_at: null, expired_at: 9_000 }),
          execution("e2", { claim_state: "lost", ended_at: null, expired_at: 4_000 }),
        ]),
      ],
    ]);

    const [item] = derived(details);

    expect(item).toMatchObject({ cause: "Failure limit", at: 9_000 });
  });

  it("names the Failure limit after a stop other than the budget", () => {
    const details = new Map([
      [
        "n1",
        pausedDetail(paused, [
          execution("e1", { stop: { reason: "provider_failed", code: "rate_limited" } }),
        ]),
      ],
    ]);

    expect(derived(details)[0]).toMatchObject({ cause: "Failure limit", at: 2_000 });
  });

  it("names the Further-work limit after a budget end", () => {
    const details = new Map([
      [
        "n1",
        pausedDetail(paused, [
          execution("e1", { stop: { reason: "budget_end", code: "turns" }, ended_at: 7_000 }),
        ]),
      ],
    ]);

    expect(derived(details)[0]).toMatchObject({ cause: "Further-work limit", at: 7_000 });
  });

  it("judges by the execution that ended last", () => {
    const details = new Map([
      [
        "n1",
        pausedDetail(paused, [
          execution("e1", { ended_at: 9_000 }),
          execution("e2", { stop: { reason: "no_progress", code: null }, ended_at: 3_000 }),
        ]),
      ],
    ]);

    expect(derived(details)[0]).toMatchObject({ cause: "Paused by a human", at: 9_000 });
  });

  it("names a pause by a human with an unknown age when no execution ran", () => {
    const details = new Map([["n1", pausedDetail(paused, [])]]);

    expect(derived(details)[0]).toMatchObject({ cause: "Paused by a human", at: null });
  });

  it("ignores a detail of another state of the node", () => {
    const stale = new Map([["n1", pausedDetail({ ...paused, attempt: 1 }, [execution("e1")])]]);

    expect(derived(stale)[0]).toMatchObject({ cause: null, at: null });
  });

  it("sorts a Paused node after a Blocked node and ahead of a dependency item", () => {
    const items = derive([
      snapshot("atlas", [
        node("n9", "Pending", "Pending", { depends_on: ["n8"] }),
        node("n8", "Gone", "Discarded"),
        paused,
        blocked("n2", "Blocked", 100),
      ]),
    ]);

    expect(items.map((item) => item.kind)).toEqual(["blocked", "paused", "dependency_discarded"]);
  });
});

describe("deriveAttention dependency_discarded", () => {
  it("lists a Pending node that depends on a Discarded node with an unknown age", () => {
    const items = derive([
      snapshot("atlas", [
        node("n1", "Redirect the links", "Pending", { depends_on: ["n2", "n3"] }),
        node("n2", "Drop the legacy checkout", "Discarded"),
        node("n3", "Completed one", "Completed"),
      ]),
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "dependency_discarded",
      cause: "Discarded dependency",
      at: null,
      discarded: [{ id: "n2", name: "Drop the legacy checkout" }],
    });
  });

  it("skips a Pending node whose dependencies are not Discarded, and a retired one", () => {
    const items = derive([
      snapshot("atlas", [
        node("n1", "Waits", "Pending", { depends_on: ["n3"] }),
        node("n2", "Retired", "Pending", { depends_on: ["n4"], retired_at: 5 }),
        node("n3", "Executing", "Executing"),
        node("n4", "Gone", "Discarded"),
      ]),
    ]);

    expect(items).toEqual([]);
  });

  it("skips an Available node that depends on a Discarded node", () => {
    const items = derive([
      snapshot("atlas", [
        node("n1", "Starts", "Available", { depends_on: ["n2"] }),
        node("n2", "Gone", "Discarded"),
      ]),
    ]);

    expect(items).toEqual([]);
  });
});

describe("detailTargetsOf and detailOf", () => {
  it("targets the Blocked and the Paused nodes only", () => {
    const targets = detailTargetsOf([
      snapshot("atlas", [
        blocked("n1", "A", 1),
        node("n2", "B", "Paused"),
        node("n3", "C", "Pending"),
        node("n4", "D", "Paused", { retired_at: 3 }),
      ]),
    ]);

    expect(targets.map((target) => [target.kind, target.node.id, target.projectId])).toEqual([
      ["blocked", "n1", "atlas"],
      ["paused", "n2", "atlas"],
    ]);
  });

  it("targets a Pending node with an open attempt that waits on a Discarded node", () => {
    const targets = detailTargetsOf([
      snapshot("atlas", [
        node("n1", "A", "Pending", { depends_on: ["n9"] }),
        node("n2", "B", "Pending", { depends_on: ["n9"], attempt: 0 }),
        node("n3", "C", "Pending", { depends_on: ["n8"] }),
        node("n8", "Done", "Completed"),
        node("n9", "Dropped", "Discarded"),
      ]),
    ]);

    expect(targets.map((target) => [target.kind, target.node.id])).toEqual([["open", "n1"]]);
  });

  it("answers a detail only for the key of the node", () => {
    const paused = node("n1", "A", "Paused");
    const details = new Map([["n1", pausedDetail(paused, [])]]);

    expect(detailOf(details, paused)?.kind).toBe("paused");
    expect(detailOf(details, { ...paused, attempt: 9 })).toBeNull();
  });
});
