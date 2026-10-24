import { describe, expect, it } from "vitest";

import type {
  AgentSelection,
  BindingAgentView,
  Credential,
  EnvironmentState,
  EnvironmentStatus,
  ExecutionStop,
  MissionNodeRecord,
  NodeState,
  Project,
  SchedulerExecutionRecord,
  SchedulerJob,
  WorkerBindingRecord,
  WorkerCatalogItem,
  WorkerRegistrationRecord,
  WorkerPlacement,
} from "@/api/types";

import type { AttentionContext, ProjectSnapshot, WorkerBindingView } from "./attention";
import { fixItemsOf, fixTargetOf, spreadTextOf } from "./fix-attention";
import { newUlid } from "./ulid";

const NOW = 1_000_000_000_000;
const MINUTE = 60_000;
const FIRST_JOB_AGE_MS = 86_400_000;

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

const PROJECT: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
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
    intent: "implement",
    tags: [],
    tasks: [],
    state,
    attempt: 1,
    priority: 0,
    depends_on: [],
    ...overrides,
  } as MissionNodeRecord;
}

function job(nodeId: string, ageMs: number): SchedulerJob {
  return {
    job_id: `job_${newUlid(NOW - FIRST_JOB_AGE_MS)}`,
    project_id: PROJECT.id,
    node_id: nodeId,
    priority: 0,
    queued_at: NOW - ageMs,
  };
}

function registration(
  binding: string,
  workerName: string,
  draining = false,
): WorkerRegistrationRecord {
  return {
    runtime_identity: `worker_registration_${binding}`,
    project_id: PROJECT.id,
    resource_identity: `worker:kanthord:${binding}`,
    worker_name: workerName,
    host: "kanthord",
    placement: "server",
    activity: "idle",
    draining,
    registered: true,
  };
}

function agentView(agent: string, overrides: Partial<BindingAgentView> = {}): BindingAgentView {
  return {
    agent,
    worker: "coder@1",
    worker_binding_id: "binding_coder",
    binding_set_version: 1,
    defaults: null,
    entry: null,
    effective: null,
    chain: [],
    active_position: 0,
    cooling: null,
    valid: true,
    issues: [],
    ...overrides,
  };
}

function bindingView(
  name: string,
  worker: string,
  placement?: WorkerPlacement,
  agents: readonly BindingAgentView[] | null = [],
  tags?: readonly string[],
): WorkerBindingView {
  const binding: WorkerBindingRecord = {
    id: `binding_${name}`,
    project_id: PROJECT.id,
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
  return { binding, agents };
}

function selection(agentName: string, credential: string): AgentSelection {
  return {
    agent_name: agentName,
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
  id: string,
  nodeId: string,
  endedAt: number,
  stop: ExecutionStop | null,
  selections: readonly AgentSelection[] = [selection("swe@1", "openai-main")],
): SchedulerExecutionRecord {
  return {
    execution_id: id,
    project_id: PROJECT.id,
    node_id: nodeId,
    claimant: {
      worker_binding_id: "binding_coder",
      resource_identity: "worker:kanthord:coder-main",
      runtime_identity: "worker_registration_01",
    },
    attempt: 1,
    pinned_revision: 1,
    node_branch: `kanthord/${nodeId}`,
    credentials: [],
    agent_selections: selections,
    claim_state: "finished",
    expired_at: endedAt + MINUTE,
    created_at: endedAt - MINUTE,
    ended_at: endedAt,
    stop,
    trace_id: "0".repeat(32),
    root_span_id: "0".repeat(16),
  };
}

function snapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    project: PROJECT,
    missionVersion: 1,
    nodes: [],
    jobs: [],
    registrations: [],
    executions: [],
    bindings: [],
    environments: null,
    ...overrides,
  };
}

function context(overrides: Partial<AttentionContext> = {}): AttentionContext {
  return { now: NOW, catalog: CATALOG, credentials: [], sessions: null, ...overrides };
}

function credential(name: string, revisions: Credential["revisions"]): Credential {
  return {
    name,
    platform: "openai-compatible",
    holder: "server",
    sealed_to: null,
    sealed_current: true,
    revisions,
  };
}

