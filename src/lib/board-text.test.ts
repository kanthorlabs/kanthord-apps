import { describe, expect, it } from "vitest";

import type {
  AgentSelection,
  BindingAgentView,
  EnvironmentState,
  ExecutionStop,
  InboxItem,
  MissionEvidence,
  MissionExternalAction,
  MissionFinding,
  MissionNodeRecord,
  MissionProposal,
  NodeState,
  Project,
  SchedulerExecutionRecord,
  WorkbenchSessionListItem,
  WorkerBindingRecord,
} from "@/api/types";

import {
  type AttentionDetail,
  type AttentionDetails,
  type AttentionItem,
  deriveAttention,
  detailKeyOf,
  type ProjectSnapshot,
} from "./attention";
import { BOARD_TABS } from "./board-tabs";
import { inboxItemsOf } from "./inbox-attention";
import {
  announcementOf,
  boardSummaryOf,
  cardCauseOf,
  cardLabelOf,
  detailTitleOf,
  heldText,
  leadLabelOf,
  positionText,
  tabLabelOf,
  tabSubOf,
  workforceText,
} from "./board-text";

function missionFinding(overrides: Partial<MissionFinding> = {}): MissionFinding {
  const human = overrides.source === "human";
  return {
    id: "finding_1",
    node_id: "n1",
    attempt: 1,
    round: human ? null : 2,
    assessment_id: "assessment_1",
    source: "reviewer",
    label: human ? "H1" : "S1",
    kind: "suggestion",
    action: "yes",
    task_id: null,
    ground: null,
    name: "Trim the email",
    description: "The form keeps the spaces around the email address.",
    fix: "Trim the email address before the check.",
    why: "A pasted address often holds a trailing space.",
    route: "report",
    status: "open",
    fixed_assessment_id: null,
    cause_owner: human ? "reviewer" : null,
    created_by: human ? { kind: "human", account: "ulrich", name: "Ulrich" } : null,
    created_at: 1,
    decision: null,
    decision_reason: null,
    decided_by: null,
    decided_at: null,
    ...overrides,
  };
}

const NOW = 10_000_000;
const MINUTE = 60_000;

const PROJECT: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

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

function named(base: MissionNodeRecord, name: string): MissionNodeRecord {
  return { ...base, content: { ...base.content, name } };
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
    findings: null,
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
    catalog: [],
    credentials: [],
    sessions,
  });
}

function itemOf(items: readonly AttentionItem[], id: string): AttentionItem {
  const item = items.find((candidate) => candidate.id === id);
  if (item === undefined) throw new Error(`No item ${id}.`);
  return item;
}

function selection(agent: string, credential: string): AgentSelection {
  return {
    agent_name: agent,
    position: 0,
    level: "enablement",
    agent_provider: "openai-org",
    provider: "openai-compatible",
    credential,
    model_identifier: "gpt-5",
    reasoning_effort: "off",
  };
}

function execution(nodeId: string, stop: ExecutionStop | null): SchedulerExecutionRecord {
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
    agent_selections: [selection("swe@1", "openai-main")],
    claim_state: "finished",
    expired_at: 5_000,
    created_at: 1_000,
    ended_at: 2_000,
    stop,
    trace_id: "0".repeat(32),
    root_span_id: "0".repeat(16),
  };
}

