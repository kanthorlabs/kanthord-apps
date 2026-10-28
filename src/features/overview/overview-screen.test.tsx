import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

vi.mock("@/api/client", () => ({
  connectionBaseUrl: vi.fn(),
}));

vi.mock("@/api/resources/projects", () => ({
  listProjects: vi.fn(),
  listWorkerBindings: vi.fn(),
  listBindingAgents: vi.fn(),
  listProjectEnvironments: vi.fn(),
  readProject: vi.fn(),
  resumeProject: vi.fn(),
  pauseProject: vi.fn(),
}));

vi.mock("@/api/resources/workers", () => ({
  listWorkerCatalog: vi.fn(),
  listWorkerRegistrations: vi.fn(),
}));

vi.mock("@/api/resources/credentials", () => ({
  listAllCredentials: vi.fn(),
}));

vi.mock("@/api/resources/gateway", () => ({
  readLiveness: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/api/resources/mission", () => ({
  readMission: vi.fn(),
  listMissionNodes: vi.fn(),
  listNodeAssessments: vi.fn(),
  listNodeEvidence: vi.fn(),
  checkNode: vi.fn(),
  listNodeProposals: vi.fn(),
  listNodeExternalActions: vi.fn(),
  unblockNode: vi.fn(),
  approveProposal: vi.fn(),
  overrideNode: vi.fn(),
  resumeNode: vi.fn(),
  removeDependency: vi.fn(),
  discardNode: vi.fn(),
}));

vi.mock("@/api/resources/workbench", () => ({
  listWorkbenchSessions: vi.fn(),
}));

vi.mock("@/api/resources/tracking", () => ({
  listTracePage: vi.fn(),
}));

vi.mock("@/api/resources/scheduler", () => ({
  listQueueJobs: vi.fn(),
  listNodeExecutions: vi.fn(),
  listProjectExecutionPage: vi.fn(),
}));

import { listTracePage } from "@/api/resources/tracking";
import {
  approveProposal,
  checkNode,
  discardNode,
  listMissionNodes,
  listNodeAssessments,
  listNodeEvidence,
  listNodeExternalActions,
  listNodeProposals,
  overrideNode,
  readMission,
  removeDependency,
  resumeNode,
  unblockNode,
} from "@/api/resources/mission";
import { connectionBaseUrl } from "@/api/client";
import { listAllCredentials } from "@/api/resources/credentials";
import { readLiveness } from "@/api/resources/gateway";
import {
  listBindingAgents,
  listProjectEnvironments,
  listProjects,
  listWorkerBindings,
  pauseProject,
  readProject,
  resumeProject,
} from "@/api/resources/projects";
import {
  listNodeExecutions,
  listProjectExecutionPage,
  listQueueJobs,
} from "@/api/resources/scheduler";
import { listWorkbenchSessions } from "@/api/resources/workbench";
import { listWorkerCatalog, listWorkerRegistrations } from "@/api/resources/workers";
import type {
  ActionLanding,
  BindingAgentView,
  Credential,
  EnvironmentState,
  Intent,
  LivenessReport,
  MissionAssessment,
  MissionAssessmentResult,
  MissionClosingEvent,
  MissionControlResult,
  MissionEvidence,
  MissionExternalAction,
  MissionNodeChange,
  MissionNodeCheckAnswer,
  MissionNodeRecord,
  MissionProposal,
  MissionProposalApproveResult,
  NodeState,
  Project,
  RepositoryActionName,
  SchedulerExecutionRecord,
  SchedulerJob,
  TraceListItem,
  WorkbenchSessionListItem,
  WorkerBindingRecord,
  WorkerCatalogItem,
  WorkerRegistrationRecord,
} from "@/api/types";
import { closingEventText } from "@/lib/mission-labels";
import { newUlid } from "@/lib/ulid";

import { textContent } from "../../../test/text-content";
import { OverviewScreen } from "./overview-screen";

let NOW = 0;
const HOUR = 3_600_000;
const FIRST_JOB_AGE_MS = 24 * HOUR;

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

const KANTHORD = project("prj-1", "kanthord");
const ATLAS = project("prj-2", "atlas");

interface BlockedOptions {
  readonly intent?: Intent;
  readonly attempt?: number;
  readonly closingEvent?: MissionClosingEvent;
  readonly result?: MissionAssessmentResult;
  readonly createdAt?: number;
  readonly requests?: readonly MissionEvidence[];
}

function blocked(id: string, name: string, options: BlockedOptions = {}): MissionNodeRecord {
  const attempt = options.attempt ?? 2;
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission",
    visible_revision: 3,
    content: {
      name,
      requirement: "",
      criterion: "",
      verifications: [],
      bindings: [],
      intent: options.intent ?? "implement",
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    pinned_revision: null,
    intent: options.intent ?? "implement",
    tags: [],
    tasks: [],
    state: "Blocked",
    attempt,
    priority: 0,
    depends_on: [],
    blocked_context: {
      outcome: {
        id: `outcome_${id}`,
        node_id: id,
        attempt,
        node_revision: 3,
        closing_event: options.closingEvent ?? "assessment-not-passed",
        result: options.result ?? "criterion-not-met",
        assessment_id: `assessment_${id}`,
        evidence_ids: [],
        created_at: options.createdAt ?? NOW - 3 * HOUR,
      },
      requests: options.requests ?? [],
    },
  };
}

function plain(id: string, name: string, state: NodeState): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission",
    visible_revision: 1,
    content: {
      name,
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
    attempt: 1,
    priority: 0,
    depends_on: [],
  };
}

function paused(id: string, name: string, attempt = 2): MissionNodeRecord {
  return { ...(plain(id, name, "Paused") as MissionNodeRecord), attempt };
}

function pending(id: string, name: string, dependsOn: readonly string[]): MissionNodeRecord {
  return {
    ...(plain(id, name, "Pending") as MissionNodeRecord),
    attempt: 0,
    depends_on: dependsOn,
  };
}

function ended(
  id: string,
  nodeId: string,
  overrides: Partial<SchedulerExecutionRecord> = {},
): SchedulerExecutionRecord {
  return {
    execution_id: id,
    project_id: "prj-1",
    node_id: nodeId,
    claimant: {
      worker_binding_id: "binding_1",
      resource_identity: "worker:kanthord:general-main",
      runtime_identity: "worker_registration_01",
    },
    attempt: 2,
    pinned_revision: 1,
    node_branch: `kanthord/${nodeId}`,
    credentials: [],
    agent_selections: [],
    claim_state: "finished",
    expired_at: NOW + HOUR,
    created_at: NOW - 3 * HOUR,
    ended_at: NOW - 2 * HOUR,
    stop: null,
    trace_id: "0".repeat(31) + "1",
    root_span_id: "0".repeat(15) + "1",
    ...overrides,
  };
}

interface RequestOptions {
  readonly action?: RepositoryActionName;
  readonly landing?: ActionLanding;
}

function requested(
  nodeId: string,
  resolution: MissionExternalAction["resolution"],
  options: RequestOptions = {},
): MissionExternalAction {
  const action = options.action ?? "pull_request";
  return {
    node_id: nodeId,
    attempt: 2,
    action: {
      key: `repo.${action}`,
      binding_id: "binding_1",
      action,
      expected_end_state: action === "pull_request" ? "pull_request_merged" : "base_branch_pushed",
      follows: null,
      configuration: { base_branch: "main", landing: options.landing ?? "human" },
    },
    requested: true,
    request_evidence_id: "evidence_1",
    resolution,
  };
}

function requestEvidence(
  nodeId: string,
  createdAt: number,
  pullRequest: number | null = 12,
): MissionEvidence {
  return {
    id: "evidence_1",
    node_id: nodeId,
    attempt: 2,
    subject: "Request",
    assets:
      pullRequest === null
        ? []
        : [
            {
              id: "asset_1",
              kind: "platform",
              address: {
                kind: "pull_request",
                resource_identity: "repository:github:kanthorlabs/atlas",
                number: pullRequest,
              },
              published_at: createdAt,
              expired_at: null,
            },
          ],
    provenance: { kind: "human", account: "a", name: "A" },
    created_at: createdAt,
    requirement_key: "repo.pull_request",
  };
}

function outside(id: string, name: string, state: NodeState = "External.Requested") {
  return { ...(plain(id, name, state) as MissionNodeRecord), attempt: 2 };
}

function assessment(nodeId: string, rationale: string): MissionAssessment {
  return {
    id: `assessment_${nodeId}`,
    node_id: nodeId,
    execution_id: null,
    attempt: 2,
    node_revision: 3,
    evidence_ids: [],
    dependency_outcome_ids: [],
    result: "criterion-not-met",
    rationale,
    tested_input: null,
    actor: { kind: "human", account: "kanthorlabs", name: "Kanthor Labs" },
    created_at: NOW - 3 * HOUR,
    currency: null,
    dependency_node_ids: [],
    worker_version: null,
  };
}

function proposal(nodeId: string, name: string, approvedAt: number | null = null): MissionProposal {
  return {
    id: `proposal_${name}`,
    node_id: nodeId,
    attempt: 2,
    assessment_id: `assessment_${nodeId}`,
    content: {
      dependency_id: "node_target",
      name,
      requirement: "The invite email uses the workspace language.",
      criterion: "c",
      task: { name: "t", requirement: "r", criterion: "c", verifications: ["v"] },
    },
    created_node_id: null,
    approved_at: approvedAt,
    created_at: NOW - HOUR,
  };
}

const APPROVED: MissionProposalApproveResult = {
  created: {
    mission_version: 10,
    revisions: [],
    retired_node_ids: [],
    added_edges: [],
    removed_edges: [],
    open_attempts_unchanged: [],
  },
  proposer: {
    node: plain("n_t", "Team workspaces", "Pending"),
    attempt: null,
    outcome: null,
    actor: { kind: "human", account: "ulrich", name: "Ulrich" },
    accepted_at: 1,
  },
};

function failedEnvironment(): EnvironmentState {
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
      ended_at: NOW - HOUR,
    },
    checks: [],
    repairs: 0,
    repairing: false,
  };
}

function job(projectId: string, nodeId: string): SchedulerJob {
  return {
    job_id: `job_${nodeId}`,
    project_id: projectId,
    node_id: nodeId,
    priority: 0,
    queued_at: NOW,
  };
}

interface World {
  readonly projects?: readonly Project[];
  readonly nodes?: Readonly<Record<string, readonly MissionNodeRecord[]>>;
  readonly jobs?: Readonly<Record<string, readonly SchedulerJob[]>>;
  readonly rationales?: Readonly<Record<string, string>>;
  readonly proposals?: Readonly<Record<string, readonly MissionProposal[]>>;
  readonly executions?: Readonly<Record<string, readonly SchedulerExecutionRecord[]>>;
  readonly actions?: Readonly<Record<string, readonly MissionExternalAction[]>>;
  readonly evidence?: Readonly<Record<string, readonly MissionEvidence[]>>;
  readonly pages?: Readonly<Record<string, readonly SchedulerExecutionRecord[]>>;
  readonly registrations?: Readonly<Record<string, readonly WorkerRegistrationRecord[]>>;
  readonly catalog?: readonly WorkerCatalogItem[];
  readonly bindings?: Readonly<Record<string, readonly WorkerBindingRecord[]>>;
  readonly agents?: Readonly<Record<string, readonly BindingAgentView[]>>;
  readonly credentials?: readonly Credential[];
  readonly liveness?: LivenessReport;
  readonly sessions?: readonly WorkbenchSessionListItem[];
  readonly environments?: Readonly<Record<string, readonly EnvironmentState[]>>;
}