function revision(createdAt: number, endedAt: number | null = null) {
  return {
    id: `credential_${createdAt}`,
    revision: 1,
    metadata: null,
    created_at: createdAt,
    ended_at: endedAt,
  };
}

const UNAUTHORIZED: ExecutionStop = { reason: "provider_failed", code: "unauthorized" };
const BAD_REQUEST: ExecutionStop = { reason: "provider_failed", code: "bad_request" };

describe("fixItemsOf project_paused", () => {
  it("lists a paused project with its pause time", () => {
    const paused = { ...PROJECT, paused_at: NOW - 5 * MINUTE };

    const [item] = fixItemsOf([snapshot({ project: paused })], context());

    expect(item).toMatchObject({
      id: "project_paused:prj-1",
      kind: "project_paused",
      group: "fixes",
      cause: "Project paused",
      subject: "atlas",
      at: NOW - 5 * MINUTE,
    });
  });

  it("lists nothing for an active project", () => {
    expect(fixItemsOf([snapshot()], context())).toEqual([]);
  });
});

describe("fixItemsOf no_taker", () => {
  const waiting = node("w", "Waiting");
  const reviewer = bindingView("reviewer-main", "reviewer@1", "server");

  it("lists a state that no live registration declares once the oldest job is older than 60 s", () => {
    const items = fixItemsOf(
      [
        snapshot({
          nodes: [waiting, node("w2", "Waiting")],
          jobs: [job("w", 61_000), job("w2", 120_000)],
          bindings: [reviewer],
        }),
      ],
      context(),
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "no_taker:prj-1:Waiting:implement:",
      kind: "no_taker",
      cause: "No taker",
      subject: "Implement jobs in state Waiting",
      state: "Waiting",
      intent: "implement",
      tags: [],
      jobCount: 2,
      at: NOW - 120_000,
      hint: { kind: "server", binding: "reviewer-main", worker: "reviewer@1" },
    });
  });

  it("lists nothing while the oldest job is 60 s old or younger", () => {
    const items = fixItemsOf(
      [snapshot({ nodes: [waiting], jobs: [job("w", 60_000)], bindings: [reviewer] })],
      context(),
    );

    expect(items).toEqual([]);
  });

  it("lists one item for each uncovered state", () => {
    const items = fixItemsOf(
      [
        snapshot({
          nodes: [waiting, node("x", "External.Requested")],
          jobs: [job("w", 5 * MINUTE), job("x", 5 * MINUTE)],
          bindings: [reviewer],
        }),
      ],
      context(),
    );

    expect(items.map((item) => item.id).sort()).toEqual([
      "no_taker:prj-1:External.Requested:implement:",
      "no_taker:prj-1:Waiting:implement:",
    ]);
  });

  it("lists one item for each tag set of one state, each with its own hint and count", () => {
    const items = fixItemsOf(
      [
        snapshot({
          nodes: [
            node("m", "Available", { tags: ["platform.macos"] }),
            node("l", "Available", { tags: ["platform.linux"] }),
            node("l2", "Available", { tags: ["platform.linux"] }),
          ],
          jobs: [job("m", 5 * MINUTE), job("l", 5 * MINUTE), job("l2", 4 * MINUTE)],
          bindings: [
            bindingView("coder-mac", "coder@1", "worker", [], ["platform.macos"]),
            bindingView("coder-linux", "coder@1", "server", [], ["platform.linux"]),
          ],
        }),
      ],
      context(),
    );

    expect(items).toHaveLength(2);
    expect(items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "no_taker:prj-1:Available:implement:platform.macos",
          tags: ["platform.macos"],
          jobCount: 1,
          hint: { kind: "worker", binding: "coder-mac", worker: "coder@1" },
        }),
        expect.objectContaining({
          id: "no_taker:prj-1:Available:implement:platform.linux",
          tags: ["platform.linux"],
          jobCount: 2,
          hint: { kind: "server", binding: "coder-linux", worker: "coder@1" },
        }),
      ]),
    );
  });

  it("names a hint of the worker placement when the binding sets no placement", () => {
    const [item] = fixItemsOf(
      [
        snapshot({
          nodes: [waiting],
          jobs: [job("w", 5 * MINUTE)],
          bindings: [bindingView("reviewer-main", "reviewer@1")],
        }),
      ],
      context(),
    );

    expect(item).toMatchObject({ hint: { kind: "worker", binding: "reviewer-main" } });
  });

  it("names no binding when no binding declares the state", () => {
    const [item] = fixItemsOf(
      [
        snapshot({
          nodes: [waiting],
          jobs: [job("w", 5 * MINUTE)],
          bindings: [bindingView("general-main", "coder@1")],
        }),
      ],
      context(),
    );

    expect(item).toMatchObject({ hint: { kind: "none" } });
  });

  it("lists nothing when a live registration declares the state, and lists it for a draining one", () => {
    const base = { nodes: [waiting], jobs: [job("w", 5 * MINUTE)], bindings: [reviewer] };

    expect(
      fixItemsOf(
        [snapshot({ ...base, registrations: [registration("reviewer-main", "reviewer@1")] })],
        context(),
      ),
    ).toEqual([]);
    expect(
      fixItemsOf(
        [snapshot({ ...base, registrations: [registration("reviewer-main", "reviewer@1", true)] })],
        context(),
      ),
    ).toHaveLength(1);
  });

  it("names the binding whose tags hold the tags of the stuck node", () => {
    const mac = node("m", "Available", { tags: ["platform.macos"] });
    const [item] = fixItemsOf(
      [
        snapshot({
          nodes: [mac],
          jobs: [job("m", 5 * MINUTE)],
          registrations: [registration("coder-main", "coder@1")],
          bindings: [
            bindingView("coder-main", "coder@1", "server"),
            bindingView("coder-mac", "coder@1", "worker", [], ["platform.macos"]),
          ],
        }),
      ],
      context(),
    );

    expect(item).toMatchObject({
      id: "no_taker:prj-1:Available:implement:platform.macos",
      hint: { kind: "worker", binding: "coder-mac", worker: "coder@1" },
    });
  });

  it("lists nothing for a paused project", () => {
    const items = fixItemsOf(
      [
        snapshot({
          project: { ...PROJECT, paused_at: 1 },
          nodes: [waiting],
          jobs: [job("w", 5 * MINUTE)],
          bindings: [reviewer],
        }),
      ],
      context(),
    );

    expect(items.map((item) => item.kind)).toEqual(["project_paused"]);
  });

  it("lists nothing while a source is unread", () => {
    const base = { nodes: [waiting], jobs: [job("w", 5 * MINUTE)], bindings: [reviewer] };

    expect(fixItemsOf([snapshot({ ...base, jobs: null })], context())).toEqual([]);
    expect(fixItemsOf([snapshot({ ...base, registrations: null })], context())).toEqual([]);
    expect(fixItemsOf([snapshot({ ...base, bindings: null })], context())).toEqual([]);
    expect(fixItemsOf([snapshot(base)], context({ catalog: null }))).toEqual([]);
  });
});

