import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import * as schedulerApi from "@/api/resources/scheduler";
import * as trackingApi from "@/api/resources/tracking";
import * as workersApi from "@/api/resources/workers";
import type {
  AgentCooling,
  BindingAgentView,
  MissionAttempt,
  MissionControlResult,
  MissionNodeRecord,
  MissionRevision,
  ProjectBindingRecord,
  Intent,
  SchedulerExecutionRecord,
  TraceSummary,
  WorkerBindingRecord,
  WorkerRegistrationRecord,
} from "@/api/types";
import { utcDateTime } from "@/lib/format";
import { buildGraph } from "@/lib/mission-graph";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/scheduler");
vi.mock("@/api/resources/tracking");
vi.mock("@/api/resources/workers");

import { NodeSheet } from "./node-sheet";
import { textContent } from "../../../../../test/text-content";

function node(
  id: string,
  intent: Intent,
  name: string,
  extra: Partial<MissionNodeRecord> = {},
): MissionNodeRecord {
  return {
    id,
    intent,
    tags: [],
    tasks: [],
    filename: `${id}.md`,
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name,
      requirement: `${name} requirement`,
      criterion: `${name} criterion`,
      verifications: ["pnpm test"],
      bindings: [],
      intent,
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    state: "Pending",
    attempt: 0,
    pinned_revision: null,
    priority: 0,
    depends_on: [],
    ...extra,
  };
}

const AUDIT = node("node_audit", "implement", "Audit log", {
  state: "Blocked",
  attempt: 1,
  visible_revision: 2,
  tags: ["platform.macos"],
  tasks: [
    {
      id: "task_entry",
      filename: "audit-task.md",
      content: {
        name: "Write the audit entry",
        requirement: "r",
        criterion: "c",
        verifications: ["v"],
        bindings: [],
      },
    },
  ],
  content: {
    name: "Audit log",
    requirement: "Audit log requirement",
    criterion: "Audit log criterion",
    verifications: ["pnpm test"],
    bindings: ["binding_repo_2"],
    intent: "implement",
    tags: ["platform.macos"],
  },
  blocked_context: {
    outcome: {
      id: "outcome_1",
      node_id: "node_audit",
      attempt: 1,
      node_revision: 1,
      closing_event: "assessment-not-passed",
      result: "criterion-not-met",
      assessment_id: "assessment_1",
      evidence_ids: [],
      created_at: 0,
    },
    requests: [],
  },
});

const HELD = node("node_held", "implement", "Held work", { state: "Paused", attempt: 0 });

const RUNNING = node("node_running", "implement", "Running work", {
  state: "Executing",
  attempt: 1,
  pinned_revision: 1,
});

const EVALUATING = node("node_evaluating", "implement", "Evaluating work", {
  state: "Evaluating",
  attempt: 1,
  pinned_revision: 1,
});

const READY = node("node_ready", "implement", "Ready work", { state: "Available" });

const NODES: readonly MissionNodeRecord[] = [
  READY,
  HELD,
  RUNNING,
  EVALUATING,
  node("node_onboarding", "examine", "Onboarding", { state: "Completed" }),
  node("node_recovery", "examine", "Account recovery", { state: "Pending" }),
  AUDIT,
];

const MODEL = buildGraph(NODES, [
  { dependent_id: "node_audit", depends_on_id: "node_onboarding" },
  { dependent_id: "node_recovery", depends_on_id: "node_audit" },
]);

const ATTEMPT: MissionAttempt = {
  node_id: "node_audit",
  attempt: 1,
  node_revision: 1,
  start_point: "base_branch",
  required_external_actions: [
    {
      key: "repo.pull_request",
      binding_id: "binding_repo_1",
      action: "pull_request",
      expected_end_state: "pull_request_merged",
      follows: null,
      configuration: { base_branch: "main", landing: "human" },
    },
  ],
  opened_at: 0,
  closed_at: 1,
  outcome_ids: ["outcome_1"],
  opened_by: { kind: "human", account: "ulrich", name: "Ulrich" },
};