const HEALTHY: LivenessReport = {
  healthy: true,
  services: { server: { gateway: 200, store: 200, log: 200 } },
};

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

function serve(world: World) {
  vi.mocked(listProjects).mockResolvedValue(world.projects ?? [KANTHORD, ATLAS]);
  vi.mocked(readMission).mockImplementation(async (projectId) => ({
    id: `mission_${projectId}`,
    project_id: projectId,
    version: 7,
  }));
  vi.mocked(listMissionNodes).mockImplementation(
    async (missionId) => world.nodes?.[missionId.replace("mission_", "")] ?? [],
  );
  vi.mocked(listQueueJobs).mockImplementation(async (projectId) => world.jobs?.[projectId] ?? []);
  vi.mocked(listNodeAssessments).mockImplementation(async (nodeId) => [
    assessment(nodeId, world.rationales?.[nodeId] ?? "The criterion is not met."),
  ]);
  vi.mocked(listNodeProposals).mockImplementation(
    async (nodeId) => world.proposals?.[nodeId] ?? [],
  );
  vi.mocked(listNodeExecutions).mockImplementation(
    async (_projectId, nodeId) => world.executions?.[nodeId] ?? [],
  );
  vi.mocked(listNodeExternalActions).mockImplementation(
    async (nodeId) => world.actions?.[nodeId] ?? [],
  );
  vi.mocked(listNodeEvidence).mockImplementation(async (nodeId) => world.evidence?.[nodeId] ?? []);
  vi.mocked(listProjectExecutionPage).mockImplementation(async (projectId) => ({
    items: world.pages?.[projectId] ?? [],
    next_cursor: null,
  }));
  vi.mocked(listWorkerRegistrations).mockImplementation(
    async (projectId) => world.registrations?.[projectId] ?? [],
  );
  vi.mocked(listProjectEnvironments).mockImplementation(
    async (projectId) => world.environments?.[projectId] ?? [],
  );
  vi.mocked(listWorkerCatalog).mockResolvedValue(world.catalog ?? CATALOG);
  vi.mocked(listWorkerBindings).mockImplementation(
    async (projectId) => world.bindings?.[projectId] ?? [],
  );
  vi.mocked(listBindingAgents).mockImplementation(
    async (_projectId, bindingId) => world.agents?.[bindingId] ?? [],
  );
  vi.mocked(listAllCredentials).mockResolvedValue(world.credentials ?? []);
  vi.mocked(listWorkbenchSessions).mockResolvedValue(world.sessions ?? []);
  vi.mocked(connectionBaseUrl).mockReturnValue("http://daemon.test");
  vi.mocked(readLiveness).mockResolvedValue(world.liveness ?? HEALTHY);
  vi.mocked(resumeProject).mockResolvedValue(KANTHORD);
  vi.mocked(pauseProject).mockResolvedValue(KANTHORD);
  vi.mocked(unblockNode).mockResolvedValue({} as MissionControlResult);
  vi.mocked(approveProposal).mockResolvedValue(APPROVED);
  vi.mocked(overrideNode).mockResolvedValue({} as MissionControlResult);
  vi.mocked(resumeNode).mockResolvedValue({} as MissionControlResult);
  vi.mocked(removeDependency).mockResolvedValue({} as MissionNodeChange);
  vi.mocked(discardNode).mockResolvedValue({} as MissionControlResult);
}

function renderScreen(entry = "/", onResume?: () => void) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <OverviewScreen onResume={onResume} />
    </MemoryRouter>,
  );
}

function itemOf(name: string): HTMLElement {
  const item = screen.getByRole("link", { name }).closest('[role="listitem"]');
  if (!(item instanceof HTMLElement)) throw new Error(`No item for ${name}.`);
  return item;
}