describe("fixItemsOf agent_invalid", () => {
  it("lists an invalid agent view of a worker binding with its issue codes", () => {
    const invalid = agentView("swe@1", {
      valid: false,
      issues: [{ path: [], code: "agent.enablement.unavailable" }],
    });

    const items = fixItemsOf(
      [
        snapshot({
          bindings: [bindingView("coder-main", "coder@1", undefined, [invalid, agentView("re@1")])],
        }),
      ],
      context(),
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: "agent_invalid:swe@1:agent.enablement.unavailable",
      kind: "agent_invalid",
      cause: "Invalid agent configuration",
      subject: "swe@1",
      agent: "swe@1",
      bindings: [{ binding: "coder-main", project: "atlas" }],
      issues: ["agent.enablement.unavailable"],
      count: 1,
      projectCount: 1,
      at: null,
    });
  });

  it("lists one item for an agent and its issue codes across bindings and projects", () => {
    const invalid = agentView("swe@1", {
      valid: false,
      issues: [{ path: [], code: "agent.enablement.unavailable" }],
    });
    const other = { ...PROJECT, id: "prj-2", name: "beta" };

    const items = fixItemsOf(
      [
        snapshot({
          bindings: [
            bindingView("coder-main", "coder@1", undefined, [invalid]),
            bindingView("coder-extra", "coder@1", undefined, [invalid]),
          ],
        }),
        snapshot({
          project: other,
          bindings: [bindingView("coder-main", "coder@1", undefined, [invalid])],
        }),
      ],
      context(),
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "agent_invalid",
      bindings: [
        { binding: "coder-main", project: "atlas" },
        { binding: "coder-extra", project: "atlas" },
        { binding: "coder-main", project: "beta" },
      ],
      count: 3,
      projectCount: 2,
    });
  });

  it("lists an item for each set of issue codes of an agent", () => {
    const unavailable = agentView("swe@1", {
      valid: false,
      issues: [{ path: [], code: "agent.enablement.unavailable" }],
    });
    const missing = agentView("swe@1", {
      valid: false,
      issues: [{ path: [], code: "agent.provider.missing" }],
    });

    const items = fixItemsOf(
      [
        snapshot({
          bindings: [
            bindingView("coder-main", "coder@1", undefined, [unavailable]),
            bindingView("coder-extra", "coder@1", undefined, [missing]),
          ],
        }),
      ],
      context(),
    );

    expect(items.map((item) => item.id).sort()).toEqual([
      "agent_invalid:swe@1:agent.enablement.unavailable",
      "agent_invalid:swe@1:agent.provider.missing",
    ]);
  });

  it("lists nothing while the agent views are unread", () => {
    expect(
      fixItemsOf(
        [snapshot({ bindings: [bindingView("coder-main", "coder@1", undefined, null)] })],
        context(),
      ),
    ).toEqual([]);
  });
});