const REVISION_1: MissionRevision = {
  node_id: "node_audit",
  filename: "node_audit.md",
  revision: 1,
  reason: "Import the plan.",
  actor: { kind: "human", account: "ulrich", name: "Ulrich" },
  created_at: 0,
  content: { ...AUDIT.content, criterion: "Old criterion", bindings: ["binding_repo_1"] },
  tasks: AUDIT.tasks,
  change: { write: "import", previous_revision: null, changed_fields: [] },
  pinned_by_attempts: [1],
};

const REVISION_2: MissionRevision = {
  ...REVISION_1,
  revision: 2,
  reason: "Move to the new binding.",
  content: AUDIT.content,
  change: { write: "node.update", previous_revision: 1, changed_fields: ["criterion", "bindings"] },
  pinned_by_attempts: [],
};

function binding(id: string, revision: number): ProjectBindingRecord {
  return {
    id,
    project_id: "project_1",
    name: "kanthord-repo",
    kind: "repository",
    resource_identity: "repository:github:kanthorlabs/kanthord",
    revision,
    config: {},
    created_at: 0,
    removed_at: null,
  };
}

function execution(overrides: Partial<SchedulerExecutionRecord>): SchedulerExecutionRecord {
  return {
    execution_id: "execution_1",
    project_id: "project_1",
    node_id: "node_running",
    claimant: {
      worker_binding_id: "binding_worker_1",
      resource_identity: "worker:kanthord:general-main",
      runtime_identity: "worker_registration_01",
      name: "atlas",
    },
    attempt: 1,
    pinned_revision: 1,
    node_branch: "kanthord/node_running",
    credentials: [],
    agent_selections: [],
    claim_state: "running",
    expired_at: 9_000,
    created_at: 1_000,
    ended_at: null,
    stop: null,
    trace_id: "0".repeat(31) + "1",
    root_span_id: "0".repeat(15) + "1",
    ...overrides,
  };
}

function registration(overrides: Partial<WorkerRegistrationRecord>): WorkerRegistrationRecord {
  return {
    runtime_identity: "worker_registration_01",
    project_id: "project_1",
    resource_identity: "worker:kanthord:general-main",
    worker_name: "general-main",
    host: "kanthord",
    placement: "server",
    activity: "executing",
    draining: false,
    registered: true,
    ...overrides,
  } as WorkerRegistrationRecord;
}

function workerBinding(): WorkerBindingRecord {
  return {
    id: "binding_worker_1",
    project_id: "project_1",
    name: "general-main",
    kind: "worker",
    resource_identity: "worker:kanthord:general-main",
    revision: 1,
    config: { worker: "coder@1", instance_count: 1 },
    created_at: 0,
    removed_at: null,
  };
}

function agentView(agent: string, cooling: AgentCooling | null): BindingAgentView {
  return {
    agent,
    worker: "coder@1",
    worker_binding_id: "binding_worker_1",
    binding_set_version: 1,
    defaults: null,
    entry: null,
    effective: null,
    chain: [],
    active_position: cooling === null ? 0 : null,
    cooling,
    valid: true,
    issues: [],
  };
}

function renderSheet(selectedId: string, onSelect = vi.fn()) {
  render(
    <MemoryRouter>
      <NodeSheet
        projectId="project_1"
        model={MODEL}
        selectedId={selectedId}
        missionVersion={3}
        onChanged={vi.fn()}
        onSelect={onSelect}
      />
    </MemoryRouter>,
  );
  return onSelect;
}

