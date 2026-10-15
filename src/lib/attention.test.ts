import { describe, expect, it } from "vitest";

import type {
  ActionLanding,
  MissionClosingEvent,
  MissionAssessmentResult,
  MissionEvidence,
  MissionExternalAction,
  RepositoryActionName,
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
  externalReadStateOf,
  groupItems,
} from "./attention";
import type { AttentionDetail, AttentionDetails, ProjectSnapshot } from "./attention";

const NO_DETAILS: AttentionDetails = new Map();

const NOW = 10_000_000;
const MINUTE = 60_000;

function derive(
  snapshots: readonly ProjectSnapshot[],
  details: AttentionDetails = NO_DETAILS,
  now = NOW,
) {
  return deriveAttention(snapshots, details, now);
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
  it("targets the Blocked, the Paused and the External.Requested nodes only", () => {
    const targets = detailTargetsOf([
      snapshot("atlas", [
        blocked("n1", "A", 1),
        node("n2", "B", "Paused"),
        node("n3", "C", "Pending"),
        node("n4", "D", "Paused", { retired_at: 3 }),
        node("n5", "E", "External.Requested"),
      ]),
    ]);

    expect(targets.map((target) => [target.kind, target.node.id, target.projectId])).toEqual([
      ["blocked", "n1", "atlas"],
      ["paused", "n2", "atlas"],
      ["external", "n5", "atlas"],
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

function request(
  kind: RepositoryActionName,
  landing?: ActionLanding,
  resolution: MissionExternalAction["resolution"] = "unresolved",
  key = `repo.${kind}`,
): MissionExternalAction {
  return {
    node_id: "n1",
    attempt: 2,
    action: {
      key,
      binding_id: "binding_1",
      action: kind,
      expected_end_state: kind === "pull_request" ? "pull_request_merged" : "base_branch_pushed",
      follows: null,
      configuration:
        landing === undefined ? { base_branch: "main" } : { base_branch: "main", landing },
    },
    requested: true,
    request_evidence_id: `evidence_${key}`,
    resolution,
  };
}

function evidenceFor(action: MissionExternalAction, createdAt: number): MissionEvidence {
  return {
    id: action.request_evidence_id ?? "evidence_none",
    node_id: "n1",
    attempt: 2,
    subject: "Request",
    assets: [],
    provenance: { kind: "human", account: "a", name: "A" },
    created_at: createdAt,
    requirement_key: action.action.key,
  };
}

function externalDetail(
  requested: MissionRunnableNode,
  actions: readonly MissionExternalAction[],
  evidence: readonly MissionEvidence[],
): AttentionDetails {
  return new Map([
    [
      requested.id,
      {
        kind: "external",
        key: detailKeyOf(requested),
        actions: { status: "ready", data: actions },
        evidence: { status: "ready", data: evidence },
      },
    ],
  ]);
}

describe("deriveAttention outside", () => {
  const requested = node("n1", "Stripe webhook", "External.Requested");

  it("lists nothing before the external reads answer", () => {
    expect(derive([snapshot("atlas", [requested])])).toEqual([]);
  });

  it("lists a pull request that waits for a human merge, aged by its request evidence", () => {
    const pr = request("pull_request");
    const items = derive(
      [snapshot("atlas", [requested])],
      externalDetail(requested, [pr], [evidenceFor(pr, NOW - 5 * MINUTE)]),
    );

    expect(items[0]).toMatchObject({
      id: "merge_wait:n1",
      kind: "merge_wait",
      group: "outside",
      cause: "Waits for merge",
      at: NOW - 5 * MINUTE,
    });
  });

  it("lists a human merge with an unknown age when the evidence is missing", () => {
    const items = derive(
      [snapshot("atlas", [requested])],
      externalDetail(requested, [request("pull_request", "human")], []),
    );

    expect(items[0]).toMatchObject({ kind: "merge_wait", at: null });
  });

  it("lists a push as unconfirmed only after 10 minutes", () => {
    const push = request("merge_push");
    const snapshots = [snapshot("atlas", [requested])];

    const fresh = derive(
      snapshots,
      externalDetail(requested, [push], [evidenceFor(push, NOW - 10 * MINUTE)]),
    );
    const aged = derive(
      snapshots,
      externalDetail(requested, [push], [evidenceFor(push, NOW - 10 * MINUTE - 1)]),
    );

    expect(fresh).toEqual([]);
    expect(aged[0]).toMatchObject({
      kind: "delivery_unconfirmed",
      cause: "Delivery not confirmed",
      at: NOW - 10 * MINUTE - 1,
    });
  });

  it("treats a pull request that kanthord lands as a delivery", () => {
    const landed = request("pull_request", "kanthord");
    const items = derive(
      [snapshot("atlas", [requested])],
      externalDetail(requested, [landed], [evidenceFor(landed, NOW - 30 * MINUTE)]),
    );

    expect(items[0]).toMatchObject({ kind: "delivery_unconfirmed" });
  });

  it("skips a delivery without its request evidence", () => {
    const push = request("merge_push");

    expect(derive([snapshot("atlas", [requested])], externalDetail(requested, [push], []))).toEqual(
      [],
    );
  });

  it("skips a request that holds its end state", () => {
    const done = request("pull_request", undefined, "expected-end");

    expect(
      derive(
        [snapshot("atlas", [requested])],
        externalDetail(requested, [done], [evidenceFor(done, 1)]),
      ),
    ).toEqual([]);
  });

  it("takes the human merge first and the oldest aged delivery otherwise", () => {
    const pr = request("pull_request");
    const push = request("merge_push", undefined, "unresolved", "repo.merge_push");
    const both = derive(
      [snapshot("atlas", [requested])],
      externalDetail(requested, [push, pr], [evidenceFor(pr, 1), evidenceFor(push, 1)]),
    );

    expect(both).toHaveLength(1);
    expect(both[0]?.kind).toBe("merge_wait");
  });

  it("sorts the outside items after the decisions, then the oldest first", () => {
    const first = node("n1", "A", "External.Requested");
    const second = node("n2", "B", "External.Requested");
    const prFirst = { ...request("pull_request"), node_id: "n1" };
    const prSecond = {
      ...request("pull_request"),
      node_id: "n2",
      request_evidence_id: "evidence_2",
    };
    const details = new Map([
      ...externalDetail(first, [prFirst], [evidenceFor(prFirst, 200)]),
      ...externalDetail(second, [prSecond], [{ ...evidenceFor(prSecond, 100), id: "evidence_2" }]),
    ]);

    const items = derive(
      [snapshot("atlas", [first, second, blocked("n3", "Blocked one", 999)])],
      details,
    );

    expect(items.map((item) => item.node.id)).toEqual(["n3", "n2", "n1"]);
  });
});

describe("externalReadStateOf", () => {
  const requested = node("n1", "Stripe webhook", "External.Requested");
  const targets = detailTargetsOf([snapshot("atlas", [requested])]);

  it("counts a target without its detail as pending", () => {
    expect(externalReadStateOf(targets, NO_DETAILS)).toEqual({ pending: 1, failures: [] });
  });

  it("reports a failed read with its message", () => {
    const details = new Map([
      [
        "n1",
        {
          kind: "external" as const,
          key: detailKeyOf(requested),
          actions: { status: "failed" as const, message: "No answer." },
          evidence: { status: "ready" as const, data: [] },
        },
      ],
    ]);

    const state = externalReadStateOf(targets, details);

    expect(state.pending).toBe(0);
    expect(state.failures.map((failure) => failure.message)).toEqual(["No answer."]);
  });

  it("reports nothing for answered reads", () => {
    expect(externalReadStateOf(targets, externalDetail(requested, [], []))).toEqual({
      pending: 0,
      failures: [],
    });
  });
});