describe("fixItemsOf credential_refused", () => {
  const END = NOW - 30 * MINUTE;
  const work = node("n1", "Executing", {
    content: { ...node("n1", "Paused").content, name: "Add reset" },
  });

  function refused(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
    return snapshot({
      nodes: [work],
      executions: [execution("execution_1", "n1", END, UNAUTHORIZED)],
      ...overrides,
    });
  }

  it("lists a credential that the provider refused, aged by the end of the execution", () => {
    const [item] = fixItemsOf(
      [refused()],
      context({ credentials: [credential("openai-main", [revision(1)])] }),
    );

    expect(item).toMatchObject({
      id: "credential_refused:openai-main",
      kind: "credential_refused",
      cause: "Credential refused",
      subject: "openai-main",
      credential: "openai-main",
      credentials: ["openai-main"],
      nodeName: "Add reset",
      count: 1,
      projectCount: 1,
      at: END,
    });
  });

  it("clears after a live revision that postdates the end", () => {
    const rotated = credential("openai-main", [revision(1, END + 1), revision(END + 1)]);

    expect(fixItemsOf([refused()], context({ credentials: [rotated] }))).toEqual([]);
  });

  it("judges the refusals after the rotation and ignores the ones before it", () => {
    const later = node("n2", "Waiting", { content: { ...work.content, name: "Add export" } });
    const rotated = credential("openai-main", [revision(1, END), revision(END)]);
    const items = fixItemsOf(
      [
        refused({
          nodes: [work, later],
          executions: [
            execution("execution_1", "n1", END - 10 * MINUTE, UNAUTHORIZED),
            execution("execution_2", "n2", END + 10 * MINUTE, UNAUTHORIZED),
          ],
        }),
      ],
      context({ credentials: [rotated] }),
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ at: END + 10 * MINUTE, nodeName: "Add export" });
  });

  it("keeps the item when the new revision predates the end or is no longer live", () => {
    const older = credential("openai-main", [revision(END - 1)]);
    const revoked = credential("openai-main", [revision(END + 1, END + 2)]);

    expect(fixItemsOf([refused()], context({ credentials: [older] }))).toHaveLength(1);
    expect(fixItemsOf([refused()], context({ credentials: [revoked] }))).toHaveLength(1);
  });

  it("keeps the item for a credential that the list omits", () => {
    expect(fixItemsOf([refused()], context({ credentials: [] }))).toHaveLength(1);
  });

  it("lists nothing while the credentials are unread", () => {
    expect(fixItemsOf([refused()], context({ credentials: null }))).toEqual([]);
  });

  it("names every credential of the selections for each credential item", () => {
    const several = refused({
      executions: [
        execution("execution_1", "n1", END, UNAUTHORIZED, [
          selection("swe@1", "openai-main"),
          selection("re@1", "atlas-router"),
        ]),
      ],
    });

    const items = fixItemsOf([several], context());

    expect(items.map((item) => item.id).sort()).toEqual([
      "credential_refused:atlas-router",
      "credential_refused:openai-main",
    ]);
    expect(items[0]).toMatchObject({ credentials: ["openai-main", "atlas-router"] });
  });

  it("lists one item for a credential across nodes and takes the oldest end", () => {
    const second = node("n2", "Waiting", { content: { ...work.content, name: "Add export" } });
    const items = fixItemsOf(
      [
        refused({
          nodes: [work, second],
          executions: [
            execution("execution_1", "n1", END, UNAUTHORIZED),
            execution("execution_2", "n2", END - 10 * MINUTE, UNAUTHORIZED),
          ],
        }),
      ],
      context(),
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      at: END - 10 * MINUTE,
      nodeName: "Add export",
      count: 2,
      projectCount: 1,
    });
  });

  it("counts the projects of the nodes that the provider refused", () => {
    const other = { ...PROJECT, id: "prj-2", name: "beta" };
    const second = node("n2", "Waiting", { content: { ...work.content, name: "Add export" } });

    const [item] = fixItemsOf(
      [
        refused(),
        snapshot({
          project: other,
          nodes: [second],
          executions: [execution("execution_2", "n2", END + MINUTE, UNAUTHORIZED)],
        }),
      ],
      context(),
    );

    expect(item).toMatchObject({ project: PROJECT, count: 2, projectCount: 2 });
  });

  it("judges by the execution that ended last", () => {
    const items = fixItemsOf(
      [
        refused({
          executions: [
            execution("execution_1", "n1", END, UNAUTHORIZED),
            execution("execution_2", "n1", END + MINUTE, null),
          ],
        }),
      ],
      context(),
    );

    expect(items).toEqual([]);
  });

  it("skips a terminal node, a retired node and another stop code", () => {
    expect(fixItemsOf([refused({ nodes: [node("n1", "Completed")] })], context())).toEqual([]);
    expect(
      fixItemsOf([refused({ nodes: [node("n1", "Paused", { retired_at: 3 })] })], context()),
    ).toEqual([]);
    expect(
      fixItemsOf(
        [refused({ executions: [execution("execution_1", "n1", END, BAD_REQUEST)] })],
        context(),
      ).map((item) => item.kind),
    ).toEqual(["request_rejected"]);
  });

  it("ignores an execution without an end", () => {
    const running: SchedulerExecutionRecord = {
      ...execution("execution_1", "n1", END, UNAUTHORIZED),
      ended_at: null,
      claim_state: "running",
    };

    expect(fixItemsOf([refused({ executions: [running] })], context())).toEqual([]);
  });
});

