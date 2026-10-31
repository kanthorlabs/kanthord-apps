import { describe, expect, it } from "vitest";

import type {
  AgentSelection,
  ExecutionStop,
  MissionNodeRecord,
  NodeState,
  Project,
  SchedulerExecutionRecord,
  WorkbenchSessionListItem,
} from "@/api/types";

import {
  type AttentionDetails,
  type AttentionItem,
  deriveAttention,
  detailKeyOf,
  type ProjectSnapshot,
} from "./attention";
import {
  type BoardGate,
  boardProjectsOf,
  gateOf,
  heldNodeIdsOf,
  hiddenByFilterOf,
  isInProject,
  isNothingAtAll,
  itemNodeIdsOf,
  pausedNodeCountOf,
  rankBoardItems,
  startItemOf,
} from "./board-items";

const NOW = 10_000_000;

const PROJECT: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const OTHER: Project = { ...PROJECT, id: "prj-2", name: "beta" };

const SESSION: WorkbenchSessionListItem = {
  id: "s1",
  agent_name: "swe@1",
  name: null,
  created: 1,
  modified: 2,
  message_count: 1,
  first_message: "Create",
  run_active: true,
  pending_approval: { tool_call_id: "c1", operation_id: "project.create" },
};

function node(
  id: string,
  state: NodeState,
  overrides: Partial<MissionNodeRecord> = {},
): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name: `Node ${id}`,
      requirement: "",
      criterion: "",
      verifications: [],
      bindings: [],
      intent: "implement",
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    pinned_revision: null,
    intent: "implement",
    tags: [],
    tasks: [],
    state,
    attempt: 2,
    priority: 0,
    depends_on: [],
    ...overrides,
  };
}

function blocked(id: string, name: string, createdAt: number | null): MissionNodeRecord {
  const base = node(id, "Blocked", { content: { ...node(id, "Blocked").content, name } });
  if (createdAt === null) return base;
  return {
    ...base,
    blocked_context: {
      outcome: {
        id: `outcome_${id}`,
        node_id: id,
        attempt: 2,
        node_revision: 1,
        closing_event: "human-block",
        result: "undetermined",
        assessment_id: `assessment_${id}`,
        evidence_ids: [],
        created_at: createdAt,
      },
      requests: [],
    },
  };
}

function snapshot(
  nodes: readonly MissionNodeRecord[],
  overrides: Partial<ProjectSnapshot> = {},
): ProjectSnapshot {
  return {
    project: PROJECT,
    missionVersion: 1,
    nodes,
    jobs: null,
    registrations: null,
    executions: null,
    bindings: null,
    environments: null,
    ...overrides,
  };
}

function derive(
  snapshots: readonly ProjectSnapshot[],
  details: AttentionDetails = new Map(),
  sessions: readonly WorkbenchSessionListItem[] | null = null,
) {
  return deriveAttention(snapshots, details, {
    now: NOW,
    catalog: null,
    credentials: [],
    sessions,
  });
}

function itemOf(items: readonly AttentionItem[], id: string): AttentionItem {
  const item = items.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`No item ${id}.`);
  return item;
}

function selection(credential: string): AgentSelection {
  return {
    agent_name: "swe@1",
    position: 0,
    level: "enablement",
    agent_provider: "openai-org",
    provider: "openai-compatible",
    credential,
    model_identifier: "gpt-5",
    reasoning_effort: "off",
  };
}

function execution(
  nodeId: string,
  stop: ExecutionStop | null,
  credential = "openai-main",
): SchedulerExecutionRecord {
  return {
    execution_id: `execution_${nodeId}`,
    project_id: PROJECT.id,
    node_id: nodeId,
    claimant: {
      worker_binding_id: "binding_coder",
      resource_identity: "worker:kanthord:coder-main",
      runtime_identity: "worker_registration_01",
    },
    attempt: 2,
    pinned_revision: 1,
    node_branch: `kanthord/${nodeId}`,
    credentials: [],
    agent_selections: [selection(credential)],
    claim_state: "finished",
    expired_at: 5_000,
    created_at: 1_000,
    ended_at: 2_000,
    stop,
    trace_id: "0".repeat(32),
    root_span_id: "0".repeat(16),
  };
}