function pausedItemWith(executions: readonly SchedulerExecutionRecord[] | null): AttentionItem {
  const paused = named(node("n1", "Paused"), "Retention rule");
  const details: AttentionDetails =
    executions === null
      ? new Map()
      : new Map([
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
  return itemOf(derive([snapshot([paused])], details), "paused:n1");
}

function environment(overrides: Partial<EnvironmentState>): EnvironmentState {
  return {
    binding_id: "binding_1",
    binding_name: "engine",
    resource_identity: "repo",
    target: "image",
    source: "stored",
    status: "failed",
    digest: null,
    tag: null,
    run_started_at: null,
    step_started_at: null,
    reason: null,
    reason_started_at: null,
    failure: {
      class: "command_absent",
      origin: "onboarding",
      execution_id: null,
      command: "make",
      exit_code: 127,
      tail: "",
      reproduce: "make",
      ended_at: 1000,
    },
    checks: [],
    repairs: 0,
    repairing: false,
    ...overrides,
  };
}

function blockedNode(
  id: string,
  name: string,
  overrides: Partial<MissionNodeRecord> = {},
): MissionNodeRecord {
  return named(
    node(id, "Blocked", {
      blocked_context: {
        outcome: {
          id: `outcome_${id}`,
          node_id: id,
          attempt: 2,
          node_revision: 1,
          closing_event: "assessment-not-passed",
          result: "criterion-not-met",
          assessment_id: `assessment_${id}`,
          evidence_ids: [],
          created_at: 100,
        },
        requests: [],
      },
      ...overrides,
    }),
    name,
  );
}

function proposal(nodeId: string, id: string): MissionProposal {
  return {
    id,
    node_id: nodeId,
    attempt: 2,
    assessment_id: "assessment_1",
    content: {
      dependency_id: nodeId,
      name: "Extra",
      requirement: "",
      criterion: "",
      task: { name: "Extra", requirement: "", criterion: "", verifications: [] },
    },
    created_node_id: null,
    approved_at: null,
    rejected_at: null,
    created_at: 1,
  };
}

function blockedDetails(
  target: MissionNodeRecord,
  proposals: readonly MissionProposal[],
): AttentionDetails {
  return new Map<string, AttentionDetail>([
    [
      target.id,
      {
        kind: "blocked",
        key: detailKeyOf(target),
        assessment: { status: "ready", data: null },
        proposals: { status: "ready", data: proposals },
      },
    ],
  ]);
}

function outsideItem(kind: "merge_wait" | "delivery_unconfirmed", pullRequest: number | null) {
  const requested = named(node("n1", "External.Requested"), "Stripe webhook");
  const action: MissionExternalAction = {
    node_id: "n1",
    attempt: 2,
    action: {
      key: "repo.pull_request",
      binding_id: "binding_1",
      action: "pull_request",
      expected_end_state: "pull_request_merged",
      follows: null,
      configuration: { base_branch: "main", landing: kind === "merge_wait" ? "human" : "kanthord" },
    },
    requested: true,
    request_evidence_id: "evidence_1",
    resolution: "unresolved",
  };
  const evidence: MissionEvidence = {
    id: "evidence_1",
    node_id: "n1",
    attempt: 2,
    subject: "Request",
    assets:
      pullRequest === null
        ? []
        : [
            {
              id: "asset_1",
              published_at: null,
              expired_at: null,
              kind: "platform",
              address: {
                kind: "pull_request",
                resource_identity: "repository:github:acme/web",
                number: pullRequest,
              },
            },
          ],
    provenance: { kind: "human", account: "a", name: "A" },
    created_at: NOW - 30 * MINUTE,
  };
  const details: AttentionDetails = new Map<string, AttentionDetail>([
    [
      "n1",
      {
        kind: "external",
        key: detailKeyOf(requested),
        actions: { status: "ready", data: [action] },
        evidence: { status: "ready", data: [evidence] },
        refreshFault: null,
      },
    ],
  ]);
  return { item: itemOf(derive([snapshot([requested])], details), `${kind}:n1`), details };
}

function findingItemOf(sources: readonly ("reviewer" | "human")[]): AttentionItem {
  const findings = sources.map((source, index) =>
    missionFinding({ id: `finding_${index}`, node_id: "n1", source }),
  );
  return itemOf(
    derive([snapshot([named(node("n1", "Completed"), "Sign-up form")], { findings })]),
    "finding_review:n1",
  );
}

function followupItemOf(count: number): AttentionItem {
  const followups = Array.from({ length: count }, (_, index) => ({
    id: `followup_${index}`,
    node_id: "n1",
    attempt: 1,
    assessment_id: null,
    content: { node_revision: 2 },
    created_node_id: null,
    approved_at: null,
    rejected_at: null,
    created_at: 1,
  }));
  return itemOf(
    derive([snapshot([node("n1", "Completed")], { followups })]),
    "followup_proposal:n1",
  );
}

describe("cardCauseOf of a follow-up proposal", () => {
  it("counts the open follow-up proposals of the node", () => {
    expect(cardCauseOf(followupItemOf(1))).toBe(
      "Follow-up proposal waits for a decision · 1 proposal",
    );
    expect(cardCauseOf(followupItemOf(2))).toBe(
      "Follow-up proposal waits for a decision · 2 proposals",
    );
  });

  it("leads with Decide", () => {
    expect(leadLabelOf(followupItemOf(1), new Map())).toBe("Decide");
  });
});

describe("cardCauseOf", () => {
  it("counts the review findings and the findings after delivery of a node", () => {
    expect(cardCauseOf(findingItemOf(["reviewer", "reviewer"]))).toBe(
      "Findings wait for a decision · 2 review findings",
    );
    expect(cardCauseOf(findingItemOf(["reviewer", "human"]))).toBe(
      "Findings wait for a decision · 1 review finding · 1 found after delivery",
    );
    expect(cardCauseOf(findingItemOf(["human"]))).toBe("Found after delivery · 1 finding");
  });

  it("states the approval wait of a tool approval", () => {
    const item = itemOf(derive([], new Map(), [SESSION]), "tool_approval:s1");

    expect(cardCauseOf(item)).toBe("Waits for approval · swe@1 · project.create");
  });

  it("states the refusal of a credential and of a request", () => {
    const items = derive([
      snapshot([node("n1", "Paused"), node("n2", "Paused")], {
        executions: [
          execution("n1", { reason: "provider_failed", code: "unauthorized" }),
          execution("n2", { reason: "provider_failed", code: "bad_request" }),
        ],
      }),
    ]);

    expect(cardCauseOf(itemOf(items, "credential_refused:openai-main"))).toBe(
      "Credential refused · unauthorized",
    );
    expect(cardCauseOf(itemOf(items, "request_rejected:swe@1"))).toBe(
      "Provider rejected the request · bad request",
    );
  });

  it("states the command and the exit code of a failed environment", () => {
    const items = derive([snapshot([], { environments: [environment({})] })]);

    expect(cardCauseOf(itemOf(items, "environment_failed:prj-1:binding_1"))).toBe(
      "Environment failed · make exits 127",
    );
  });

  it("states the label alone for a failed environment with no exit code", () => {
    const failure = { ...environment({}).failure!, exit_code: null };
    const items = derive([snapshot([], { environments: [environment({ failure })] })]);

    expect(cardCauseOf(itemOf(items, "environment_failed:prj-1:binding_1"))).toBe(
      "Environment failed",
    );
  });

  it("states the binding of a waiting environment", () => {
    const waiting = environment({
      status: "pending",
      failure: null,
      reason: "Repository SSH read failed.",
      reason_started_at: NOW - 60 * MINUTE,
    });
    const items = derive([snapshot([], { environments: [waiting] })]);

    expect(cardCauseOf(itemOf(items, "environment_pending:prj-1:binding_1"))).toBe(
      "Environment waiting · engine",
    );
  });

  it("states the state of a no taker item", () => {
    const items = derive([
      snapshot([node("w", "Waiting")], {
        jobs: [
          {
            job_id: "job_1",
            project_id: PROJECT.id,
            node_id: "w",
            priority: 0,
            queued_at: NOW - 5 * MINUTE,
          },
        ],
        registrations: [],
        bindings: [],
      }),
    ]);

    expect(cardCauseOf(itemOf(items, "no_taker:prj-1:Waiting:implement:"))).toBe(
      "No taker · Waiting",
    );
  });

  it("states the first binding of an invalid agent", () => {
    const view: BindingAgentView = {
      agent: "swe@1",
      worker: "coder@1",
      worker_binding_id: "binding_coder",
      binding_set_version: 1,
      defaults: null,
      entry: null,
      effective: null,
      chain: [],
      active_position: 0,
      cooling: null,
      valid: false,
      issues: [{ path: [], code: "agent.enablement.unavailable" }],
    };
    const binding: WorkerBindingRecord = {
      id: "binding_coder-main",
      project_id: PROJECT.id,
      name: "coder-main",
      kind: "worker",
      resource_identity: "worker:kanthord:coder-main",
      revision: 1,
      config: { worker: "coder@1", worker_instances: [] },
      created_at: 1,
      removed_at: null,
    };
    const items = derive([snapshot([], { bindings: [{ binding, agents: [view] }] })]);

    expect(cardCauseOf(items[0]!)).toBe("Invalid agent configuration · coder-main");
  });

  it("states the label alone for a paused project", () => {
    const items = derive([snapshot([], { project: { ...PROJECT, paused_at: 5 } })]);

    expect(cardCauseOf(items[0]!)).toBe("Project paused");
  });

  it("states the pause label and the stop label of the newest execution", () => {
    const item = pausedItemWith([
      execution("n1", { reason: "provider_failed", code: "rate_limited" }),
    ]);

    expect(cardCauseOf(item)).toBe("Failure limit · Provider failed: rate limited");
  });

  it("states the pause label alone when the execution holds no stop", () => {
    expect(cardCauseOf(pausedItemWith([]))).toBe("Paused by a human");
  });

  it("states the state label alone before the executions are read", () => {
    expect(cardCauseOf(pausedItemWith(null))).toBe("Paused");
  });

  it("states the cause and the attempt of a blocked node", () => {
    const items = derive([snapshot([blockedNode("a", "Add reset")])]);

    expect(cardCauseOf(itemOf(items, "blocked:a"))).toBe("Criterion not met · attempt 2");
  });

  it("states the first discarded dependency", () => {
    const items = derive([
      snapshot([
        node("a", "Pending", { depends_on: ["b", "c"] }),
        named(node("b", "Discarded"), "Export CSV"),
        named(node("c", "Discarded"), "Import CSV"),
      ]),
    ]);

    expect(cardCauseOf(itemOf(items, "dependency_discarded:a"))).toBe(
      "Discarded dependency · Export CSV",
    );
  });

  it("states the pull request of an outside item when it names one", () => {
    expect(cardCauseOf(outsideItem("merge_wait", 42).item)).toBe(
      "Waits for merge · pull request #42",
    );
    expect(cardCauseOf(outsideItem("merge_wait", null).item)).toBe("Waits for merge");
    expect(cardCauseOf(outsideItem("delivery_unconfirmed", 7).item)).toBe(
      "Delivery not confirmed · pull request #7",
    );
  });
});

describe("heldText and workforceText", () => {
  it.each([
    [0, "No node waits"],
    [1, "1 node waits"],
    [4, "4 nodes wait"],
  ])("answers the held text of %i", (count, text) => {
    expect(heldText(count)).toBe(text);
  });

  it.each([
    [3, 2, "3 executions run · 2 jobs wait"],
    [1, 1, "1 execution runs · 1 job waits"],
    [0, 0, "0 executions run · 0 jobs wait"],
  ])("answers the workforce text of %i and %i", (running, waiting, text) => {
    expect(workforceText(running, waiting)).toBe(text);
  });
});

describe("boardSummaryOf", () => {
  const [tool, setup] = BOARD_TABS;
  if (tool === undefined || setup === undefined) throw new Error("No tab.");
  const start = { subject: "Retention rule", tab: setup };

  it("states the acts, the held nodes and the start", () => {
    expect(
      boardSummaryOf({ count: 3, held: 5, start, projectName: null, readFault: false, inbox: 0 }),
    ).toEqual({
      long: "3 acts wait for you. 5 nodes wait on them. Start here: Retention rule in Fix setup.",
      short: "3 acts · 5 nodes wait · Start: Retention rule",
    });
  });

  it("names the project of a filter", () => {
    expect(
      boardSummaryOf({ count: 3, held: 5, start, projectName: "atlas", readFault: false, inbox: 0 })
        .long,
    ).toBe(
      "3 acts wait for you in atlas. 5 nodes wait on them. Start here: Retention rule in Fix setup.",
    );
  });

  it("uses the singular for one act and one node", () => {
    expect(
      boardSummaryOf({ count: 1, held: 1, start, projectName: null, readFault: false, inbox: 0 }),
    ).toEqual({
      long: "1 act waits for you. 1 node waits on them. Start here: Retention rule in Fix setup.",
      short: "1 act · 1 node waits · Start: Retention rule",
    });
  });

  it("states that nothing waits in the project of a filter", () => {
    const text = "Nothing waits for you in atlas.";

    expect(
      boardSummaryOf({
        count: 0,
        held: 0,
        start: null,
        projectName: "atlas",
        readFault: true,
        inbox: 0,
      }),
    ).toEqual({ long: text, short: text });
  });

  it("states the read fault when no card exists", () => {
    const text = "No act found. Some records could not be read.";

    expect(
      boardSummaryOf({
        count: 0,
        held: 0,
        start: null,
        projectName: null,
        readFault: true,
        inbox: 0,
      }),
    ).toEqual({ long: text, short: text });
  });

  it("states that no decision waits", () => {
    const text = "No decision waits for you.";

    expect(
      boardSummaryOf({
        count: 0,
        held: 0,
        start: null,
        projectName: null,
        readFault: false,
        inbox: 0,
      }),
    ).toEqual({ long: text, short: text });
  });
});

describe("tab texts", () => {
  const [tool, setup] = BOARD_TABS;
  if (tool === undefined || setup === undefined) throw new Error("No tab.");

  it("labels a tab with its name and its acts", () => {
    expect(tabLabelOf(setup, 3, false)).toBe("Fix setup, 3 acts");
    expect(tabLabelOf(setup, 1, false)).toBe("Fix setup, 1 act");
    expect(tabLabelOf(setup, 0, false)).toBe("Fix setup, 0 acts, clear");
  });

  it("labels the tool tab under a filter with all projects", () => {
    expect(tabLabelOf(tool, 2, true)).toBe("Approve tool, 2 acts, all projects");
    expect(tabLabelOf(tool, 0, true)).toBe("Approve tool, 0 acts, all projects, clear");
    expect(tabLabelOf(setup, 2, true)).toBe("Fix setup, 2 acts");
  });

  it("states clear for zero and the held text otherwise", () => {
    expect(tabSubOf(setup, 0, 0, false)).toBe("clear");
    expect(tabSubOf(setup, 1, 1, false)).toBe("1 node waits");
    expect(tabSubOf(setup, 4, 2, false)).toBe("4 nodes wait");
    expect(tabSubOf(setup, 0, 2, false)).toBe("No node waits");
  });

  it("starts the sub text of the tool tab under a filter with all projects", () => {
    expect(tabSubOf(tool, 0, 2, true)).toBe("all projects · No node waits");
    expect(tabSubOf(tool, 0, 0, true)).toBe("all projects · clear");
    expect(tabSubOf(setup, 3, 2, true)).toBe("3 nodes wait");
  });

  it("states the position of a card", () => {
    expect(positionText(0, 5)).toBe("1 of 5");
    expect(positionText(4, 5)).toBe("5 of 5");
  });
});

describe("detailTitleOf", () => {
  const none: AttentionDetails = new Map();

  it("titles a finding item with the node and the cause", () => {
    expect(detailTitleOf(findingItemOf(["reviewer"]), none)).toBe(
      "Sign-up form: findings wait for a decision",
    );
    expect(detailTitleOf(findingItemOf(["human"]), none)).toBe(
      "Sign-up form: found after delivery",
    );
  });

  it("titles a tool approval with the agent and the operation", () => {
    const item = itemOf(derive([], none, [SESSION]), "tool_approval:s1");

    expect(detailTitleOf(item, none)).toBe("swe@1 asks to run project.create");
  });

  it("titles a refused credential", () => {
    const items = derive([
      snapshot([node("n1", "Paused")], {
        executions: [execution("n1", { reason: "provider_failed", code: "unauthorized" })],
      }),
    ]);

    expect(detailTitleOf(itemOf(items, "credential_refused:openai-main"), none)).toBe(
      "Provider refuses credential openai-main",
    );
  });

  it("titles a failed environment with its binding", () => {
    const items = derive([snapshot([], { environments: [environment({})] })]);

    expect(detailTitleOf(itemOf(items, "environment_failed:prj-1:binding_1"), none)).toBe(
      "Environment engine failed",
    );
  });

  it("titles a merge wait with its pull request", () => {
    const { item, details } = outsideItem("merge_wait", 42);

    expect(detailTitleOf(item, details)).toBe("PR #42 waits for your merge");
  });

  it("titles a merge wait with no pull request by subject and cause", () => {
    const { item, details } = outsideItem("merge_wait", null);

    expect(detailTitleOf(item, details)).toBe("Stripe webhook: waits for merge");
  });

  it("titles a paused node with its lower case pause label", () => {
    const item = pausedItemWith([
      execution("n1", { reason: "provider_failed", code: "rate_limited" }),
    ]);

    expect(detailTitleOf(item, none)).toBe("Retention rule: failure limit");
  });

  it("titles a blocked node with its lower case cause", () => {
    const items = derive([snapshot([blockedNode("a", "Add reset")])]);

    expect(detailTitleOf(itemOf(items, "blocked:a"), none)).toBe("Add reset: criterion not met");
  });

  it("adds the count of open proposals to a blocked node", () => {
    const examine = blockedNode("e", "Review", { intent: "examine" });
    const one = blockedDetails(examine, [proposal("e", "p1")]);
    const two = blockedDetails(examine, [proposal("e", "p1"), proposal("e", "p2")]);

    expect(detailTitleOf(itemOf(derive([snapshot([examine])], one), "blocked:e"), one)).toBe(
      "Review: criterion not met, 1 proposal",
    );
    expect(detailTitleOf(itemOf(derive([snapshot([examine])], two), "blocked:e"), two)).toBe(
      "Review: criterion not met, 2 proposals",
    );
  });

  it("adds no count when no proposal is open", () => {
    const examine = blockedNode("e", "Review", { intent: "examine" });
    const details = blockedDetails(examine, []);

    expect(
      detailTitleOf(itemOf(derive([snapshot([examine])], details), "blocked:e"), details),
    ).toBe("Review: criterion not met");
  });

  it("titles every other kind with the subject and the lower case cause", () => {
    const paused = itemOf(
      derive([snapshot([], { project: { ...PROJECT, paused_at: 5 } })]),
      "project_paused:prj-1",
    );
    const dependency = itemOf(
      derive([snapshot([node("a", "Pending", { depends_on: ["b"] }), node("b", "Discarded")])]),
      "dependency_discarded:a",
    );

    expect(detailTitleOf(paused, none)).toBe("atlas: project paused");
    expect(detailTitleOf(dependency, none)).toBe("Node a: discarded dependency");
  });
});

describe("leadLabelOf", () => {
  const none: AttentionDetails = new Map();

  it("leads a paused node with Resume", () => {
    expect(leadLabelOf(pausedItemWith(null), none)).toBe("Resume");
  });

  it("leads a blocked node with Decide in the proposal tab and Unblock otherwise", () => {
    const examine = blockedNode("e", "Review", { intent: "examine" });
    const details = blockedDetails(examine, [proposal("e", "p1")]);
    const proposed = itemOf(derive([snapshot([examine])], details), "blocked:e");
    const rule = itemOf(derive([snapshot([blockedNode("a", "Add reset")])]), "blocked:a");

    expect(leadLabelOf(proposed, details)).toBe("Decide");
    expect(leadLabelOf(rule, none)).toBe("Unblock");
  });

  it("leads a discarded dependency with Remove dependency", () => {
    const items = derive([
      snapshot([node("a", "Pending", { depends_on: ["b"] }), node("b", "Discarded")]),
    ]);

    expect(leadLabelOf(itemOf(items, "dependency_discarded:a"), none)).toBe("Remove dependency");
  });

  it("leads a finding item with Decide", () => {
    expect(leadLabelOf(findingItemOf(["reviewer"]), none)).toBe("Decide");
  });

  it("leads an outside item with Check now", () => {
    expect(leadLabelOf(outsideItem("merge_wait", 42).item, none)).toBe("Check now");
    expect(leadLabelOf(outsideItem("delivery_unconfirmed", 7).item, none)).toBe("Check now");
  });

  it("leads a tool approval with Open chat", () => {
    const item = itemOf(derive([], none, [SESSION]), "tool_approval:s1");

    expect(leadLabelOf(item, none)).toBe("Open chat");
  });

  it("leads a paused project with Resume project", () => {
    const items = derive([snapshot([], { project: { ...PROJECT, paused_at: 5 } })]);

    expect(leadLabelOf(itemOf(items, "project_paused:prj-1"), none)).toBe("Resume project");
  });

  it("leads a refused credential with its fix link", () => {
    const items = derive([
      snapshot([node("n1", "Paused")], {
        executions: [execution("n1", { reason: "provider_failed", code: "unauthorized" })],
      }),
    ]);

    expect(leadLabelOf(itemOf(items, "credential_refused:openai-main"), none)).toBe(
      "Open credential",
    );
  });
});

describe("announcementOf", () => {
  const input = {
    gone: false,
    expanded: false,
    open: true,
    subject: "Add reset",
    position: 1,
    total: 4,
  };

  it("announces the open card with its position", () => {
    expect(announcementOf(input)).toBe("Add reset, 2 of 4.");
  });

  it("announces a gone item first", () => {
    expect(announcementOf({ ...input, gone: true, expanded: true })).toBe(
      "The selected item no longer waits.",
    );
  });

  it("announces nothing in the pane, with no open card or with no position", () => {
    expect(announcementOf({ ...input, expanded: true })).toBe("");
    expect(announcementOf({ ...input, open: false })).toBe("");
    expect(announcementOf({ ...input, position: null })).toBe("");
    expect(announcementOf({ ...input, subject: null })).toBe("");
  });
});

describe("inbox card texts", () => {
  const thread: InboxItem = {
    link_update_id: "link_update_1",
    project_id: "prj-1",
    external_link: {
      kind: "github_issue",
      resource_identity: "conversation:github:acme/shop",
      number: 42,
    },
    reason: "mentioned",
    state: "open",
    occurred_at: 1_000,
    done_at: null,
    snoozed_until: null,
    inbound_event_id: "event_1",
    actor_id: "actor_1",
    trusted: true,
    linked_node_ids: [],
    content: { author: "ulrich", body: "Can you look?\nThanks", url: "https://x", occurred_at: 1 },
  };
  const itemOf = (overrides: Partial<InboxItem> = {}): AttentionItem => {
    const [item] = inboxItemsOf([{ ...thread, ...overrides }], [PROJECT]);
    if (item === undefined) throw new Error("No item.");
    return item;
  };

  it("holds the group label, the author and the first line of the body", () => {
    expect(cardCauseOf(itemOf())).toBe("Mentions you · ulrich: Can you look?");
  });

  it("labels an untrusted thread and no other", () => {
    expect(cardLabelOf(itemOf({ trusted: false }))).toBe("not trusted");
    expect(cardLabelOf(itemOf())).toBeNull();
  });

  it("leads with Mark done", () => {
    expect(leadLabelOf(itemOf(), new Map())).toBe("Mark done");
  });

  it("titles the detail with the subject", () => {
    expect(detailTitleOf(itemOf(), new Map())).toBe("acme/shop#42");
  });
});

describe("boardSummaryOf with inbox threads", () => {
  const [tool] = BOARD_TABS;
  if (tool === undefined) throw new Error("No tab.");
  const start = { subject: "Retention rule", tab: tool };

  it("adds the threads to the long text and the inbox count to the short text", () => {
    expect(
      boardSummaryOf({ count: 3, held: 5, start, projectName: null, readFault: false, inbox: 4 }),
    ).toEqual({
      long: "3 acts wait for you. 5 nodes wait on them. Start here: Retention rule in Approve tool. 4 threads wait in Inbox.",
      short: "3 acts · 5 nodes wait · Start: Retention rule · 4 inbox",
    });
  });

  it("uses the singular for one thread", () => {
    expect(
      boardSummaryOf({ count: 1, held: 0, start, projectName: null, readFault: false, inbox: 1 })
        .long,
    ).toContain("1 thread waits in Inbox.");
  });
});