describe("fixItemsOf request_rejected", () => {
  const END = NOW - 10 * MINUTE;
  const work = node("n1", "Waiting", {
    content: { ...node("n1", "Paused").content, name: "Add reset" },
  });

  it("lists each agent of the selections once, aged by the end of the execution", () => {
    const items = fixItemsOf(
      [
        snapshot({
          nodes: [work],
          executions: [
            execution("execution_1", "n1", END, BAD_REQUEST, [
              selection("swe@1", "openai-main"),
              selection("re@1", "atlas-router"),
            ]),
          ],
        }),
      ],
      context(),
    );

    expect(items.map((item) => item.id).sort()).toEqual([
      "request_rejected:re@1",
      "request_rejected:swe@1",
    ]);
    expect(items[0]).toMatchObject({
      kind: "request_rejected",
      cause: "Provider rejected the request",
      nodeName: "Add reset",
      at: END,
    });
  });

  it("clears when a later execution ends without the stop", () => {
    const items = fixItemsOf(
      [
        snapshot({
          nodes: [work],
          executions: [
            execution("execution_1", "n1", END, BAD_REQUEST),
            execution("execution_2", "n1", END + MINUTE, { reason: "budget_end", code: "turns" }),
          ],
        }),
      ],
      context(),
    );

    expect(items).toEqual([]);
  });

  it("clears when the node becomes terminal", () => {
    expect(
      fixItemsOf(
        [
          snapshot({
            nodes: [node("n1", "Discarded")],
            executions: [execution("execution_1", "n1", END, BAD_REQUEST)],
          }),
        ],
        context(),
      ),
    ).toEqual([]);
  });

  it("lists nothing while the executions are unread", () => {
    expect(fixItemsOf([snapshot({ nodes: [work], executions: null })], context())).toEqual([]);
  });
});