describe("NodeSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(missionApi.readMissionNode).mockImplementation(async (nodeId) => {
      const node = NODES.find((item) => item.id === nodeId);
      if (node === undefined) throw new ApiError("not_found", "No such node.", 404);
      return node;
    });
    vi.mocked(projectsApi.readBinding).mockImplementation(async (_projectId, bindingId) =>
      binding(bindingId, bindingId === "binding_repo_1" ? 1 : 2),
    );
    vi.mocked(missionApi.listNodeAttempts).mockResolvedValue([ATTEMPT]);
    vi.mocked(missionApi.readNodeRevision).mockResolvedValue(REVISION_1);
    vi.mocked(missionApi.listNodeRevisions).mockResolvedValue([REVISION_2, REVISION_1]);
    vi.mocked(schedulerApi.listNodeExecutions).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([]);
    vi.mocked(missionApi.listNodeEvidence).mockResolvedValue([]);
    vi.mocked(missionApi.listNodeAssessments).mockResolvedValue([
      {
        id: "assessment_1",
        node_id: "node_audit",
        execution_id: "execution_9",
        attempt: 1,
        node_revision: 1,
        evidence_ids: [],
        dependency_outcome_ids: [],
        result: "criterion-not-met",
        rationale: "The audit entry holds no actor.",
        tested_input: null,
        actor: {
          kind: "execution",
          execution_id: "execution_9",
          client_id: null,
          name: "reviewer",
        },
        created_at: 0,
        currency: null,
        dependency_node_ids: [],
        worker_version: "reviewer@1",
      },
    ]);
    vi.mocked(missionApi.listNodeOutcomes).mockResolvedValue([
      AUDIT.blocked_context?.outcome as NonNullable<typeof AUDIT.blocked_context>["outcome"],
    ]);
    vi.mocked(missionApi.listNodeExternalActions).mockResolvedValue([
      {
        node_id: "node_audit",
        attempt: 1,
        action: ATTEMPT
          .required_external_actions[0] as MissionAttempt["required_external_actions"][0],
        requested: false,
        request_evidence_id: null,
        resolution: "unrequested",
      },
    ]);
  });

  it("shows the blocking outcome, the state meaning and the current bindings", async () => {
    renderSheet("node_audit");

    const sheet = await screen.findByRole("dialog");
    expect(await within(sheet).findByText("The node is blocked after attempt 1.")).toBeTruthy();
    expect(within(sheet).getByText("A current assessment did not pass.")).toBeTruthy();
    const bindings = await within(sheet).findByRole("list", {
      name: "Bindings of the current revision",
    });
    expect(within(bindings).getByText("revision 2")).toBeTruthy();
  });

  it("offers the controls beside the blocked notice of an implement node", async () => {
    renderSheet("node_audit");

    const controls = await screen.findByRole("region", { name: "Controls" });
    expect(within(controls).getByRole("button", { name: "Unblock" })).toBeTruthy();
    expect(within(controls).getByRole("button", { name: "Discard" })).toBeTruthy();
    expect(missionApi.listNodeProposals).not.toHaveBeenCalled();
  });

  it("offers Resume, Override and Discard for a Paused node at attempt 0 without a read", async () => {
    vi.mocked(schedulerApi.listNodeExecutions).mockRejectedValue(
      new ApiError("malformed", "Request validation failed.", 400),
    );
    renderSheet("node_held");

    const controls = await screen.findByRole("region", { name: "Controls" });
    expect(within(controls).getByRole("button", { name: "Resume" })).toBeTruthy();
    expect(within(controls).getByRole("button", { name: "Override" })).toBeTruthy();
    expect(within(controls).getByRole("button", { name: "Discard" })).toBeTruthy();
    expect(schedulerApi.listNodeExecutions).not.toHaveBeenCalled();
    expect(missionApi.listNodeExternalActions).not.toHaveBeenCalled();
  });

  it("shows the intent and the tags of the node", async () => {
    renderSheet("node_audit");

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("implement · node_audit.md")).toBeTruthy();
    expect(await within(sheet).findByText("platform.macos")).toBeTruthy();
  });

  it("shows None for empty tags", async () => {
    renderSheet("node_held");

    expect(await screen.findByText("None")).toBeTruthy();
  });

  it("shows the dependencies, the dependents and the tasks of an implement node", async () => {
    renderSheet("node_audit");

    const dependsOn = await screen.findByRole("region", { name: "Depends on" });
    expect(within(dependsOn).getByRole("button", { name: "Onboarding" })).toBeTruthy();
    const dependents = screen.getByRole("region", { name: "Dependents" });
    expect(within(dependents).getByRole("button", { name: "Account recovery" })).toBeTruthy();
    const tasks = screen.getByRole("region", { name: "Tasks" });
    expect(within(tasks).getByText("Write the audit entry")).toBeTruthy();
    expect(
      screen.getByText("The dependency closure holds. Every node that it names is Completed."),
    ).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Parent" })).toBeNull();
  });

  it("shows no Tasks section for an examine node and reads its proposals", async () => {
    vi.mocked(missionApi.listNodeProposals).mockResolvedValue([]);
    renderSheet("node_recovery");

    expect(await screen.findByRole("region", { name: "Depends on" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Tasks" })).toBeNull();
    expect(missionApi.listNodeProposals).toHaveBeenCalledWith("node_recovery");
  });

  it("selects a related node", async () => {
    const onSelect = renderSheet("node_audit");

    const dependents = await screen.findByRole("region", { name: "Dependents" });
    await userEvent.click(within(dependents).getByRole("button", { name: "Account recovery" }));

    expect(onSelect).toHaveBeenCalledWith("node_recovery");
  });

  it("reads an attempt in the context of its pinned revision", async () => {
    renderSheet("node_audit");

    await userEvent.click(await screen.findByRole("tab", { name: "Attempts" }));
    await userEvent.click(await screen.findByRole("button", { name: "Records of attempt 1" }));

    expect(
      await screen.findByText(
        "The attempt pins revision 1. The node is now at revision 2, so the content below can differ from the current content.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Old criterion")).toBeTruthy();
    const actions = screen.getByRole("list", { name: "External actions" });
    expect(
      within(actions).getByText(textContent("pull_request on kanthord-repo revision 1, base main")),
    ).toBeTruthy();
    const outcomes = screen.getByRole("list", { name: "Outcomes" });
    expect(
      within(outcomes).getByText(
        textContent("Basis: criterion-not-met assessment by reviewer (execution_9)"),
      ),
    ).toBeTruthy();
  });

  it("shows the stop reason of an execution in the records of an attempt", async () => {
    vi.mocked(schedulerApi.listNodeExecutions).mockResolvedValue([
      execution({
        node_id: "node_audit",
        claim_state: "finished",
        ended_at: 2_000,
        stop: { reason: "provider_failed", code: "rate_limited" },
      }),
    ]);
    renderSheet("node_audit");

    await userEvent.click(await screen.findByRole("tab", { name: "Attempts" }));
    await userEvent.click(await screen.findByRole("button", { name: "Records of attempt 1" }));

    const executions = await screen.findByRole("list", { name: "Executions" });
    expect(within(executions).getByText("Provider failed: rate limited")).toBeTruthy();
  });

  it("shows the trace summary of an execution and links to its trace", async () => {
    vi.mocked(schedulerApi.listNodeExecutions).mockResolvedValue([
      execution({ node_id: "node_audit", trace_id: "trace_live" }),
      execution({ execution_id: "execution_2", node_id: "node_audit", trace_id: "trace_gone" }),
      execution({ execution_id: "execution_3", node_id: "node_audit", trace_id: "trace_down" }),
    ]);
    vi.mocked(trackingApi.readTrace).mockImplementation(async (traceId) => {
      if (traceId === "trace_gone") throw new ApiError("not_found", "No such trace.", 404);
      if (traceId === "trace_down") throw new ApiError("unreachable", "No answer.", 0);
      return {
        turn_count: 12,
        total_tokens: 48_200,
        cost_usd: 0.4321,
        error_count: 2,
      } as TraceSummary;
    });
    renderSheet("node_audit");

    await userEvent.click(await screen.findByRole("tab", { name: "Attempts" }));
    await userEvent.click(await screen.findByRole("button", { name: "Records of attempt 1" }));

    const executions = await screen.findByRole("list", { name: "Executions" });
    const [live, gone, down] = within(executions).getAllByRole("listitem");
    expect(
      await within(live as HTMLElement).findByText(
        "12 turns · 48.2k tokens · Est. cost $0.4321 · 2 errors",
      ),
    ).toBeTruthy();
    expect(within(live as HTMLElement).getByRole("button", { name: "Trace" })).toHaveAttribute(
      "href",
      "/traces/trace_live",
    );
    expect(await within(gone as HTMLElement).findByText("Trace expired")).toBeTruthy();
    expect(within(gone as HTMLElement).getByRole("button", { name: "Trace" })).toHaveAttribute(
      "href",
      "/traces/trace_gone",
    );
    expect(within(down as HTMLElement).queryByText(/turns|Trace expired/)).toBeNull();
  });

  it("shows the end of the last execution and its cause on the attempt from one read", async () => {
    vi.mocked(schedulerApi.listNodeExecutions).mockResolvedValue([
      execution({
        execution_id: "execution_1",
        node_id: "node_audit",
        claim_state: "finished",
        ended_at: 2_000,
        stop: {
          reason: "provider_failed",
          code: "unavailable",
          detail: "OAuth auth derivation failed for anthropic: Cannot find module",
        },
      }),
      execution({
        execution_id: "execution_2",
        node_id: "node_audit",
        attempt: 2,
        claim_state: "finished",
        ended_at: 3_000,
      }),
    ]);
    renderSheet("node_audit");

    await userEvent.click(await screen.findByRole("tab", { name: "Attempts" }));
    const attempts = await screen.findByRole("list", { name: "Attempts" });
    expect(
      await within(attempts).findByText(
        `Last execution ended ${utcDateTime(2_000)}: Provider failed: unavailable`,
      ),
    ).toBeTruthy();
    expect(
      within(attempts).getByText(
        "Cause: OAuth auth derivation failed for anthropic: Cannot find module",
      ),
    ).toBeTruthy();
    expect(vi.mocked(schedulerApi.listNodeExecutions).mock.calls).toEqual([
      ["project_1", "node_audit"],
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Records of attempt 1" }));
    const executions = await screen.findByRole("list", { name: "Executions" });
    expect(
      within(executions).getByText(
        "Cause: OAuth auth derivation failed for anthropic: Cannot find module",
      ),
    ).toBeTruthy();
  });

  it("names a lost last execution of an attempt", async () => {
    vi.mocked(schedulerApi.listNodeExecutions).mockResolvedValue([
      execution({
        execution_id: "execution_1",
        node_id: "node_audit",
        claim_state: "finished",
        ended_at: 2_000,
        stop: { reason: "provider_failed", code: "rate_limited" },
      }),
      execution({
        execution_id: "execution_2",
        node_id: "node_audit",
        claim_state: "lost",
        ended_at: null,
        expired_at: 9_000,
      }),
    ]);
    renderSheet("node_audit");

    await userEvent.click(await screen.findByRole("tab", { name: "Attempts" }));
    const attempts = await screen.findByRole("list", { name: "Attempts" });
    expect(
      await within(attempts).findByText(`Last execution ended ${utcDateTime(9_000)}: lost`),
    ).toBeTruthy();
  });

  it("states that an agent chain of the project cools down on an Available node", async () => {
    const end = Date.now() + 240_000;
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([workerBinding()]);
    vi.mocked(projectsApi.listBindingAgents).mockResolvedValue([
      agentView("swe@1", { code: "agent.configuration.chain_cooling", available_at: end }),
      agentView("qa@1", {
        code: "agent.configuration.chain_cooling",
        available_at: Date.now() - 1_000,
      }),
      agentView("re@1", null),
    ]);
    renderSheet("node_ready");

    expect(await screen.findByText("An agent chain of this project cools down.")).toBeTruthy();
    expect(
      screen.getByText(
        `Agent swe@1 of general-main: every credential of its chain cools down until ${utcDateTime(end)}. A claim that needs this agent waits until then.`,
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Agent qa@1/)).toBeNull();
    expect(screen.queryByText(/Agent re@1/)).toBeNull();
  });

  it("shows no cooldown hint on an Available node when no agent chain cools down", async () => {
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([workerBinding()]);
    vi.mocked(projectsApi.listBindingAgents).mockResolvedValue([agentView("re@1", null)]);
    renderSheet("node_ready");

    expect(await screen.findByText("Ready work criterion")).toBeTruthy();
    await waitFor(() => expect(projectsApi.listBindingAgents).toHaveBeenCalled());
    expect(screen.queryByText("An agent chain of this project cools down.")).toBeNull();
  });

  it("reads no cooldown for a node that is not Available", async () => {
    renderSheet("node_audit");

    expect(await screen.findByText("Audit log criterion")).toBeTruthy();
    expect(projectsApi.listWorkerBindings).not.toHaveBeenCalled();
  });

  it("states that the open attempt runs an earlier revision than the current one", async () => {
    vi.mocked(missionApi.readMissionNode).mockResolvedValue({
      ...RUNNING,
      visible_revision: 3,
      pinned_revision: 2,
    });
    renderSheet("node_running");

    expect(
      await screen.findByText(
        "The attempt runs revision 2. Revision 3 applies at the next attempt.",
      ),
    ).toBeTruthy();
  });

  it("shows no revision note when the open attempt runs the current revision", async () => {
    renderSheet("node_running");

    expect(await screen.findByText("Running work requirement")).toBeTruthy();
    expect(screen.queryByText(/applies at the next attempt/)).toBeNull();
  });

  it("shows the claimant and the activity of an Executing node", async () => {
    vi.mocked(schedulerApi.listNodeExecutions).mockResolvedValue([
      execution({ execution_id: "execution_0", claim_state: "lost", ended_at: null }),
      execution({}),
    ]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([registration({})]);
    renderSheet("node_running");

    const claimant = await screen.findByRole("region", { name: "Claimant" });
    expect(await within(claimant).findByText("executing")).toBeTruthy();
    expect(within(claimant).getByText("atlas")).toBeTruthy();
    expect(within(claimant).getByText("worker_registration_01")).toBeTruthy();
    expect(schedulerApi.listNodeExecutions).toHaveBeenCalledWith("project_1", "node_running", 1);
    expect(workersApi.listWorkerRegistrations).toHaveBeenCalledWith("project_1");
  });

  it("shows the claimant and the activity of an Evaluating node", async () => {
    vi.mocked(schedulerApi.listNodeExecutions).mockResolvedValue([execution({})]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([
      registration({ activity: "pulling" }),
    ]);
    renderSheet("node_evaluating");

    const claimant = await screen.findByRole("region", { name: "Claimant" });
    expect(await within(claimant).findByText("pulling")).toBeTruthy();
    expect(schedulerApi.listNodeExecutions).toHaveBeenCalledWith("project_1", "node_evaluating", 1);
  });

  it("names the resource identity of a claimant without a name", async () => {
    vi.mocked(schedulerApi.listNodeExecutions).mockResolvedValue([
      execution({
        claimant: {
          worker_binding_id: "binding_worker_1",
          resource_identity: "worker:kanthord:general-main",
          runtime_identity: "worker_registration_01",
        },
      }),
    ]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([registration({})]);
    renderSheet("node_running");

    const claimant = await screen.findByRole("region", { name: "Claimant" });
    expect(await within(claimant).findByText("worker:kanthord:general-main")).toBeTruthy();
  });

  it("states that the registration read loads", async () => {
    vi.mocked(schedulerApi.listNodeExecutions).mockResolvedValue([execution({})]);
    vi.mocked(workersApi.listWorkerRegistrations).mockReturnValue(new Promise(() => undefined));
    renderSheet("node_running");

    const claimant = await screen.findByRole("region", { name: "Claimant" });
    expect(await within(claimant).findByText("Reading the registration.")).toBeTruthy();
    expect(within(claimant).queryByText(/not registered/)).toBeNull();
  });

  it("names a failed registration read and reads again on Retry", async () => {
    vi.mocked(schedulerApi.listNodeExecutions).mockResolvedValue([execution({})]);
    vi.mocked(workersApi.listWorkerRegistrations)
      .mockRejectedValueOnce(new ApiError("unavailable", "The registration read failed.", 503))
      .mockResolvedValue([registration({})]);
    renderSheet("node_running");

    const claimant = await screen.findByRole("region", { name: "Claimant" });
    expect(
      await within(claimant).findByText(
        "The registration could not be read: The registration read failed.",
      ),
    ).toBeTruthy();
    expect(within(claimant).queryByText(/not registered/)).toBeNull();
    await userEvent.click(within(claimant).getByRole("button", { name: "Retry" }));

    expect(await within(claimant).findByText("executing")).toBeTruthy();
    expect(workersApi.listWorkerRegistrations).toHaveBeenCalledTimes(2);
  });

  it("states that the claim of an ended registration holds until its deadline", async () => {
    vi.mocked(schedulerApi.listNodeExecutions).mockResolvedValue([execution({})]);
    renderSheet("node_running");

    const claimant = await screen.findByRole("region", { name: "Claimant" });
    expect(await within(claimant).findByText("not registered")).toBeTruthy();
    expect(
      within(claimant).getByText(
        textContent(
          "The registration ended. The claim holds until its deadline, 1970-01-01 00:00 UTC. Pause frees it.",
        ),
      ),
    ).toBeTruthy();
  });

  it("reads the registration again after a control", async () => {
    vi.mocked(schedulerApi.listNodeExecutions).mockResolvedValue([execution({})]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([registration({})]);
    vi.mocked(missionApi.pauseNode).mockResolvedValue({} as MissionControlResult);
    renderSheet("node_running");

    await screen.findByText("executing");
    await userEvent.click(await screen.findByRole("button", { name: "Pause" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.type(within(dialog).getByLabelText("Reason"), "Hold for review.");
    await userEvent.click(within(dialog).getByRole("button", { name: "Pause node" }));

    await vi.waitFor(() => expect(workersApi.listWorkerRegistrations).toHaveBeenCalledTimes(2));
  });

  it("shows no stall text while the executions of an Executing node load", async () => {
    let answer: (value: SchedulerExecutionRecord[]) => void = () => undefined;
    vi.mocked(schedulerApi.listNodeExecutions).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([registration({})]);
    renderSheet("node_running");

    await screen.findByRole("region", { name: "Controls" });
    await vi.waitFor(() => expect(schedulerApi.listNodeExecutions).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/No running execution/)).toBeNull();
    expect(screen.queryByRole("region", { name: "Claimant" })).toBeNull();

    answer([execution({})]);

    expect(await screen.findByRole("region", { name: "Claimant" })).toBeTruthy();
    expect(screen.queryByText(/No running execution/)).toBeNull();
  });

  it("states that an Executing node holds no running execution", async () => {
    vi.mocked(schedulerApi.listNodeExecutions).mockResolvedValue([
      execution({ claim_state: "finished", ended_at: 2_000 }),
    ]);
    renderSheet("node_running");

    const claimant = await screen.findByRole("region", { name: "Claimant" });
    expect(within(claimant).getByText("No running execution for attempt 1.")).toBeTruthy();
    expect(workersApi.listWorkerRegistrations).not.toHaveBeenCalled();
  });

  it("names a failed executions read of an Executing node, keeps the controls and reads again on Retry", async () => {
    vi.mocked(schedulerApi.listNodeExecutions)
      .mockRejectedValueOnce(new ApiError("unavailable", "The executions read failed.", 503))
      .mockResolvedValue([execution({})]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([registration({})]);
    vi.mocked(missionApi.listNodeExternalActions).mockResolvedValue([]);
    renderSheet("node_running");

    const claimant = await screen.findByRole("region", { name: "Claimant" });
    expect(
      await within(claimant).findByText(
        "The executions could not be read: The executions read failed.",
      ),
    ).toBeTruthy();
    const controls = screen.getByRole("region", { name: "Controls" });
    expect(within(controls).getByRole("button", { name: "Pause" })).toBeTruthy();
    expect(within(controls).getByRole("button", { name: "Override" })).toBeTruthy();
    await userEvent.click(within(claimant).getByRole("button", { name: "Retry" }));

    expect(await within(claimant).findByText("executing")).toBeTruthy();
  });

  it("keeps the other records when one read fails", async () => {
    vi.mocked(missionApi.listNodeEvidence).mockRejectedValue(
      new ApiError("unavailable", "The evidence read failed.", 503),
    );
    renderSheet("node_audit");

    await userEvent.click(await screen.findByRole("tab", { name: "Attempts" }));
    await userEvent.click(await screen.findByRole("button", { name: "Records of attempt 1" }));

    expect(await screen.findByText("The evidence read failed.")).toBeTruthy();
    expect(screen.getByRole("list", { name: "Assessments" })).toBeTruthy();
  });

  it("marks the current revision", async () => {
    renderSheet("node_audit");

    await userEvent.click(await screen.findByRole("tab", { name: "Revisions" }));

    const revisions = await screen.findByRole("list", { name: "Revisions" });
    const items = within(revisions).getAllByRole("listitem");
    expect(within(items[0] as HTMLElement).getByText("current")).toBeTruthy();
    expect(within(items[1] as HTMLElement).getByText("Pinned by attempt 1.")).toBeTruthy();
  });
});