beforeEach(() => {
  vi.resetAllMocks();
  NOW = Date.now();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("OverviewScreen onboarding link", () => {
  it("offers Resume onboarding while a setup step is open", async () => {
    serve({});
    const onResume = vi.fn();

    renderScreen("/", onResume);
    await userEvent.click(await screen.findByRole("button", { name: "Resume onboarding" }));

    expect(onResume).toHaveBeenCalledOnce();
  });

  it("shows the no-project empty state beside Resume onboarding", async () => {
    serve({ projects: [] });

    renderScreen("/", vi.fn());

    expect(await screen.findByText("No projects")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New project" })).toHaveAttribute(
      "href",
      "/projects/new",
    );
    expect(screen.getByRole("button", { name: "Resume onboarding" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Needs you" })).toBeNull();
  });

  it("offers no Resume onboarding when the setup is done", async () => {
    serve({});

    renderScreen();

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resume onboarding" })).toBeNull();
  });
});

describe("OverviewScreen inbox", () => {
  it("lists the Blocked nodes of every project with cause, project and age", async () => {
    serve({
      nodes: {
        "prj-1": [blocked("n_a", "Audit log for account changes")],
        "prj-2": [
          blocked("n_b", "Localize the order email", {
            result: "undetermined",
            createdAt: NOW - 5 * HOUR,
          }),
        ],
      },
    });

    renderScreen();

    const decisions = await screen.findByRole("list", { name: "Decisions" });
    expect(
      within(decisions)
        .getAllByRole("listitem")
        .map((item) => within(item).getAllByRole("link")[0]?.textContent),
    ).toEqual(["Localize the order email", "Audit log for account changes"]);
    const first = itemOf("Localize the order email");
    expect(within(first).getByText("Blocked")).toBeInTheDocument();
    expect(within(first).getByText("Undetermined")).toBeInTheDocument();
    expect(
      within(first).getByText(textContent("project atlas · attempt 2 · 5 hours ago")),
    ).toBeInTheDocument();
    expect(within(first).getByText(closingEventText("assessment-not-passed"))).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: "Localize the order email" })).toHaveAttribute(
      "href",
      "/projects/prj-2?node=n_b",
    );
    expect(
      within(itemOf("Audit log for account changes")).getByText("Criterion not met"),
    ).toBeInTheDocument();
  });

  it("names the summary of the groups in a polite live region", async () => {
    serve({
      nodes: { "prj-1": [blocked("n_a", "A"), blocked("n_b", "B")], "prj-2": [] },
    });

    renderScreen();

    const summary = await screen.findByText("2 decisions");
    expect(summary.parentElement).toHaveAttribute("aria-live", "polite");
  });

  it("narrows the inbox to one group on demand", async () => {
    serve({
      projects: [{ ...KANTHORD, paused_at: NOW - HOUR }, ATLAS],
      nodes: { "prj-1": [blocked("n_a", "A")], "prj-2": [] },
    });

    renderScreen();

    const filter = await screen.findByRole("group", { name: "Show the items of" });
    expect(screen.getByRole("heading", { name: "Decisions" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fixes" })).toBeInTheDocument();
    await userEvent.click(within(filter).getByRole("button", { name: "Fixes · 1" }));
    expect(screen.queryByRole("heading", { name: "Decisions" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Fixes" })).toBeInTheDocument();
    await userEvent.click(within(filter).getByRole("button", { name: "All · 2" }));
    expect(screen.getByRole("heading", { name: "Decisions" })).toBeInTheDocument();
  });

  it("offers no group filter while one group holds items", async () => {
    serve({ nodes: { "prj-1": [blocked("n_a", "A")], "prj-2": [] } });

    renderScreen();

    expect(await screen.findByRole("heading", { name: "Decisions" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Show the items of" })).toBeNull();
  });

  it("names the status line and links to the scheduler", async () => {
    serve({
      nodes: {
        "prj-1": [plain("n_a", "A", "Executing"), plain("n_b", "B", "Evaluating")],
        "prj-2": [plain("n_c", "C", "Executing"), plain("n_d", "D", "Available")],
      },
      jobs: { "prj-1": [job("prj-1", "n_d"), job("prj-1", "n_e")], "prj-2": [job("prj-2", "n_d")] },
    });

    renderScreen();

    expect(await screen.findByText("3 executions run · 3 jobs wait")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open scheduler" })).toHaveAttribute(
      "href",
      "/scheduler",
    );
  });

  it("shows the Mission progress of each project in lifecycle order", async () => {
    serve({
      nodes: {
        "prj-1": [
          plain("n_a", "A", "Completed"),
          plain("n_b", "B", "Pending"),
          plain("n_c", "C", "Completed"),
        ],
        "prj-2": [plain("n_d", "D", "Executing")],
      },
    });

    renderScreen();

    expect(await screen.findByText("2 projects · 4 nodes · 2 completed")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Node states of kanthord" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Node states" }));
    const kanthord = await screen.findByRole("list", { name: "Node states of kanthord" });
    expect(
      within(kanthord)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Pending 1", "Completed 2"]);
    expect(
      within(screen.getByRole("list", { name: "Node states of atlas" })).getByText("Executing"),
    ).toBeInTheDocument();
  });
});

describe("OverviewScreen scope", () => {
  it("offers All projects first and shows both projects by default", async () => {
    serve({ nodes: { "prj-1": [blocked("n_a", "A")], "prj-2": [blocked("n_b", "B")] } });

    renderScreen();

    expect(await screen.findByRole("combobox", { name: "Project" })).toHaveTextContent(
      "All projects",
    );
    expect(screen.getByRole("link", { name: "A" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "B" })).toBeInTheDocument();
  });

  it("narrows the inbox, the status line and the link to the project of the parameter", async () => {
    serve({
      nodes: { "prj-1": [blocked("n_a", "A")], "prj-2": [blocked("n_b", "B")] },
      jobs: { "prj-1": [job("prj-1", "n_a")], "prj-2": [job("prj-2", "n_b"), job("prj-2", "n_c")] },
    });

    renderScreen("/?project=prj-2");

    expect(await screen.findByRole("link", { name: "B" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "A" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Project" })).toHaveTextContent("atlas");
    expect(screen.getByText("0 executions run · 2 jobs wait")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open scheduler" })).toHaveAttribute(
      "href",
      "/scheduler?project=prj-2",
    );
    expect(within(itemOf("B")).queryByText(/project atlas/)).toBeNull();
  });

  it("narrows the inbox when the human picks a project", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "A")], "prj-2": [blocked("n_b", "B")] } });
    renderScreen();

    await user.click(await screen.findByRole("combobox", { name: "Project" }));
    await user.click(await screen.findByRole("option", { name: "kanthord" }));

    expect(await screen.findByRole("link", { name: "A" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "B" })).toBeNull();
  });
});

describe("OverviewScreen assessment", () => {
  it("reads the rationale and shows it with the request evidence on the toggle", async () => {
    const user = userEvent.setup();
    const request: MissionEvidence = {
      id: "evidence_1",
      node_id: "n_a",
      attempt: 2,
      subject: "Pull request for the audit log",
      assets: [
        {
          id: "asset_1",
          kind: "platform",
          address: { kind: "pull_request", resource_identity: "github.com/atlas", number: 12 },
          published_at: null,
          expired_at: null,
        },
      ],
      provenance: { kind: "human", account: "kanthorlabs", name: "Kanthor Labs" },
      created_at: NOW - HOUR,
      requirement_key: "repo.pull_request",
      end_state: "other",
    };
    serve({
      nodes: {
        "prj-1": [
          blocked("n_a", "Audit log", {
            closingEvent: "external-failed",
            result: "undetermined",
            requests: [request],
          }),
        ],
      },
      rationales: { n_a: "The audit entry holds no actor." },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Audit log"));
    expect(within(item).getByText("External action failed")).toBeInTheDocument();
    await user.click(within(item).getByRole("button", { name: "Show assessment" }));

    expect(await within(item).findByText("The audit entry holds no actor.")).toBeInTheDocument();
    expect(
      within(item).getByText(
        "repo.pull_request: Pull request for the audit log, pull request #12 on github.com/atlas. End state other.",
      ),
    ).toBeInTheDocument();
    expect(listNodeAssessments).toHaveBeenCalledWith("n_a", 2);
    expect(within(item).getByRole("button", { name: "Hide assessment" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("shows the open fix proposal of an examine node in the panel", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })] },
      proposals: {
        n_t: [
          proposal("n_t", "Send the invite in the workspace language"),
          proposal("n_t", "Old", 5),
        ],
      },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Team workspaces"));
    await user.click(within(item).getByRole("button", { name: "Show assessment" }));

    expect(
      await within(item).findByText(
        textContent(
          "Send the invite in the workspace language: The invite email uses the workspace language.",
        ),
      ),
    ).toBeInTheDocument();
    expect(within(item).queryByText(/Old/)).toBeNull();
    expect(listNodeProposals).toHaveBeenCalledWith("n_t");
  });

  it("names a failed assessment read and retries it", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    vi.mocked(listNodeAssessments).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Audit log"));
    await user.click(within(item).getByRole("button", { name: "Show assessment" }));
    expect(
      await within(item).findByText("The assessment could not be read: The daemon did not answer."),
    ).toBeInTheDocument();
    vi.mocked(listNodeAssessments).mockResolvedValue([assessment("n_a", "Read after the retry.")]);
    await user.click(within(item).getByRole("button", { name: "Retry" }));

    expect(await within(item).findByText("Read after the retry.")).toBeInTheDocument();
  });
});

describe("OverviewScreen acts", () => {
  it("offers Unblock and Discard for an implement node at once", async () => {
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    renderScreen();

    const item = await waitFor(() => itemOf("Audit log"));
    expect(within(item).getByRole("button", { name: "Unblock" })).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("holds Unblock and Discard of an examine node until the proposals read answers", async () => {
    let answer: (value: readonly MissionProposal[]) => void = () => undefined;
    serve({ nodes: { "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })] } });
    vi.mocked(listNodeProposals).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Team workspaces"));
    expect(within(item).getByText(/Reading the fix proposals/)).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Unblock" })).toBeNull();
    expect(within(item).queryByRole("button", { name: "Discard" })).toBeNull();

    answer([]);

    expect(await within(item).findByRole("button", { name: "Unblock" })).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("keeps the acts of an examine node off when the proposals read fails", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })] } });
    vi.mocked(listNodeProposals).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Team workspaces"));
    expect(
      await within(item).findByText(
        textContent(
          "The fix proposals could not be read: The daemon did not answer.. Unblock and Discard wait for them. Retry",
        ),
      ),
    ).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Unblock" })).toBeNull();
    vi.mocked(listNodeProposals).mockResolvedValue([]);
    await user.click(within(item).getByRole("button", { name: "Retry" }));

    expect(await within(item).findByRole("button", { name: "Unblock" })).toBeInTheDocument();
  });

  it("names the rejected proposals in the Unblock dialog and sends the unblock", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })] },
      proposals: { n_t: [proposal("n_t", "Send the invite in the workspace language")] },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Team workspaces"));
    await user.click(await within(item).findByRole("button", { name: "Unblock" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(
        textContent(
          "Unblock rejects the open proposals: Send the invite in the workspace language. They stay recorded, but the examine node runs the next attempt without the fix node.",
        ),
      ),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Reason"), "Retry without the fix.");
    await user.click(within(dialog).getByRole("button", { name: "Unblock node" }));

    expect(unblockNode).toHaveBeenCalledWith("n_t", {
      blocked_attempt: 2,
      expected_revision: 3,
      expected_mission_version: 7,
      reason: "Retry without the fix.",
    });
    await waitFor(() => expect(vi.mocked(listMissionNodes).mock.calls.length).toBeGreaterThan(2));
  });

  it("discards after the reason and reads the inbox again", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-2": [blocked("n_b", "Localize the order email")] } });
    renderScreen();

    const item = await waitFor(() => itemOf("Localize the order email"));
    await user.click(within(item).getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    const action = within(dialog).getByRole("button", { name: "Discard node" });
    expect(action).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Reason"), "The feature moves.");
    await user.click(action);

    expect(discardNode).toHaveBeenCalledWith("n_b", {
      reason: "The feature moves.",
      expected_mission_version: 7,
      expected_state: "Blocked",
      expected_attempt: 2,
    });
    await waitFor(() => expect(vi.mocked(listMissionNodes).mock.calls.length).toBeGreaterThan(1));
  });
});

describe("OverviewScreen states", () => {
  it("shows All clear when no node waits and every read succeeded", async () => {
    serve({ nodes: { "prj-1": [plain("n_a", "A", "Pending")] } });

    renderScreen();

    expect(await screen.findByText("All clear")).toBeInTheDocument();
    expect(screen.getByText("No decision waits for you.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Decisions" })).toBeNull();
  });

  it("replaces All clear with an alert that names the missing records", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [], "prj-2": [] } });
    vi.mocked(readMission).mockImplementation(async (projectId) => {
      if (projectId === "prj-2") throw new ApiError("unreachable", "The daemon did not answer.", 0);
      return { id: `mission_${projectId}`, project_id: projectId, version: 7 };
    });

    renderScreen();

    expect(
      await screen.findByText(
        textContent(
          "Some records could not be read: atlas mission (The daemon did not answer.). The list can miss items.",
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
    vi.mocked(readMission).mockImplementation(async (projectId) => ({
      id: `mission_${projectId}`,
      project_id: projectId,
      version: 7,
    }));
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("All clear")).toBeInTheDocument();
  });

  it("keeps the last good nodes of a project when its next read fails", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")], "prj-2": [] } });
    renderScreen();
    await screen.findByRole("link", { name: "Audit log" });

    vi.mocked(listMissionNodes).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(
      await screen.findByText(textContent(/Some records could not be read: kanthord node list/)),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit log" })).toBeInTheDocument();
  });

  it("shows only the heading while the first read runs", () => {
    serve({});
    vi.mocked(listProjects).mockReturnValue(new Promise(() => undefined));

    renderScreen();

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Project" })).toBeNull();
  });

  it("shows an alert with Retry when the project list fails on the first read", async () => {
    const user = userEvent.setup();
    serve({});
    vi.mocked(listProjects).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    renderScreen();

    expect(await screen.findByText("The overview could not be read.")).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("All clear")).toBeInTheDocument();
  });
});

describe("OverviewScreen paused items", () => {
  it("names the Failure limit with the stop of the last execution", async () => {
    serve({
      nodes: { "prj-1": [paused("n_p", "Compute the shipping rates")] },
      executions: {
        n_p: [
          ended("e1", "n_p", {
            stop: { reason: "provider_failed", code: "rate_limited" },
            ended_at: NOW - 2 * HOUR,
          }),
          ended("e0", "n_p", { ended_at: NOW - 5 * HOUR }),
        ],
      },
    });

    renderScreen();

    const item = await waitFor(() => itemOf("Compute the shipping rates"));
    expect(await within(item).findByText("Failure limit")).toBeInTheDocument();
    expect(within(item).getByText("Paused")).toBeInTheDocument();
    expect(
      within(item).getByText("The last execution ended: provider failed (rate limited)."),
    ).toBeInTheDocument();
    expect(
      within(item).getByText(textContent("project kanthord · attempt 2 · 2 hours ago")),
    ).toBeInTheDocument();
    expect(listNodeExecutions).toHaveBeenCalledWith("prj-1", "n_p", 2);
    expect(listNodeExternalActions).toHaveBeenCalledWith("n_p", 2);
  });

  it("offers Last trace to the newest execution of a Paused node", async () => {
    serve({
      nodes: { "prj-1": [paused("n_p", "Compute the shipping rates")] },
      executions: {
        n_p: [
          ended("e1", "n_p", { created_at: NOW - 5 * HOUR, trace_id: "trace_mid" }),
          ended("e2", "n_p", { created_at: NOW - 3 * HOUR, trace_id: "trace_new" }),
          ended("e0", "n_p", { created_at: NOW - 9 * HOUR, trace_id: "trace_old" }),
        ],
      },
    });

    renderScreen();

    const item = await waitFor(() => itemOf("Compute the shipping rates"));
    expect(await within(item).findByRole("button", { name: "Last trace" })).toHaveAttribute(
      "href",
      "/traces/trace_new",
    );
  });

  it("shows the cause of the last trace beside Last trace", async () => {
    serve({
      nodes: { "prj-1": [paused("n_p", "Compute the shipping rates")] },
      executions: {
        n_p: [ended("e1", "n_p", { created_at: NOW - 3 * HOUR, trace_id: "trace_new" })],
      },
    });
    vi.mocked(listTracePage).mockResolvedValue({
      items: [
        {
          cause: { category: "llm_provider", assigner: "rule", subcategory: "rate_limited" },
        } as TraceListItem,
      ],
      next_cursor: null,
    });

    renderScreen();

    const item = await waitFor(() => itemOf("Compute the shipping rates"));
    expect(await within(item).findByText("LLM provider - rate limited")).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Last trace" })).toBeInTheDocument();
    expect(listTracePage).toHaveBeenCalledWith({ execution_id: "e1" }, null, 1);
  });

  it("offers no Last trace to a Paused node without an execution", async () => {
    serve({ nodes: { "prj-1": [paused("n_p", "Draft the notes")] } });

    renderScreen();

    const item = await waitFor(() => itemOf("Draft the notes"));
    expect(await within(item).findByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Last trace" })).toBeNull();
  });

  it("names a lost execution as the Failure limit and takes the expiry as its end", async () => {
    serve({
      nodes: { "prj-1": [paused("n_p", "Compute the shipping rates")] },
      executions: {
        n_p: [
          ended("e1", "n_p", {
            claim_state: "lost",
            ended_at: null,
            expired_at: NOW - 4 * HOUR,
          }),
        ],
      },
    });

    renderScreen();

    const item = await waitFor(() => itemOf("Compute the shipping rates"));
    expect(await within(item).findByText("Failure limit")).toBeInTheDocument();
    expect(within(item).getByText("The last execution ended: lost.")).toBeInTheDocument();
    expect(within(item).getByText(/4 hours ago/)).toBeInTheDocument();
  });

  it("names the Further-work limit after a budget end", async () => {
    serve({
      nodes: { "prj-1": [paused("n_p", "Print the packing slip")] },
      executions: {
        n_p: [ended("e1", "n_p", { stop: { reason: "budget_end", code: "turns" } })],
      },
    });

    renderScreen();

    const item = await waitFor(() => itemOf("Print the packing slip"));
    expect(await within(item).findByText("Further-work limit")).toBeInTheDocument();
    expect(
      within(item).getByText("The last execution ended at its budget (turns)."),
    ).toBeInTheDocument();
  });

  it("names a pause by a human with an unknown age when no execution ran", async () => {
    serve({ nodes: { "prj-1": [paused("n_p", "Draft the notes")] } });

    renderScreen();

    const item = await waitFor(() => itemOf("Draft the notes"));
    expect(await within(item).findByText("Paused by a human")).toBeInTheDocument();
    expect(
      within(item).getByText(textContent("project kanthord · attempt 2 · age unknown")),
    ).toBeInTheDocument();
    expect(within(item).getByText("No execution limit explains the pause.")).toBeInTheDocument();
  });

  it("holds Discard of a Paused node until the executions and the actions answer", async () => {
    let answer: (value: readonly MissionExternalAction[]) => void = () => undefined;
    serve({ nodes: { "prj-1": [paused("n_p", "Draft the notes")] } });
    vi.mocked(listNodeExternalActions).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Draft the notes"));
    expect(
      within(item).getByText(/Reading the executions and the external actions of attempt 2/),
    ).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Discard" })).toBeNull();

    answer([]);

    expect(await within(item).findByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("keeps Discard off and names the reason when an unresolved request waits", async () => {
    serve({
      nodes: { "prj-1": [paused("n_p", "Publish the changelog")] },
      actions: { n_p: [requested("n_p", "unresolved")] },
    });

    renderScreen();

    const item = await waitFor(() => itemOf("Publish the changelog"));
    expect(
      await within(item).findByText(
        "Attempt 2 has an unresolved pull request. Override and discard wait for its end state. Resume the node.",
      ),
    ).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it("keeps Discard off when a read fails and reads again on Retry", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [paused("n_p", "Draft the notes")] } });
    vi.mocked(listNodeExecutions).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Draft the notes"));
    expect(
      await within(item).findByText(
        "The executions or the external actions of attempt 2 could not be read: The daemon did not answer. The controls wait for them.",
      ),
    ).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Discard" })).toBeNull();
    await user.click(within(item).getByRole("button", { name: "Retry" }));

    expect(await within(item).findByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("offers Resume, Override and Discard for a Paused node at attempt 0 without a read", async () => {
    serve({ nodes: { "prj-1": [paused("n_p", "Draft the notes", 0)] } });
    vi.mocked(listNodeExecutions).mockRejectedValue(
      new ApiError("malformed", "Request validation failed.", 400),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Draft the notes"));
    expect(await within(item).findByRole("button", { name: "Resume" })).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Override" })).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Discard" })).toBeInTheDocument();
    expect(within(item).getByText("Paused by a human")).toBeInTheDocument();
    expect(listNodeExecutions).not.toHaveBeenCalled();
    expect(listNodeExternalActions).not.toHaveBeenCalled();
  });

  it("discards a Paused node with the expected state Paused", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [paused("n_p", "Draft the notes", 3)] } });
    renderScreen();

    const item = await waitFor(() => itemOf("Draft the notes"));
    await user.click(await within(item).findByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "The feature moves.");
    await user.click(within(dialog).getByRole("button", { name: "Discard node" }));

    expect(discardNode).toHaveBeenCalledWith("n_p", {
      reason: "The feature moves.",
      expected_mission_version: 7,
      expected_state: "Paused",
      expected_attempt: 3,
    });
  });
});

describe("OverviewScreen dependency items", () => {
  const world = {
    nodes: {
      "prj-2": [
        pending("n_c", "Redirect the legacy links", ["n_b", "n_ok"]),
        plain("n_b", "Drop the legacy checkout", "Discarded"),
        plain("n_ok", "Export the orders", "Completed"),
      ],
    },
  };

  it("lists a Pending node that depends on a Discarded node", async () => {
    serve(world);

    renderScreen();

    const item = await waitFor(() => itemOf("Redirect the legacy links"));
    expect(within(item).getByText("Pending")).toBeInTheDocument();
    expect(within(item).getByText("Discarded dependency")).toBeInTheDocument();
    expect(
      within(item).getByText(
        textContent(
          "It depends on Drop the legacy checkout, which is Discarded. A discarded node satisfies no dependency.",
        ),
      ),
    ).toBeInTheDocument();
    expect(
      within(item).getByText(textContent("project atlas · no attempt · age unknown")),
    ).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Show assessment" })).toBeNull();
    expect(listNodeExecutions).not.toHaveBeenCalled();
  });

  it("offers Discard at once and sends it with the expected state Pending", async () => {
    const user = userEvent.setup();
    serve(world);
    renderScreen();

    const item = await waitFor(() => itemOf("Redirect the legacy links"));
    await user.click(within(item).getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "The links die with the checkout.");
    await user.click(within(dialog).getByRole("button", { name: "Discard node" }));

    expect(discardNode).toHaveBeenCalledWith("n_c", {
      reason: "The links die with the checkout.",
      expected_mission_version: 7,
      expected_state: "Pending",
      expected_attempt: 0,
    });
  });
});

describe("OverviewScreen dependency items with an open attempt", () => {
  function started(): MissionNodeRecord {
    return { ...pending("n_c", "Redirect the legacy links", ["n_b"]), attempt: 2 };
  }

  it("keeps Discard off and names the unresolved request without the Resume sentence", async () => {
    serve({
      nodes: { "prj-2": [started(), plain("n_b", "Drop the legacy checkout", "Discarded")] },
      actions: { n_c: [requested("n_c", "unresolved")] },
    });

    renderScreen();

    const item = await waitFor(() => itemOf("Redirect the legacy links"));
    expect(
      await within(item).findByText(
        "Attempt 2 has an unresolved pull request. Discard waits for its end state.",
      ),
    ).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Discard" })).toBeNull();
    expect(listNodeExternalActions).toHaveBeenCalledWith("n_c", 2);
    expect(listNodeExecutions).not.toHaveBeenCalled();
  });

  it("names the acts that wait when the external actions read fails", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-2": [started(), plain("n_b", "Drop the legacy checkout", "Discarded")] },
    });
    vi.mocked(listNodeExternalActions).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Redirect the legacy links"));
    expect(
      await within(item).findByText(
        "The external actions of attempt 2 could not be read: The daemon did not answer. Check now, Remove dependency and Discard wait for them.",
      ),
    ).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Discard" })).toBeNull();
    await user.click(within(item).getByRole("button", { name: "Retry" }));

    expect(await within(item).findByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("holds Discard until the external actions answer", async () => {
    let answer: (value: readonly MissionExternalAction[]) => void = () => undefined;
    serve({
      nodes: { "prj-2": [started(), plain("n_b", "Drop the legacy checkout", "Discarded")] },
    });
    vi.mocked(listNodeExternalActions).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Redirect the legacy links"));
    expect(
      within(item).getByText(/Reading the external actions of attempt 2\. The acts show/),
    ).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Discard" })).toBeNull();

    answer([]);

    expect(await within(item).findByRole("button", { name: "Discard" })).toBeInTheDocument();
  });
});

describe("OverviewScreen proposal approval", () => {
  it("approves the open proposal of an examine node in place", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })] },
      proposals: { n_t: [proposal("n_t", "Send the invite in the workspace language")] },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Team workspaces"));
    await user.click(await within(item).findByRole("button", { name: "Approve proposal" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("Approve the proposal Send the invite in the workspace language?"),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Reason"), "The fix is right.");
    await user.click(within(dialog).getByRole("button", { name: "Approve proposal" }));

    expect(approveProposal).toHaveBeenCalledWith(
      "proposal_Send the invite in the workspace language",
      {
        expected_mission_version: 7,
        reason: "The fix is right.",
      },
    );
  });

  it("offers no approval for an approved proposal or for an implement node", async () => {
    serve({
      nodes: {
        "prj-1": [
          blocked("n_t", "Team workspaces", { intent: "examine" }),
          blocked("n_a", "Audit log"),
        ],
      },
      proposals: { n_t: [proposal("n_t", "Old fix", 5)] },
    });

    renderScreen();

    const item = await waitFor(() => itemOf("Team workspaces"));
    await within(item).findByRole("button", { name: "Unblock" });
    expect(screen.queryByRole("button", { name: "Approve proposal" })).toBeNull();
  });
});