describe("spreadTextOf", () => {
  const END = NOW - 10 * MINUTE;
  const work = node("n1", "Waiting");

  function rejectedIn(projects: readonly Project[]) {
    return fixItemsOf(
      projects.map((project) =>
        snapshot({
          project,
          nodes: [work],
          executions: [execution("execution_1", "n1", END, BAD_REQUEST)],
        }),
      ),
      context(),
    );
  }

  it("states the count of nodes and projects", () => {
    const second = { ...PROJECT, id: "prj-2", name: "beta" };
    const third = { ...PROJECT, id: "prj-3", name: "gamma" };

    expect(spreadTextOf(rejectedIn([PROJECT, second, third])[0]!)).toBe("3 nodes in 3 projects");
  });

  it("states nothing for one node in one project", () => {
    expect(spreadTextOf(rejectedIn([PROJECT])[0]!)).toBeNull();
  });

  it("states nothing for a paused project", () => {
    const [item] = fixItemsOf([snapshot({ project: { ...PROJECT, paused_at: 5 } })], context());

    expect(spreadTextOf(item!)).toBeNull();
  });
});

describe("fixTargetOf", () => {
  const [paused] = fixItemsOf([snapshot({ project: { ...PROJECT, paused_at: 1 } })], context());
  const [noTaker] = fixItemsOf(
    [snapshot({ nodes: [node("w", "Waiting")], jobs: [job("w", 5 * MINUTE)] })],
    context(),
  );
  const [invalid] = fixItemsOf(
    [
      snapshot({
        bindings: [
          bindingView("coder-main", "coder@1", undefined, [agentView("swe@1", { valid: false })]),
        ],
      }),
    ],
    context(),
  );
  const [refused] = fixItemsOf(
    [
      snapshot({
        nodes: [node("n1", "Paused")],
        executions: [execution("execution_1", "n1", NOW - MINUTE, UNAUTHORIZED)],
      }),
    ],
    context(),
  );
  const [rejected] = fixItemsOf(
    [
      snapshot({
        nodes: [node("n1", "Paused")],
        executions: [execution("execution_1", "n1", NOW - MINUTE, BAD_REQUEST)],
      }),
    ],
    context(),
  );

  it.each([
    ["project", paused, "/projects/prj-1", "Open project"],
    ["bindings", noTaker, "/projects/prj-1?tab=bindings", "Open bindings"],
    ["agent", invalid, "/agents/swe%401", "Open agent"],
    ["credential", refused, "/llm/openai-main", "Open credential"],
    ["rejected agent", rejected, "/agents/swe%401", "Open agent"],
  ])("links a %s item to its owner screen", (_name, item, path, label) => {
    expect(item).toBeDefined();
    if (item === undefined) return;
    expect(fixTargetOf(item)).toEqual({ path, label });
  });
});