function pausedScenario(stop: ExecutionStop | null, credential = "openai-main") {
  const paused = node("n1", "Paused");
  const executions = [execution("n1", stop, credential)];
  const details: AttentionDetails = new Map([
    [
      "n1",
      {
        kind: "paused",
        key: detailKeyOf(paused),
        executions: { status: "ready", data: executions },
        actions: { status: "ready", data: [] },
      },
    ],
  ]);
  return derive([snapshot([paused], { executions })], details);
}

const UNAUTHORIZED: ExecutionStop = { reason: "provider_failed", code: "unauthorized" };

describe("itemNodeIdsOf", () => {
  it("answers the node of a node item", () => {
    expect(itemNodeIdsOf(itemOf(derive([snapshot([blocked("a", "A", 1)])]), "blocked:a"))).toEqual([
      "a",
    ]);
  });

  it("answers the nodeIds of a fix item", () => {
    const items = derive([
      snapshot([node("a", "Pending"), node("b", "Completed")], {
        project: { ...PROJECT, paused_at: 5 },
      }),
    ]);

    expect(itemNodeIdsOf(itemOf(items, "project_paused:prj-1"))).toEqual(["a"]);
  });

  it("answers an empty list for a tool approval", () => {
    expect(itemNodeIdsOf(itemOf(derive([], new Map(), [SESSION]), "tool_approval:s1"))).toEqual([]);
  });
});

describe("heldNodeIdsOf", () => {
  const chain = snapshot([
    blocked("a", "A", 1),
    node("b", "Pending", { depends_on: ["a"] }),
    node("c", "Waiting", { depends_on: ["b"] }),
    node("d", "Available", { depends_on: ["b", "c"] }),
    node("done", "Completed", { depends_on: ["a"] }),
    node("after-done", "Pending", { depends_on: ["done"] }),
    node("gone", "Discarded", { depends_on: ["a"] }),
    node("unrelated", "Pending"),
  ]);

  it("answers the node and its transitive dependents once each", () => {
    const item = itemOf(derive([chain]), "blocked:a");

    expect(heldNodeIdsOf(item, [chain])).toEqual(["a", "b", "c", "d"]);
  });

  it("stops at a terminal node", () => {
    const item = itemOf(derive([chain]), "blocked:a");

    const held = heldNodeIdsOf(item, [chain]);

    expect(held).not.toContain("done");
    expect(held).not.toContain("after-done");
    expect(held).not.toContain("gone");
  });

  it("follows no dependency into another project", () => {
    const other = snapshot([node("x", "Pending", { depends_on: ["a"] })], { project: OTHER });
    const item = itemOf(derive([chain, other]), "blocked:a");

    expect(heldNodeIdsOf(item, [chain, other])).not.toContain("x");
  });

  it("holds the dependents of every node of a fix item", () => {
    const paused = snapshot(
      [
        node("p", "Pending"),
        node("q", "Executing"),
        node("pd", "Pending", { depends_on: ["p"] }),
        node("qd", "Pending", { depends_on: ["q", "pd"] }),
      ],
      { project: { ...PROJECT, paused_at: 5 } },
    );
    const item = itemOf(derive([paused]), "project_paused:prj-1");

    expect(heldNodeIdsOf(item, [paused])).toEqual(["p", "q", "pd", "qd"]);
  });

  it("holds nothing for a tool approval", () => {
    const item = itemOf(derive([chain], new Map(), [SESSION]), "tool_approval:s1");

    expect(heldNodeIdsOf(item, [chain])).toEqual([]);
  });
});