describe("OverviewScreen focus handoff", () => {
  it("moves focus to the title of the next item after a discard removes an item", async () => {
    const user = userEvent.setup();
    const nodes: Record<string, MissionNodeRecord[]> = {
      "prj-1": [
        blocked("n_a", "First item", { createdAt: NOW - 9 * HOUR }),
        blocked("n_b", "Second item", { createdAt: NOW - 8 * HOUR }),
        blocked("n_c", "Third item", { createdAt: NOW - 7 * HOUR }),
      ],
    };
    serve({ nodes });
    vi.mocked(discardNode).mockImplementation(async (nodeId) => {
      nodes["prj-1"] = (nodes["prj-1"] ?? []).filter((node) => node.id !== nodeId);
      return {} as MissionControlResult;
    });
    renderScreen();

    const second = await waitFor(() => itemOf("Second item"));
    await user.click(within(second).getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Out of scope.");
    await user.click(within(dialog).getByRole("button", { name: "Discard node" }));

    await waitFor(() => expect(screen.queryByRole("link", { name: "Second item" })).toBeNull());
    await waitFor(() => expect(screen.getByRole("link", { name: "Third item" })).toHaveFocus());
  });

  it("moves focus to the title of the new item when an act changes the kind of the item", async () => {
    const user = userEvent.setup();
    const nodes: Record<string, MissionNodeRecord[]> = {
      "prj-1": [
        paused("n_p", "Compute the rates", 3),
        plain("n_b", "Drop the legacy checkout", "Discarded"),
      ],
    };
    serve({ nodes });
    vi.mocked(resumeNode).mockImplementation(async () => {
      nodes["prj-1"] = [
        { ...pending("n_p", "Compute the rates", ["n_b"]), attempt: 0 },
        plain("n_b", "Drop the legacy checkout", "Discarded"),
      ];
      return {} as MissionControlResult;
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Compute the rates"));
    await user.click(await within(item).findByRole("button", { name: "Resume" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Try again.");
    await user.click(within(dialog).getByRole("button", { name: "Resume node" }));

    await waitFor(() =>
      expect(within(itemOf("Compute the rates")).getByText("Discarded dependency")).toBeVisible(),
    );
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Compute the rates" })).toHaveFocus(),
    );
  });

  it("moves focus to the last item when the discarded item was the last", async () => {
    const user = userEvent.setup();
    const nodes: Record<string, MissionNodeRecord[]> = {
      "prj-1": [
        blocked("n_a", "First item", { createdAt: NOW - 9 * HOUR }),
        blocked("n_b", "Second item", { createdAt: NOW - 8 * HOUR }),
      ],
    };
    serve({ nodes });
    vi.mocked(discardNode).mockImplementation(async (nodeId) => {
      nodes["prj-1"] = (nodes["prj-1"] ?? []).filter((node) => node.id !== nodeId);
      return {} as MissionControlResult;
    });
    renderScreen();

    const second = await waitFor(() => itemOf("Second item"));
    await user.click(within(second).getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Out of scope.");
    await user.click(within(dialog).getByRole("button", { name: "Discard node" }));

    await waitFor(() => expect(screen.getByRole("link", { name: "First item" })).toHaveFocus());
  });

  it("moves focus to the next shown item while a group filter narrows the inbox", async () => {
    const user = userEvent.setup();
    const nodes: Record<string, MissionNodeRecord[]> = {
      "prj-1": [
        blocked("n_a", "First item", { createdAt: NOW - 9 * HOUR }),
        blocked("n_b", "Second item", { createdAt: NOW - 8 * HOUR }),
      ],
      "prj-2": [],
    };
    serve({ projects: [{ ...KANTHORD, paused_at: NOW - HOUR }, ATLAS], nodes });
    vi.mocked(discardNode).mockImplementation(async (nodeId) => {
      nodes["prj-1"] = (nodes["prj-1"] ?? []).filter((node) => node.id !== nodeId);
      return {} as MissionControlResult;
    });
    renderScreen();

    const filter = await screen.findByRole("group", { name: "Show the items of" });
    await user.click(within(filter).getByRole("button", { name: "Decisions · 2" }));
    const second = await waitFor(() => itemOf("Second item"));
    await user.click(within(second).getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Out of scope.");
    await user.click(within(dialog).getByRole("button", { name: "Discard node" }));

    await waitFor(() => expect(screen.getByRole("link", { name: "First item" })).toHaveFocus());
  });

  it("moves focus to the All clear title when no item is left", async () => {
    const user = userEvent.setup();
    const nodes: Record<string, MissionNodeRecord[]> = {
      "prj-1": [blocked("n_a", "Only item")],
    };
    serve({ nodes });
    vi.mocked(discardNode).mockImplementation(async (nodeId) => {
      nodes["prj-1"] = (nodes["prj-1"] ?? []).filter((node) => node.id !== nodeId);
      return {} as MissionControlResult;
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Only item"));
    await user.click(within(item).getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Out of scope.");
    await user.click(within(dialog).getByRole("button", { name: "Discard node" }));

    await waitFor(() => expect(screen.getByText("All clear")).toHaveFocus());
  });

  it("moves no focus when the human cancels a dialog", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "First item"), blocked("n_b", "Second item")] } });
    renderScreen();

    const first = await waitFor(() => itemOf("First item"));
    await user.click(within(first).getByRole("button", { name: "Discard" }));
    await user.click(await screen.findByRole("button", { name: "Keep the node" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByRole("link", { name: "Second item" })).not.toHaveFocus();
  });
});

describe("OverviewScreen polling", () => {
  it("holds the poll while a dialog is open and reads at once after it closes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    serve({ nodes: { "prj-1": [blocked("n_a", "First item")] } });
    renderScreen();

    const item = await waitFor(() => itemOf("First item"));
    await user.click(within(item).getByRole("button", { name: "Discard" }));
    await screen.findByRole("alertdialog");
    const reads = vi.mocked(listProjects).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    expect(vi.mocked(listProjects).mock.calls.length).toBe(reads);
    await user.click(screen.getByRole("button", { name: "Keep the node" }));

    await waitFor(() => expect(vi.mocked(listProjects).mock.calls.length).toBeGreaterThan(reads));
  });

  it("reads the inbox again every 15 s while no dialog is open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve({ nodes: { "prj-1": [blocked("n_a", "First item")] } });
    renderScreen();
    await waitFor(() => itemOf("First item"));
    const reads = vi.mocked(listProjects).mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_100);
    });

    expect(vi.mocked(listProjects).mock.calls.length).toBeGreaterThan(reads);
  });
});

describe("OverviewScreen override", () => {
  it("overrides a Blocked node with the result success", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    renderScreen();

    const item = await waitFor(() => itemOf("Audit log"));
    await user.click(within(item).getByRole("button", { name: "Override" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("To run it again, unblock it.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Reason"), "Verified by hand.");
    await user.click(within(dialog).getByRole("button", { name: "Override node" }));

    expect(overrideNode).toHaveBeenCalledWith("n_a", {
      reason: "Verified by hand.",
      expected_mission_version: 7,
      expected_state: "Blocked",
      expected_attempt: 2,
      result: "success",
    });
  });

  it("overrides a Paused node after the actions answer and names the resume as the safer path", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [paused("n_p", "Draft the notes", 3)] } });
    renderScreen();

    const item = await waitFor(() => itemOf("Draft the notes"));
    await user.click(await within(item).findByRole("button", { name: "Override" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("To continue the work, resume it.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Reason"), "Done elsewhere.");
    await user.click(within(dialog).getByRole("button", { name: "Override node" }));

    expect(overrideNode).toHaveBeenCalledWith("n_p", {
      reason: "Done elsewhere.",
      expected_mission_version: 7,
      expected_state: "Paused",
      expected_attempt: 3,
      result: "success",
    });
  });

  it("shows the message of a state conflict in the dialog and reads the inbox again", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    vi.mocked(overrideNode).mockRejectedValue(
      new ApiError("conflict", "State conflict.", 409, "mission.node.state_conflict"),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Audit log"));
    await user.click(within(item).getByRole("button", { name: "Override" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Verified.");
    const reads = vi.mocked(listMissionNodes).mock.calls.length;
    await user.click(within(dialog).getByRole("button", { name: "Override node" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The state or the attempt of the node changed after this read. The view now shows its current state. Review it and override again.",
    );
    await waitFor(() =>
      expect(vi.mocked(listMissionNodes).mock.calls.length).toBeGreaterThan(reads),
    );
  });

  it("shows the conflict in a toast when the refresh removes the item", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    vi.mocked(overrideNode).mockRejectedValue(
      new ApiError("conflict", "State conflict.", 409, "mission.node.state_conflict"),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Audit log"));
    await user.click(within(item).getByRole("button", { name: "Override" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Verified.");
    vi.mocked(listMissionNodes).mockResolvedValue([]);
    await user.click(within(dialog).getByRole("button", { name: "Override node" }));

    await waitFor(() => expect(screen.queryByRole("link", { name: "Audit log" })).toBeNull());
    expect(toast.error).toHaveBeenCalledWith("Overriding Audit log failed.", {
      description: expect.stringContaining("The state or the attempt of the node changed"),
    });
  });

  it("offers no Override for a Pending node that waits on a Discarded node", async () => {
    serve({
      nodes: {
        "prj-2": [
          pending("n_c", "Redirect the legacy links", ["n_b"]),
          plain("n_b", "Drop the legacy checkout", "Discarded"),
        ],
      },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Redirect the legacy links"));

    expect(within(item).queryByRole("button", { name: "Override" })).toBeNull();
  });
});

describe("OverviewScreen resume", () => {
  it("resumes a Paused node to Available at the Failure limit", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [paused("n_p", "Compute the rates", 3)] },
      executions: {
        n_p: [ended("e1", "n_p", { claim_state: "lost", ended_at: null, expired_at: NOW - HOUR })],
      },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Compute the rates"));
    await within(item).findByText("Failure limit");
    await user.click(within(item).getByRole("button", { name: "Resume" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(textContent("Resume returns Compute the rates to Available.")),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("A resume resets no failure count, so it grants one more try."),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Reason"), "Try again.");
    await user.click(within(dialog).getByRole("button", { name: "Resume node" }));

    expect(resumeNode).toHaveBeenCalledWith("n_p", {
      reason: "Try again.",
      expected_mission_version: 7,
      expected_state: "Paused",
      expected_attempt: 3,
      target: "Available",
    });
  });

  it("defaults the resume at the Further-work limit to Waiting and lets the human pick Available", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [paused("n_p", "Print the packing slip")] },
      executions: { n_p: [ended("e1", "n_p", { stop: { reason: "budget_end", code: "turns" } })] },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Print the packing slip"));
    await within(item).findByText("Further-work limit");
    await user.click(within(item).getByRole("button", { name: "Resume" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(
        textContent("Resume returns Print the packing slip to Waiting for its evaluation."),
      ),
    ).toBeInTheDocument();
    const target = within(dialog).getByRole("radiogroup", { name: "Resume to" });
    expect(within(target).getByRole("radio", { name: "Waiting" })).toBeChecked();
    await user.click(within(target).getByRole("radio", { name: "Available" }));
    expect(within(target).getByRole("radio", { name: "Available" })).toBeChecked();

    expect(
      within(dialog).getByText(textContent(/Resume returns Print the packing slip to Available\./)),
    ).toBeInTheDocument();
    expect(within(dialog).getByText(/A resume resets no stall count/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Reason"), "Another try.");
    await user.click(within(dialog).getByRole("button", { name: "Resume node" }));

    expect(resumeNode).toHaveBeenCalledWith(
      "n_p",
      expect.objectContaining({ target: "Available", reason: "Another try." }),
    );
  });

  it("names what Waiting needs when a dependency is open", async () => {
    const user = userEvent.setup();
    const dependent: MissionNodeRecord = {
      ...paused("n_p", "Print the packing slip"),
      depends_on: ["n_form"],
    };
    serve({
      nodes: { "prj-1": [dependent, plain("n_form", "Sign-up form", "Executing")] },
      executions: { n_p: [ended("e1", "n_p", { stop: { reason: "budget_end", code: "turns" } })] },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Print the packing slip"));
    await within(item).findByText("Further-work limit");
    await user.click(within(item).getByRole("button", { name: "Resume" }));
    const dialog = await screen.findByRole("alertdialog");

    expect(
      within(dialog).getByText(
        textContent(
          "Resume returns Print the packing slip to Pending, because Sign-up form is not Completed.",
        ),
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        textContent("Available. Waiting needs: Sign-up form to be Completed."),
      ),
    ).toBeInTheDocument();
  });

  it("offers Resume but no Override or Discard while a request is unresolved", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [paused("n_p", "Publish the changelog")] },
      actions: { n_p: [requested("n_p", "unresolved")] },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Publish the changelog"));
    await user.click(await within(item).findByRole("button", { name: "Resume" }));
    const dialog = await screen.findByRole("alertdialog");

    expect(
      within(dialog).getByText(
        textContent(
          "Resume returns Publish the changelog to External.Requested, because its request is still open.",
        ),
      ),
    ).toBeInTheDocument();
    expect(within(dialog).queryByText("Resume to")).toBeNull();
    await user.click(within(dialog).getByRole("button", { name: "Keep it paused" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(within(item).queryByRole("button", { name: "Override" })).toBeNull();
    expect(within(item).queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it("shows the message of a not-ready conflict and keeps the dialog open", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [paused("n_p", "Draft the notes")] } });
    vi.mocked(resumeNode).mockRejectedValue(
      new ApiError("conflict", "Not ready.", 409, "mission.node.not_ready"),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Draft the notes"));
    await user.click(await within(item).findByRole("button", { name: "Resume" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Try.");
    await user.click(within(dialog).getByRole("button", { name: "Resume node" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The node is not ready for its evaluation. The view now shows its current state. Resume to Available instead.",
    );
  });
});

describe("OverviewScreen dependency removal", () => {
  it("removes the dependency on a Discarded node after the reason", async () => {
    const user = userEvent.setup();
    serve({
      nodes: {
        "prj-2": [
          pending("n_c", "Redirect the legacy links", ["n_b", "n_x"]),
          plain("n_b", "Drop the legacy checkout", "Discarded"),
          plain("n_x", "Drop the old login", "Discarded"),
        ],
      },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Redirect the legacy links"));
    await user.click(
      within(item).getByRole("button", { name: "Remove dependency on Drop the legacy checkout" }),
    );
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(
        textContent(
          "Remove dependency deletes the edge from Redirect the legacy links to Drop the legacy checkout. Redirect the legacy links can start when its other dependencies are Completed. The edit changes the mission version.",
        ),
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        textContent("To end Redirect the legacy links instead, discard it."),
      ),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Reason"), "The checkout is gone.");
    await user.click(within(dialog).getByRole("button", { name: "Remove dependency" }));

    expect(removeDependency).toHaveBeenCalledWith("n_c", "n_b", {
      reason: "The checkout is gone.",
      expected_mission_version: 7,
    });
    expect(
      within(item).getByRole("button", { name: "Remove dependency on Drop the old login" }),
    ).toBeInTheDocument();
  });

  it("shows the message of a version conflict in the dialog", async () => {
    const user = userEvent.setup();
    serve({
      nodes: {
        "prj-2": [
          pending("n_c", "Redirect the legacy links", ["n_b"]),
          plain("n_b", "Drop the legacy checkout", "Discarded"),
        ],
      },
    });
    vi.mocked(removeDependency).mockRejectedValue(
      new ApiError("conflict", "Version.", 409, "mission.version.conflict"),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Redirect the legacy links"));
    await user.click(within(item).getByRole("button", { name: /Remove dependency on/ }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Gone.");
    await user.click(within(dialog).getByRole("button", { name: "Remove dependency" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "The mission changed after this read. The view now shows the current mission. Review the node and remove the dependency again.",
    );
  });
});

describe("OverviewScreen dialog focus", () => {
  async function expectReasonFocused() {
    const dialog = await screen.findByRole("alertdialog");
    await waitFor(() => expect(within(dialog).getByLabelText("Reason")).toHaveFocus());
  }

  it("focuses Reason first in the Unblock, Override and Discard dialogs", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    renderScreen();
    const item = await waitFor(() => itemOf("Audit log"));

    for (const act of ["Unblock", "Override", "Discard"]) {
      await user.click(within(item).getByRole("button", { name: act }));
      await expectReasonFocused();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    }
  });

  it("focuses Reason first in the Approve proposal dialog", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })] },
      proposals: { n_t: [proposal("n_t", "Send the invite in the workspace language")] },
    });
    renderScreen();
    const item = await waitFor(() => itemOf("Team workspaces"));

    await user.click(await within(item).findByRole("button", { name: "Approve proposal" }));

    await expectReasonFocused();
  });

  it("focuses Reason first in the Resume dialog that offers a target choice", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [paused("n_p", "Print the packing slip")] },
      executions: { n_p: [ended("e1", "n_p", { stop: { reason: "budget_end", code: "turns" } })] },
    });
    renderScreen();
    const item = await waitFor(() => itemOf("Print the packing slip"));
    await within(item).findByText("Further-work limit");

    await user.click(within(item).getByRole("button", { name: "Resume" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("radiogroup", { name: "Resume to" })).toBeInTheDocument();
    await expectReasonFocused();
  });

  it("focuses Reason first in the Remove dependency dialog", async () => {
    const user = userEvent.setup();
    serve({
      nodes: {
        "prj-2": [
          pending("n_c", "Redirect the legacy links", ["n_b"]),
          plain("n_b", "Drop the legacy checkout", "Discarded"),
        ],
      },
    });
    renderScreen();
    const item = await waitFor(() => itemOf("Redirect the legacy links"));

    await user.click(within(item).getByRole("button", { name: /Remove dependency/ }));

    await expectReasonFocused();
  });
});

describe("OverviewScreen waiting outside kanthord", () => {
  let AGED = 0;

  beforeEach(() => {
    AGED = NOW - 25 * 60_000;
  });

  it("lists a pull request that waits for a human merge with its text and age", async () => {
    serve({
      nodes: { "prj-2": [outside("n_o", "Stripe webhook")] },
      actions: { n_o: [requested("n_o", "unresolved")] },
      evidence: { n_o: [requestEvidence("n_o", AGED)] },
    });

    renderScreen();

    const item = await waitFor(() => itemOf("Stripe webhook"));
    expect(within(item).getByText("External.Requested")).toBeInTheDocument();
    expect(within(item).getByText("Waits for merge")).toBeInTheDocument();
    expect(
      within(item).getByText(
        textContent(
          "Pull request #12 on github.com/kanthorlabs/atlas waits for a merge. Merge it, then check.",
        ),
      ),
    ).toBeInTheDocument();
    expect(
      within(item).getByText(textContent("project atlas · attempt 2 · 25 minutes ago")),
    ).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Check now" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Waiting outside kanthord" })).toBeInTheDocument();
    expect(screen.getByText("1 waiting outside")).toBeInTheDocument();
  });

  it("lists a push as unconfirmed after 10 minutes and names it", async () => {
    serve({
      nodes: { "prj-1": [outside("n_o", "Publish the changelog")] },
      actions: { n_o: [requested("n_o", "unresolved", { action: "merge_push" })] },
      evidence: { n_o: [requestEvidence("n_o", AGED, null)] },
    });

    renderScreen();

    const item = await waitFor(() => itemOf("Publish the changelog"));
    expect(within(item).getByText("Delivery not confirmed")).toBeInTheDocument();
    expect(
      within(item).getByText(
        textContent(
          "kanthord pushed to main 25 minutes ago, and no end state arrived. Check the delivery.",
        ),
      ),
    ).toBeInTheDocument();
  });

  it("lists no fresh delivery and shows All clear", async () => {
    serve({
      nodes: { "prj-1": [outside("n_o", "Publish the changelog")] },
      actions: { n_o: [requested("n_o", "unresolved", { action: "merge_push" })] },
      evidence: { n_o: [requestEvidence("n_o", NOW - 9 * 60_000, null)] },
    });

    renderScreen();

    expect(await screen.findByText("All clear")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Publish the changelog" })).toBeNull();
  });

  it("holds All clear back while the external reads run", async () => {
    let settle: (actions: readonly MissionExternalAction[]) => void = () => undefined;
    serve({ nodes: { "prj-1": [outside("n_o", "Stripe webhook")] } });
    vi.mocked(listNodeExternalActions).mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );

    renderScreen();

    await screen.findByText("Needs you");
    expect(screen.queryByText("All clear")).toBeNull();
    await act(async () => settle([]));
    expect(await screen.findByText("All clear")).toBeInTheDocument();
  });

  it("holds All clear back for a project that the setup read omits", async () => {
    serve({ nodes: { "prj-1": [], "prj-2": [] } });
    vi.mocked(listProjects)
      .mockResolvedValueOnce([KANTHORD, ATLAS])
      .mockResolvedValueOnce([KANTHORD]);

    renderScreen();

    await screen.findByText("Needs you");
    expect(screen.queryByText("All clear")).toBeNull();
  });

  it("names a failed external read in the alert and suppresses All clear", async () => {
    serve({ nodes: { "prj-1": [outside("n_o", "Stripe webhook")] } });
    vi.mocked(listNodeExternalActions).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );

    renderScreen();

    expect(
      await screen.findByText(
        textContent(
          "Some records could not be read: kanthord external actions of Stripe webhook (The daemon did not answer.). The list can miss items.",
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
  });

  it("shows Checking, then Merged, and sends only the mission version", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-2": [outside("n_o", "Stripe webhook")] },
      actions: { n_o: [requested("n_o", "unresolved")] },
      evidence: { n_o: [requestEvidence("n_o", AGED)] },
    });
    let settle: (answer: MissionNodeCheckAnswer) => void = () => undefined;
    vi.mocked(checkNode).mockReturnValue(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Stripe webhook"));
    await user.click(await within(item).findByRole("button", { name: "Check now" }));

    expect(checkNode).toHaveBeenCalledWith("n_o", { expected_mission_version: 7 });
    expect(within(item).getByText("Checking")).toBeInTheDocument();
    await act(async () =>
      settle({
        results: [
          {
            evidence_id: "evidence_1",
            requirement_key: "repo.pull_request",
            resolution: "expected-end",
          },
        ],
        failures: [],
      }),
    );

    expect(await within(item).findByText("Merged")).toBeInTheDocument();
    expect(within(item).queryByText("Checking")).toBeNull();
  });

  it("shows Not delivered yet for an unresolved result and one toast for each failure", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-2": [outside("n_o", "Stripe webhook")] },
      actions: { n_o: [requested("n_o", "unresolved")] },
      evidence: { n_o: [requestEvidence("n_o", AGED)] },
    });
    vi.mocked(checkNode).mockResolvedValue({
      results: [
        {
          evidence_id: "evidence_1",
          requirement_key: "repo.pull_request",
          resolution: "unresolved",
        },
      ],
      failures: [
        {
          evidence_id: "evidence_2",
          error: {
            error: { code: "system.operation.unknown", message: "Unknown failure.", details: null },
            request_id: "request_1",
          },
        },
      ],
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Stripe webhook"));
    await user.click(await within(item).findByRole("button", { name: "Check now" }));

    expect(await within(item).findByText("Not delivered yet")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.error).mock.calls[0]?.[1]).toMatchObject({
      description: "Unknown failure. (system.operation.unknown)",
      action: { label: "Retry" },
    });
  });

  it("reads the inbox again after a check", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-2": [outside("n_o", "Stripe webhook")] },
      actions: { n_o: [requested("n_o", "unresolved")] },
      evidence: { n_o: [requestEvidence("n_o", AGED)] },
    });
    vi.mocked(checkNode).mockResolvedValue({ results: [], failures: [] });
    renderScreen();
    const item = await waitFor(() => itemOf("Stripe webhook"));
    const reads = vi.mocked(listProjects).mock.calls.length;

    await user.click(await within(item).findByRole("button", { name: "Check now" }));

    await waitFor(() => expect(vi.mocked(listProjects).mock.calls.length).toBeGreaterThan(reads));
  });

  it("offers Check now on a Paused node with an unresolved request and no other node act that conflicts", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [paused("n_p", "Publish the changelog")] },
      actions: { n_p: [requested("n_p", "unresolved")] },
    });
    vi.mocked(checkNode).mockResolvedValue({
      results: [
        {
          evidence_id: "evidence_1",
          requirement_key: "repo.pull_request",
          resolution: "other-end",
        },
      ],
      failures: [],
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Publish the changelog"));
    await user.click(await within(item).findByRole("button", { name: "Check now" }));

    expect(await within(item).findByText("Ended in another state")).toBeInTheDocument();
    expect(checkNode).toHaveBeenCalledWith("n_p", { expected_mission_version: 7 });
  });

  it("offers no Check now on a Paused node whose requests hold their end state", async () => {
    serve({
      nodes: { "prj-1": [paused("n_p", "Publish the changelog")] },
      actions: { n_p: [requested("n_p", "expected-end")] },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Publish the changelog"));
    await within(item).findByRole("button", { name: "Resume" });

    expect(within(item).queryByRole("button", { name: "Check now" })).toBeNull();
  });

  it("moves focus to the next item after a check removes an item", async () => {
    const user = userEvent.setup();
    const nodes: Record<string, MissionNodeRecord[]> = {
      "prj-1": [outside("n_a", "First wait"), outside("n_b", "Second wait")],
    };
    serve({
      nodes,
      actions: { n_a: [requested("n_a", "unresolved")], n_b: [requested("n_b", "unresolved")] },
      evidence: {
        n_a: [requestEvidence("n_a", NOW - 40 * 60_000)],
        n_b: [requestEvidence("n_b", NOW - 30 * 60_000)],
      },
    });
    vi.mocked(checkNode).mockImplementation(async (nodeId) => {
      nodes["prj-1"] = (nodes["prj-1"] ?? []).filter((node) => node.id !== nodeId);
      return { results: [], failures: [] };
    });
    renderScreen();

    const first = await waitFor(() => itemOf("First wait"));
    await user.click(await within(first).findByRole("button", { name: "Check now" }));

    await waitFor(() => expect(screen.queryByRole("link", { name: "First wait" })).toBeNull());
    await waitFor(() => expect(screen.getByRole("link", { name: "Second wait" })).toHaveFocus());
  });
});

function agedJob(projectId: string, nodeId: string, ageMs: number): SchedulerJob {
  return {
    job_id: `job_${newUlid(NOW - FIRST_JOB_AGE_MS)}`,
    project_id: projectId,
    node_id: nodeId,
    priority: 0,
    queued_at: NOW - ageMs,
  };
}

function workerBinding(
  name: string,
  worker: string,
  placement?: "server" | "worker",
  projectId = "prj-1",
): WorkerBindingRecord {
  return {
    id: `binding_${name}`,
    project_id: projectId,
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

function agentView(agent: string, overrides: Partial<BindingAgentView> = {}): BindingAgentView {
  return {
    agent,
    worker: "coder@1",
    worker_binding_id: "binding_coder-main",
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

function llmCredential(name: string, createdAt: number): Credential {
  return {
    name,
    platform: "openai-compatible",
    holder: "server",
    sealed_to: null,
    sealed_current: true,
    revisions: [
      {
        id: `credential_${name}`,
        revision: 1,
        metadata: null,
        created_at: createdAt,
        ended_at: null,
      },
    ],
  };
}

function providerStop(
  id: string,
  nodeId: string,
  code: "unauthorized" | "bad_request",
  credential = "openai-main",
  agent = "swe@1",
): SchedulerExecutionRecord {
  return ended(id, nodeId, {
    stop: { reason: "provider_failed", code },
    ended_at: NOW - 2 * HOUR,
    agent_selections: [
      {
        agent_name: agent,
        position: 0,
        level: "enablement",
        agent_provider: "openai-org",
        provider: "openai-compatible",
        credential,
        model_identifier: "gpt-5",
        reasoning_effort: "off",
      },
    ],
  });
}

describe("OverviewScreen fixes", () => {
  it("lists a failed environment and opens its project", async () => {
    serve({ environments: { "prj-1": [failedEnvironment()] } });
    renderScreen();

    const item = await waitFor(() => itemOf("engine"));
    expect(within(item).getByText("Environment failed")).toBeInTheDocument();
    expect(
      within(item).getByText(
        textContent("engine of kanthord failed: command_absent. Workers claim no node of it."),
      ),
    ).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Open project" })).toHaveAttribute(
      "href",
      "/projects/prj-1",
    );
  });

  it("lists an environment that waits longer than 10 minutes with its reason", async () => {
    serve({
      environments: {
        "prj-1": [
          {
            ...failedEnvironment(),
            status: "pending",
            failure: null,
            reason: "Repository SSH read failed. The failure reason is key_refused.",
            reason_started_at: NOW - HOUR,
          },
        ],
      },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("engine"));
    expect(within(item).getByText("Environment waiting")).toBeInTheDocument();
    expect(
      within(item).getByText(
        textContent(
          "engine of kanthord waits: Repository SSH read failed. The failure reason is key_refused. Workers claim no node of it. The server reads it again each minute.",
        ),
      ),
    ).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Open project" })).toHaveAttribute(
      "href",
      "/projects/prj-1",
    );
  });

  it("shows no reason sentence for a waiting environment with an empty reason", async () => {
    serve({
      environments: {
        "prj-1": [
          {
            ...failedEnvironment(),
            status: "pending",
            failure: null,
            reason: "",
            reason_started_at: NOW - HOUR,
          },
        ],
      },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("engine"));
    expect(
      within(item).getByText(
        textContent(
          "engine of kanthord waits. Workers claim no node of it. The server reads it again each minute.",
        ),
      ),
    ).toBeInTheDocument();
  });

  it("shows a read fault for a rejected environment list and keeps the other items", async () => {
    serve({ projects: [{ ...KANTHORD, paused_at: NOW - HOUR }, ATLAS] });
    vi.mocked(listProjectEnvironments).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    renderScreen();

    expect(
      await screen.findByText(textContent(/Some records could not be read:.*environment list/)),
    ).toBeInTheDocument();
    expect(itemOf("kanthord")).toBeInTheDocument();
  });

  it("lists a paused project and resumes it in place", async () => {
    const user = userEvent.setup();
    const paused = { ...KANTHORD, paused_at: NOW - 3 * HOUR };
    serve({ projects: [paused, ATLAS] });
    vi.mocked(readProject).mockResolvedValue(paused);
    renderScreen();

    const item = await waitFor(() => itemOf("kanthord"));
    expect(within(item).getByText("Project paused")).toBeInTheDocument();
    expect(
      within(item).getByText(textContent("kanthord is paused. Workers claim none of its nodes.")),
    ).toBeInTheDocument();
    expect(within(item).getByText("3 hours ago")).toBeInTheDocument();
    await user.click(within(item).getByRole("button", { name: "Resume project" }));

    expect(readProject).toHaveBeenCalledWith("prj-1");
    await waitFor(() => expect(resumeProject).toHaveBeenCalledWith("prj-1"));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Resumed kanthord.", {
        description: "Workers can claim its nodes.",
      }),
    );
  });

  it("names the group Fixes and counts it in the summary", async () => {
    serve({
      projects: [{ ...KANTHORD, paused_at: NOW - HOUR }, ATLAS],
      nodes: { "prj-2": [blocked("n_b", "Localize the order email")] },
    });

    renderScreen();

    expect(await screen.findByRole("heading", { name: "Fixes" })).toBeInTheDocument();
    expect(screen.getByText("1 decision · 1 fix")).toBeInTheDocument();
  });

  describe("no taker", () => {
    const waiting = plain("n_w", "Invoices page", "Waiting");

    it("names the binding at the server placement and its instance_count", async () => {
      serve({
        nodes: { "prj-1": [waiting] },
        jobs: {
          "prj-1": [agedJob("prj-1", "n_w", 5 * 60_000), agedJob("prj-1", "n_w", 3 * 60_000)],
        },
        bindings: { "prj-1": [workerBinding("reviewer-main", "reviewer@1", "server")] },
      });

      renderScreen();

      const item = await waitFor(() => itemOf("Implement jobs in state Waiting"));
      expect(within(item).getByText("No taker")).toBeInTheDocument();
      expect(within(item).getByText("Waiting")).toBeInTheDocument();
      expect(
        within(item).getByText(
          textContent(
            "2 implement jobs in state Waiting wait. Binding reviewer-main (reviewer@1) matches them and runs no instance. Raise its instance_count, or check the server log.",
          ),
        ),
      ).toBeInTheDocument();
      expect(
        within(item).getByText(textContent("project kanthord · 5 minutes ago")),
      ).toBeInTheDocument();
      expect(within(item).getByRole("button", { name: "Open bindings" })).toHaveAttribute(
        "href",
        "/projects/prj-1?tab=bindings",
      );
    });

    it("tells the human to start the worker program at the worker placement", async () => {
      serve({
        nodes: { "prj-1": [waiting] },
        jobs: { "prj-1": [agedJob("prj-1", "n_w", 5 * 60_000)] },
        bindings: { "prj-1": [workerBinding("reviewer-main", "reviewer@1", "worker")] },
      });

      renderScreen();

      const item = await waitFor(() => itemOf("Implement jobs in state Waiting"));
      expect(
        within(item).getByText(
          textContent(
            "1 implement job in state Waiting waits. Binding reviewer-main (reviewer@1) matches it and has no live registration. Start its worker program.",
          ),
        ),
      ).toBeInTheDocument();
    });

    it("names the tags of a job that no binding matches", async () => {
      serve({
        nodes: {
          "prj-1": [
            { ...plain("n_m", "Build the macOS app", "Available"), tags: ["platform.macos"] },
          ],
        },
        jobs: { "prj-1": [agedJob("prj-1", "n_m", 5 * 60_000)] },
        bindings: { "prj-1": [workerBinding("general-main", "coder@1", "server")] },
      });

      renderScreen();

      const item = await waitFor(() => itemOf("Implement jobs in state Available"));
      expect(
        within(item).getByText(
          textContent(
            "No worker binding matches the implement job in state Available with the tags platform.macos. Add a binding whose worker and tags match it on the Bindings tab.",
          ),
        ),
      ).toBeInTheDocument();
    });

    it("tells the human to add a binding when no binding matches the job", async () => {
      serve({
        nodes: { "prj-1": [waiting] },
        jobs: { "prj-1": [agedJob("prj-1", "n_w", 5 * 60_000)] },
        bindings: { "prj-1": [workerBinding("general-main", "coder@1")] },
      });

      renderScreen();

      const item = await waitFor(() => itemOf("Implement jobs in state Waiting"));
      expect(
        within(item).getByText(
          textContent(
            "No worker binding matches the implement job in state Waiting. Add a binding whose worker and tags match it on the Bindings tab.",
          ),
        ),
      ).toBeInTheDocument();
    });

    it("lists nothing while the oldest job is 60 s old or younger", async () => {
      serve({
        nodes: { "prj-1": [waiting] },
        jobs: { "prj-1": [agedJob("prj-1", "n_w", 30_000)] },
        bindings: { "prj-1": [workerBinding("reviewer-main", "reviewer@1", "server")] },
      });

      renderScreen();

      expect(await screen.findByText("All clear")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Implement jobs in state Waiting" })).toBeNull();
    });

    it("lists nothing when a live registration declares the state", async () => {
      serve({
        nodes: { "prj-1": [waiting] },
        jobs: { "prj-1": [agedJob("prj-1", "n_w", 5 * 60_000)] },
        bindings: { "prj-1": [workerBinding("reviewer-main", "reviewer@1", "server")] },
        registrations: {
          "prj-1": [
            {
              runtime_identity: "worker_registration_1",
              project_id: "prj-1",
              resource_identity: "worker:kanthord:reviewer-main",
              worker_name: "reviewer@1",
              host: "kanthord",
              placement: "server",
              activity: "idle",
              draining: false,
              registered: true,
            },
          ],
        },
      });

      renderScreen();

      expect(await screen.findByText("All clear")).toBeInTheDocument();
    });
  });

  it("lists an invalid agent configuration with a link to the agent", async () => {
    serve({
      nodes: { "prj-1": [] },
      bindings: { "prj-1": [workerBinding("coder-main", "coder@1")] },
      agents: {
        "binding_coder-main": [
          agentView("swe@1", {
            valid: false,
            issues: [{ path: [], code: "agent.enablement.unavailable" }],
          }),
          agentView("re@1"),
        ],
      },
    });

    renderScreen();

    const item = await waitFor(() => itemOf("swe@1"));
    expect(within(item).getByText("Invalid agent configuration")).toBeInTheDocument();
    expect(
      within(item).getByText(
        textContent(
          "Agent swe@1 has an invalid configuration (agent.enablement.unavailable) in binding coder-main in project kanthord. Fix the enablement on the agent page.",
        ),
      ),
    ).toBeInTheDocument();
    expect(
      within(item).getByText(textContent("project kanthord · age unknown")),
    ).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Open agent" })).toHaveAttribute(
      "href",
      "/agents/swe%401",
    );
    expect(screen.queryByRole("link", { name: "re@1" })).toBeNull();
  });

  it("lists one item for a server-wide agent fault and names each binding in its project", async () => {
    const invalid = agentView("swe@1", {
      valid: false,
      issues: [{ path: [], code: "agent.enablement.unavailable" }],
    });
    serve({
      nodes: { "prj-1": [], "prj-2": [] },
      bindings: {
        "prj-1": [workerBinding("coder-main", "coder@1")],
        "prj-2": [workerBinding("coder-extra", "coder@1", undefined, "prj-2")],
      },
      agents: { "binding_coder-main": [invalid], "binding_coder-extra": [invalid] },
    });

    renderScreen();

    const item = await waitFor(() => itemOf("swe@1"));
    expect(screen.getAllByRole("link", { name: "swe@1" })).toHaveLength(1);
    expect(
      within(item).getByText(
        textContent(
          "Agent swe@1 has an invalid configuration (agent.enablement.unavailable) in binding coder-main in project kanthord, binding coder-extra in project atlas. Fix the enablement on the agent page.",
        ),
      ),
    ).toBeInTheDocument();
    expect(
      within(item).getByText(textContent("2 bindings in 2 projects · age unknown")),
    ).toBeInTheDocument();
  });

  describe("provider refusals", () => {
    const run = plain("n_r", "Add password reset", "Waiting");

    it("lists a refused credential with the execution and a link to the credential", async () => {
      serve({
        nodes: { "prj-1": [run] },
        pages: { "prj-1": [providerStop("e1", "n_r", "unauthorized")] },
        credentials: [llmCredential("openai-main", NOW - 5 * HOUR)],
      });

      renderScreen();

      const item = await waitFor(() => itemOf("openai-main"));
      expect(within(item).getByText("Credential refused")).toBeInTheDocument();
      expect(
        within(item).getByText(
          textContent(
            "The provider refused openai-main (unauthorized) in the execution of Add password reset. Rotate the credential.",
          ),
        ),
      ).toBeInTheDocument();
      expect(
        within(item).getByText(textContent("project kanthord · 2 hours ago")),
      ).toBeInTheDocument();
      expect(within(item).getByRole("button", { name: "Open credential" })).toHaveAttribute(
        "href",
        "/llm/openai-main",
      );
    });

    it("states the count of nodes and projects of a refused credential", async () => {
      serve({
        nodes: { "prj-1": [run], "prj-2": [plain("n_s", "Add export", "Waiting")] },
        pages: {
          "prj-1": [providerStop("e1", "n_r", "unauthorized")],
          "prj-2": [providerStop("e2", "n_s", "unauthorized")],
        },
        credentials: [llmCredential("openai-main", NOW - 5 * HOUR)],
      });

      renderScreen();

      const item = await waitFor(() => itemOf("openai-main"));
      expect(
        within(item).getByText(textContent("2 nodes in 2 projects · 2 hours ago")),
      ).toBeInTheDocument();
      expect(within(item).getByText(/, for example in the execution of/)).toBeInTheDocument();
    });

    it("clears after a live revision that postdates the stop", async () => {
      serve({
        nodes: { "prj-1": [run] },
        pages: { "prj-1": [providerStop("e1", "n_r", "unauthorized")] },
        credentials: [llmCredential("openai-main", NOW - HOUR)],
      });

      renderScreen();

      expect(await screen.findByText("All clear")).toBeInTheDocument();
    });

    it("lists a rejected request once for each agent with a link to the agent", async () => {
      serve({
        nodes: { "prj-1": [run] },
        pages: { "prj-1": [providerStop("e1", "n_r", "bad_request")] },
      });

      renderScreen();

      const item = await waitFor(() => itemOf("swe@1"));
      expect(within(item).getByText("Provider rejected the request")).toBeInTheDocument();
      expect(
        within(item).getByText(
          textContent(
            "The provider rejected a request of swe@1 (bad request) in the execution of Add password reset. Check its model and settings.",
          ),
        ),
      ).toBeInTheDocument();
      expect(within(item).getByRole("button", { name: "Open agent" })).toHaveAttribute(
        "href",
        "/agents/swe%401",
      );
    });

    it("clears when a later execution of the node ends without the stop", async () => {
      serve({
        nodes: { "prj-1": [run] },
        pages: {
          "prj-1": [
            providerStop("e1", "n_r", "bad_request"),
            ended("e2", "n_r", { ended_at: NOW - HOUR }),
          ],
        },
      });

      renderScreen();

      expect(await screen.findByText("All clear")).toBeInTheDocument();
    });

    it("clears when the node becomes terminal", async () => {
      serve({
        nodes: { "prj-1": [plain("n_r", "Add password reset", "Completed")] },
        pages: { "prj-1": [providerStop("e1", "n_r", "bad_request")] },
      });

      renderScreen();

      expect(await screen.findByText("All clear")).toBeInTheDocument();
    });
  });

  it("shows a cooling chain as a fact line of the status area, not as an item", async () => {
    serve({
      nodes: { "prj-1": [] },
      bindings: { "prj-1": [workerBinding("coder-main", "coder@1")] },
      agents: {
        "binding_coder-main": [
          agentView("swe@1", {
            cooling: {
              code: "agent.configuration.chain_cooling",
              available_at: Date.UTC(2026, 9, 15, 14, 5),
            },
          }),
        ],
      },
    });

    renderScreen();

    expect(
      await screen.findByText(
        textContent(
          "swe@1 in coder-main of kanthord: every model cools down until 2026-10-15 14:05 UTC.",
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "swe@1" })).toHaveAttribute("href", "/agents/swe%401");
    expect(screen.getByText("All clear")).toBeInTheDocument();
  });

  it("names the project only under All projects", async () => {
    serve({ projects: [{ ...KANTHORD, paused_at: NOW - HOUR }, ATLAS] });

    renderScreen("/?project=prj-1");

    const item = await waitFor(() => itemOf("kanthord"));
    expect(within(item).getByText("1 hour ago")).toBeInTheDocument();
  });

  it("keeps All clear back and names a failed setup read", async () => {
    serve({ nodes: { "prj-1": [] } });
    vi.mocked(listAllCredentials).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );

    renderScreen();

    expect(
      await screen.findByText(
        textContent(
          "Some records could not be read: LLM credentials (The daemon did not answer.). The list can miss items.",
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
  });
});

describe("OverviewScreen system health", () => {
  it("names each unavailable component", async () => {
    serve({
      liveness: {
        healthy: false,
        services: { server: { gateway: 200, store: 503, log: 503 } },
      },
    });

    renderScreen();

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(
        "server.store unavailable, server.log unavailable. Operate the host.",
      ),
    ).toBeInTheDocument();
  });

  it("shows no alert while every component answers", async () => {
    serve({});

    renderScreen();

    await screen.findByText("All clear");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("shows an alert and no All clear when the liveness read fails", async () => {
    serve({});
    vi.mocked(readLiveness).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );

    renderScreen();

    const alert = await screen.findByRole("alert");
    expect(
      within(alert).getByText(
        "The liveness of the daemon could not be read: The daemon did not answer.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
  });
});

function session(
  id: string,
  patch: Partial<WorkbenchSessionListItem> = {},
): WorkbenchSessionListItem {
  return {
    id,
    agent_name: "swe@1",
    name: null,
    created: NOW - 2 * HOUR,
    modified: NOW - HOUR,
    message_count: 2,
    first_message: "Create the project account-recovery",
    run_active: true,
    pending_approval: { tool_call_id: "call_1", operation_id: "project.create" },
    ...patch,
  };
}

describe("OverviewScreen tool approvals", () => {
  it("lists a session that waits for an approval with its agent, operation and age", async () => {
    serve({ sessions: [session("workbench_session_A")] });

    renderScreen();

    const item = await waitFor(() => itemOf("Create the project account-recovery"));
    expect(within(item).getByText("swe@1")).toBeInTheDocument();
    expect(within(item).getByText("Waits for approval")).toBeInTheDocument();
    expect(within(item).getByText(/operation project\.create · 1 hour ago/)).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Open chat" })).toHaveAttribute(
      "href",
      "/workbench/workbench_session_A",
    );
    expect(within(item).getByRole("link", { name: /Create the project/ })).toHaveAttribute(
      "href",
      "/workbench/workbench_session_A",
    );
    expect(screen.getByText("1 decision")).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
  });

  it("titles the item with the name of the session before its first message", async () => {
    serve({ sessions: [session("workbench_session_A", { name: "Recovery flow" })] });

    renderScreen();

    expect(await screen.findByRole("link", { name: "Recovery flow" })).toBeInTheDocument();
  });

  it("skips a session with no pending approval and a pending approval of an ended run", async () => {
    serve({
      sessions: [
        session("workbench_session_A", { pending_approval: null }),
        session("workbench_session_B", { run_active: false }),
      ],
    });

    renderScreen();

    expect(await screen.findByText("All clear")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open chat" })).toBeNull();
  });

  it("counts the approval with the decisions of the nodes", async () => {
    serve({
      nodes: { "prj-1": [blocked("n_a", "Audit log")] },
      sessions: [session("workbench_session_A")],
    });

    renderScreen();

    expect(await screen.findByText("2 decisions")).toBeInTheDocument();
  });

  it("hides the approval under a project filter", async () => {
    serve({
      nodes: { "prj-2": [blocked("n_b", "B")] },
      sessions: [session("workbench_session_A")],
    });

    renderScreen("/?project=prj-2");

    expect(await screen.findByRole("link", { name: "B" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open chat" })).toBeNull();
    expect(screen.getByText("1 decision")).toBeInTheDocument();
  });

  it("does not read the sessions under a project filter, so a failed read cannot hold All clear back", async () => {
    serve({});
    vi.mocked(listWorkbenchSessions).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );

    renderScreen("/?project=prj-1");

    expect(await screen.findByText("All clear")).toBeInTheDocument();
    expect(listWorkbenchSessions).not.toHaveBeenCalled();
  });

  it("reads the sessions again when the human returns to All projects", async () => {
    const user = userEvent.setup();
    serve({ sessions: [session("workbench_session_A")] });

    renderScreen("/?project=prj-1");

    expect(await screen.findByText("All clear")).toBeInTheDocument();
    expect(listWorkbenchSessions).not.toHaveBeenCalled();
    await user.click(screen.getByRole("combobox", { name: "Project" }));
    await user.click(await screen.findByRole("option", { name: "All projects" }));

    expect(
      await screen.findByRole("link", { name: "Create the project account-recovery" }),
    ).toBeInTheDocument();
    expect(listWorkbenchSessions).toHaveBeenCalledTimes(1);
  });

  it("names the failed session read and holds back All clear", async () => {
    serve({});
    vi.mocked(listWorkbenchSessions).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );

    renderScreen();

    expect(
      await screen.findByText(textContent(/Some records could not be read: workbench sessions/)),
    ).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
  });
});