function environment(status: EnvironmentStatus, endedAt: number | null): EnvironmentState {
  return {
    binding_id: "binding_1",
    binding_name: "engine",
    resource_identity: "repo",
    target: "image",
    source: "stored",
    status,
    digest: null,
    tag: null,
    run_started_at: null,
    step_started_at: null,
    reason: null,
    reason_started_at: null,
    failure:
      endedAt === null
        ? null
        : {
            class: "command_absent",
            origin: "onboarding",
            execution_id: null,
            command: "make",
            exit_code: 127,
            tail: "",
            reproduce: "make",
            ended_at: endedAt,
          },
    checks: [],
    repairs: 0,
    repairing: false,
  };
}

describe("fixItemsOf environment_failed", () => {
  it("lists a failed environment with its class and end time", () => {
    const [item] = fixItemsOf(
      [snapshot({ environments: [environment("failed", 1000)] })],
      context(),
    );

    expect(item).toMatchObject({
      id: "environment_failed:prj-1:binding_1",
      kind: "environment_failed",
      group: "fixes",
      cause: "Environment failed",
      subject: "engine",
      binding: "engine",
      at: 1000,
      failureClass: "command_absent",
    });
  });

  it("lists nothing for a ready, building or none environment", () => {
    const states = [
      environment("ready", null),
      environment("building", null),
      environment("none", null),
    ];

    expect(fixItemsOf([snapshot({ environments: states })], context())).toEqual([]);
  });

  it("lists nothing when the environments are unread", () => {
    expect(fixItemsOf([snapshot({ environments: null })], context())).toEqual([]);
  });

  it("targets the project page and has no spread text", () => {
    const [item] = fixItemsOf(
      [snapshot({ environments: [environment("failed", 1000)] })],
      context(),
    );
    if (item === undefined) throw new Error("No item.");

    expect(fixTargetOf(item)).toEqual({ path: "/projects/prj-1", label: "Open project" });
    expect(spreadTextOf(item)).toBeNull();
  });
});

const SSH_REASON = "Repository SSH read failed. The failure reason is key_refused.";
const PENDING_LIMIT = 10 * MINUTE;

function waiting(reason: string | null, startedAt: number | null): EnvironmentState {
  return {
    ...environment("pending", null),
    reason,
    reason_started_at: startedAt,
  };
}

describe("fixItemsOf environment_pending", () => {
  it("lists a pending environment whose reason is older than the limit, with its reason", () => {
    const startedAt = NOW - PENDING_LIMIT - 1;
    const [item] = fixItemsOf(
      [snapshot({ environments: [waiting(SSH_REASON, startedAt)] })],
      context(),
    );

    expect(item).toMatchObject({
      id: "environment_pending:prj-1:binding_1",
      kind: "environment_pending",
      group: "fixes",
      cause: "Environment waiting",
      subject: "engine",
      binding: "engine",
      at: startedAt,
      reason: SSH_REASON,
    });
  });

  it("ends a reason with no final period with a period", () => {
    const [item] = fixItemsOf(
      [
        snapshot({
          environments: [waiting("connect ECONNREFUSED 127.0.0.1:22", NOW - 60 * MINUTE)],
        }),
      ],
      context(),
    );

    expect(item).toMatchObject({ reason: "connect ECONNREFUSED 127.0.0.1:22." });
  });

  it("lists nothing for a pending environment within the limit or with no reason", () => {
    const states = [
      waiting(SSH_REASON, NOW - PENDING_LIMIT),
      waiting(null, null),
      { ...environment("ready", null), reason: SSH_REASON, reason_started_at: NOW - 60 * MINUTE },
    ];

    expect(fixItemsOf([snapshot({ environments: states })], context())).toEqual([]);
  });

  it("targets the project page and has no spread text", () => {
    const [item] = fixItemsOf(
      [snapshot({ environments: [waiting(SSH_REASON, NOW - 60 * MINUTE)] })],
      context(),
    );
    if (item === undefined) throw new Error("No item.");

    expect(fixTargetOf(item)).toEqual({ path: "/projects/prj-1", label: "Open project" });
    expect(spreadTextOf(item)).toBeNull();
  });
});