describe("boardProjectsOf and isInProject", () => {
  const second = snapshot([node("n2", "Paused")], { project: OTHER });
  const first = snapshot([node("n1", "Paused")], {
    executions: [execution("n1", UNAUTHORIZED)],
  });
  const refused = {
    ...second,
    executions: [{ ...execution("n2", UNAUTHORIZED), project_id: OTHER.id }],
  };
  const items = derive([first, refused], new Map(), [SESSION]);

  it("answers the projects of a fix item", () => {
    const item = itemOf(items, "credential_refused:openai-main");

    expect(boardProjectsOf(item)).toEqual([PROJECT, OTHER]);
    expect(isInProject(item, "prj-1")).toBe(true);
    expect(isInProject(item, "prj-2")).toBe(true);
    expect(isInProject(item, "prj-3")).toBe(false);
  });

  it("answers the project of a node item", () => {
    const item = itemOf(items, "paused:n2");

    expect(boardProjectsOf(item)).toEqual([OTHER]);
    expect(isInProject(item, "prj-2")).toBe(true);
    expect(isInProject(item, "prj-1")).toBe(false);
  });

  it("answers no project and every filter for a tool approval", () => {
    const item = itemOf(items, "tool_approval:s1");

    expect(boardProjectsOf(item)).toEqual([]);
    expect(isInProject(item, "prj-1")).toBe(true);
    expect(isInProject(item, "prj-9")).toBe(true);
  });
});

describe("pausedNodeCountOf", () => {
  const shipped = node("n3", "Paused");
  const failed = node("n2", "Waiting");
  const executions = [
    execution("n1", UNAUTHORIZED),
    execution("n2", UNAUTHORIZED),
    execution("n3", UNAUTHORIZED),
  ];
  const items = derive([snapshot([node("n1", "Paused"), failed, shipped], { executions })]);
  const credential = itemOf(items, "credential_refused:openai-main");

  it("counts the Paused nodes of the credential item", () => {
    if (credential.kind !== "credential_refused") throw new Error("Not a credential item.");

    expect(pausedNodeCountOf(credential, [snapshot([node("n1", "Paused"), failed, shipped])])).toBe(
      2,
    );
  });

  it("counts none without a snapshot of its nodes", () => {
    if (credential.kind !== "credential_refused") throw new Error("Not a credential item.");

    expect(pausedNodeCountOf(credential, [])).toBe(0);
  });
});

describe("gateOf", () => {
  it("gates a paused item whose last stop is unauthorized on its credential item", () => {
    const items = pausedScenario(UNAUTHORIZED);

    expect(gateOf(itemOf(items, "paused:n1"), items)).toEqual({
      itemId: "credential_refused:openai-main",
      need: "Rotate openai-main in Fix setup",
      short: "Rotate openai-main",
    });
  });

  it("gates nothing for another stop", () => {
    const items = pausedScenario({ reason: "provider_failed", code: "rate_limited" });

    expect(gateOf(itemOf(items, "paused:n1"), items)).toBeNull();
  });

  it("gates nothing without a stop", () => {
    const items = pausedScenario(null);

    expect(gateOf(itemOf(items, "paused:n1"), items)).toBeNull();
  });

  it("gates nothing when no credential item names a credential of the selections", () => {
    const items = pausedScenario(UNAUTHORIZED);
    const withoutCredential = items.filter((item) => item.kind !== "credential_refused");

    expect(gateOf(itemOf(items, "paused:n1"), withoutCredential)).toBeNull();
  });

  it("gates nothing for an item that is not paused", () => {
    const items = pausedScenario(UNAUTHORIZED);

    expect(gateOf(itemOf(items, "credential_refused:openai-main"), items)).toBeNull();
  });

  it("gates nothing before the pause is derived", () => {
    const items = derive([snapshot([node("n1", "Paused")])]);

    expect(gateOf(itemOf(items, "paused:n1"), items)).toBeNull();
  });
});

describe("rankBoardItems and startItemOf", () => {
  const items = derive([
    snapshot([
      blocked("a", "Alpha", 300),
      blocked("b", "Beta", 100),
      blocked("c", "Gamma", null),
      blocked("d", "Delta", 100),
      blocked("e", "Alpha", 300),
    ]),
  ]);
  const none = new Map<string, readonly string[]>();
  const noGates = new Map<string, BoardGate>();
  const idsOf = (ranked: readonly AttentionItem[]) => ranked.map((item) => item.id);

  it("orders the oldest first, the unknown age last, then the subject, then the id", () => {
    expect(idsOf(rankBoardItems(items, none, noGates))).toEqual([
      "blocked:b",
      "blocked:d",
      "blocked:a",
      "blocked:e",
      "blocked:c",
    ]);
  });

  it("puts more held nodes first", () => {
    const held = new Map([
      ["blocked:a", ["a", "x"]],
      ["blocked:c", ["c", "y", "z"]],
    ]);

    expect(idsOf(rankBoardItems(items, held, noGates)).slice(0, 2)).toEqual([
      "blocked:c",
      "blocked:a",
    ]);
  });

  it("puts a gated item after an ungated one, whatever its held count", () => {
    const held = new Map([["blocked:c", ["c", "y", "z"]]]);
    const gate: BoardGate = { itemId: "x", need: "Rotate x in Fix setup", short: "Rotate x" };

    const ranked = idsOf(rankBoardItems(items, held, new Map([["blocked:c", gate]])));

    expect(ranked.at(-1)).toBe("blocked:c");
  });

  it("ranks a gated paused item after an ungated paused item", () => {
    const paused = pausedScenario(UNAUTHORIZED);
    const gated = itemOf(paused, "paused:n1");
    const gate = gateOf(gated, paused);
    if (gate === null) throw new Error("No gate.");
    const free = itemOf(derive([snapshot([blocked("late", "Late", 9_000_000)])]), "blocked:late");

    expect(idsOf(rankBoardItems([gated, free], none, noGates))).toEqual([
      "paused:n1",
      "blocked:late",
    ]);
    expect(idsOf(rankBoardItems([gated, free], none, new Map([[gated.id, gate]])))).toEqual([
      "blocked:late",
      "paused:n1",
    ]);
  });

  it("leaves the input list unchanged", () => {
    const before = idsOf(items);

    rankBoardItems(items, none, noGates);

    expect(idsOf(items)).toEqual(before);
  });

  it("starts at the first ranked item, or at null", () => {
    expect(startItemOf(rankBoardItems(items, none, noGates))?.id).toBe("blocked:b");
    expect(startItemOf([])).toBeNull();
  });
});

describe("hiddenByFilterOf", () => {
  const second = snapshot([node("n2", "Paused")], { project: OTHER });
  const first = snapshot([node("n1", "Paused")]);
  const none: AttentionDetails = new Map();
  const items = derive([first, second], none, [SESSION]);

  it("hides nothing without a filter", () => {
    expect(hiddenByFilterOf(items, none, "paused", null)).toBe(false);
  });

  it("hides the cards of another project in the tab", () => {
    expect(hiddenByFilterOf(items, none, "paused", "prj-1")).toBe(true);
    expect(hiddenByFilterOf(items, none, "outside", "prj-1")).toBe(false);
  });

  it("hides no tool approval", () => {
    expect(hiddenByFilterOf(items, none, "tool", "prj-9")).toBe(false);
  });
});

describe("isNothingAtAll", () => {
  const base = { projectId: null, view: 0, allClear: true, readFault: false };

  it("holds with no card, no filter and an all clear", () => {
    expect(isNothingAtAll(base)).toBe(true);
    expect(isNothingAtAll({ ...base, allClear: false, readFault: true })).toBe(true);
  });

  it("fails under a filter, with a card or with neither all clear nor fault", () => {
    expect(isNothingAtAll({ ...base, projectId: "prj-1" })).toBe(false);
    expect(isNothingAtAll({ ...base, view: 1 })).toBe(false);
    expect(isNothingAtAll({ ...base, allClear: false })).toBe(false);
  });
});
