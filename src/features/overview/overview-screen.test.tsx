import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StrictMode } from "react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
  rebuildEnvironment: vi.fn(),
}));

vi.mock("@/api/resources/workers", () => ({
  listWorkerCatalog: vi.fn(),
  listWorkerRegistrations: vi.fn(),
}));

vi.mock("@/api/resources/credentials", () => ({
  listAllCredentials: vi.fn(),
  verifyCredential: vi.fn(),
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
  decideProposals: vi.fn(),
  overrideNode: vi.fn(),
  resumeNode: vi.fn(),
  removeDependency: vi.fn(),
  discardNode: vi.fn(),
}));

vi.mock("@/api/resources/workbench", () => ({
  listWorkbenchSessions: vi.fn(),
  readWorkbenchEvents: vi.fn(),
  approveWorkbenchCall: vi.fn(),
}));

vi.mock("@/api/resources/tracking", () => ({
  listTracePage: vi.fn(),
  listTraceSpans: vi.fn(),
}));

vi.mock("@/api/resources/scheduler", () => ({
  listQueueJobs: vi.fn(),
  listNodeExecutions: vi.fn(),
  listProjectExecutionPage: vi.fn(),
}));

import { listTracePage, listTraceSpans } from "@/api/resources/tracking";
import {
  checkNode,
  decideProposals,
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
import { listAllCredentials, verifyCredential } from "@/api/resources/credentials";
import { readLiveness } from "@/api/resources/gateway";
import {
  listBindingAgents,
  listProjectEnvironments,
  listProjects,
  listWorkerBindings,
  pauseProject,
  readProject,
  rebuildEnvironment,
  resumeProject,
} from "@/api/resources/projects";
import {
  listNodeExecutions,
  listProjectExecutionPage,
  listQueueJobs,
} from "@/api/resources/scheduler";
import {
  approveWorkbenchCall,
  listWorkbenchSessions,
  readWorkbenchEvents,
} from "@/api/resources/workbench";
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
  MissionProposalDecideResult,
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
    id: `proposal_${name.replaceAll(" ", "_")}`,
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
    rejected_at: null,
    created_at: NOW - HOUR,
  };
}

const DECIDED: MissionProposalDecideResult = {
  created: [
    {
      mission_version: 10,
      revisions: [],
      retired_node_ids: [],
      added_edges: [],
      removed_edges: [],
      open_attempts_unchanged: [],
    },
  ],
  rejected_proposal_ids: [],
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
  vi.mocked(readWorkbenchEvents).mockResolvedValue({
    entries: [],
    snapshot: {
      streaming_message: null,
      pending_tool_calls: [],
      pending_approval: null,
      run_active: false,
      error_message: null,
    },
    version: 1,
  });
  vi.mocked(approveWorkbenchCall).mockResolvedValue({
    session_id: "workbench_session_A",
    tool_call_id: "call_1",
    approved: true,
  });
  vi.mocked(listTraceSpans).mockResolvedValue([]);
  vi.mocked(listTracePage).mockResolvedValue({ items: [], next_cursor: null });
  vi.mocked(verifyCredential).mockResolvedValue({
    status: "healthy",
    capability: "llm",
    failure_reason: null,
  });
  vi.mocked(rebuildEnvironment).mockResolvedValue(failedEnvironment());
  vi.mocked(connectionBaseUrl).mockReturnValue("http://daemon.test");
  vi.mocked(readLiveness).mockResolvedValue(world.liveness ?? HEALTHY);
  vi.mocked(resumeProject).mockResolvedValue(KANTHORD);
  vi.mocked(pauseProject).mockResolvedValue(KANTHORD);
  vi.mocked(unblockNode).mockResolvedValue({} as MissionControlResult);
  vi.mocked(decideProposals).mockResolvedValue(DECIDED);
  vi.mocked(overrideNode).mockResolvedValue({} as MissionControlResult);
  vi.mocked(resumeNode).mockResolvedValue({} as MissionControlResult);
  vi.mocked(removeDependency).mockResolvedValue({} as MissionNodeChange);
  vi.mocked(discardNode).mockResolvedValue({} as MissionControlResult);
}

function Location() {
  const location = useLocation();
  return <output aria-label="Location">{location.search}</output>;
}

function renderScreen(entry = "/", onResume?: () => void) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <OverviewScreen onResume={onResume} />
      <Location />
    </MemoryRouter>,
  );
}

function searchOf(): URLSearchParams {
  return new URLSearchParams(
    screen.getByRole("status", { name: "Location", hidden: true }).textContent ?? "",
  );
}

class FakeResizeObserver {
  static readonly live = new Set<FakeResizeObserver>();

  static width: number | null = null;

  constructor(
    private readonly callback: (entries: readonly { contentRect: { width: number } }[]) => void,
  ) {
    FakeResizeObserver.live.add(this);
  }

  observe() {
    if (FakeResizeObserver.width !== null) this.measure(FakeResizeObserver.width);
  }

  unobserve() {}

  disconnect() {
    FakeResizeObserver.live.delete(this);
  }

  measure(width: number) {
    this.callback([{ contentRect: { width } }]);
  }
}

function setWidth(width: number) {
  FakeResizeObserver.width = width;
  act(() => {
    for (const observer of FakeResizeObserver.live) observer.measure(width);
  });
}

const EXPANDED_WIDTH = 1200;
const MEDIUM_WIDTH = 700;
const COMPACT_WIDTH = 500;

function listOf(): HTMLElement {
  return screen.getByRole("tabpanel");
}

function cardButton(name: string): HTMLElement {
  return within(listOf()).getByRole("button", { name });
}

function cardOf(name: string): HTMLElement {
  const card = cardButton(name).closest('[role="listitem"]');
  if (!(card instanceof HTMLElement)) throw new Error(`No card for ${name}.`);
  return card;
}

const NOT_LOADING = { name: (name: string) => name !== "Loading the board" };

function detailOf(): HTMLElement {
  return screen.getByRole("region", NOT_LOADING);
}

async function showItem(name: string, tab?: string): Promise<HTMLElement> {
  if (tab !== undefined) {
    await userEvent.click(await screen.findByRole("tab", { name: new RegExp(`^${tab},`) }));
  }
  const button = await waitFor(() => cardButton(name));
  await userEvent.click(button);
  return detailOf();
}

async function findDetail(): Promise<HTMLElement> {
  return screen.findByRole("region", NOT_LOADING);
}

function labelOf(control: HTMLElement): string {
  return Array.from(control.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
    .join("");
}

function expectGated(scope: HTMLElement, name: string | RegExp) {
  expect(within(scope).getByRole("button", { name })).toHaveAttribute("aria-disabled", "true");
}

beforeEach(() => {
  vi.resetAllMocks();
  NOW = Date.now();
  FakeResizeObserver.live.clear();
  FakeResizeObserver.width = null;
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
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
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("offers no Resume onboarding when the setup is done", async () => {
    serve({});

    renderScreen();

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resume onboarding" })).toBeNull();
  });
});

describe("OverviewScreen board", () => {
  const world = () => ({
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

  it("shows the header row, the filter, the summary, six tabs and the Start here card", async () => {
    serve(world());

    renderScreen();

    expect(await screen.findAllByRole("tab")).toHaveLength(6);
    expect(screen.getByRole("heading", { level: 2, name: "Overview" })).toBeInTheDocument();
    const filter = screen.getByRole("group", { name: "Show the acts of" });
    expect(
      within(filter)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["All · 2", "kanthord · 1", "atlas · 1"]);
    expect(screen.getByText(/Start here:/)).toHaveTextContent(
      "2 acts wait for you. 2 nodes wait on them. Start here: Localize the order email in Rule.",
    );
    expect(screen.getByRole("tab", { name: "Rule, 2 acts" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      within(listOf())
        .getAllByRole("listitem")
        .map((card) => within(card).getAllByRole("button")[0]?.textContent),
    ).toEqual(["Localize the order email", "Audit log for account changes"]);
    expect(cardOf("Localize the order email").firstElementChild).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(
      screen.getByRole("region", { name: "Localize the order email: undetermined" }),
    ).toBeVisible();
  });

  it("shows the cause, the project, the age and the lead act on a card", async () => {
    serve(world());

    renderScreen();

    await screen.findAllByRole("tab");
    const card = cardOf("Localize the order email");
    expect(within(card).getByText("Undetermined · attempt 2")).toBeInTheDocument();
    expect(within(card).getByText("atlas")).toBeInTheDocument();
    expect(within(card).getByText("5 hours ago")).toBeInTheDocument();
    expect(within(card).getByText("1 node waits")).toBeInTheDocument();
    expect(within(card).getByText("Unblock")).toBeInTheDocument();
  });

  it("names the workforce fact", async () => {
    serve({
      nodes: {
        "prj-1": [
          plain("n_a", "A", "Executing"),
          plain("n_b", "B", "Evaluating"),
          blocked("n_x", "Waiting for a human"),
        ],
        "prj-2": [plain("n_c", "C", "Executing"), plain("n_d", "D", "Available")],
      },
      jobs: { "prj-1": [job("prj-1", "n_d"), job("prj-1", "n_e")], "prj-2": [job("prj-2", "n_d")] },
    });

    renderScreen();

    expect(await screen.findByText("3 executions run · 3 jobs wait")).toBeInTheDocument();
  });

  it("shows no Mission progress and no status line link", async () => {
    serve({ nodes: { "prj-1": [plain("n_a", "A", "Completed"), blocked("n_x", "X")] } });

    renderScreen();

    await screen.findAllByRole("tab");
    expect(screen.queryByText(/Mission progress/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Node states" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Open scheduler" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Needs you" })).toBeNull();
  });

  it("counts each tab and shows the cards of the tab that the human picks", async () => {
    serve({
      projects: [{ ...KANTHORD, paused_at: NOW - HOUR }, ATLAS],
      nodes: {
        "prj-1": [paused("n_p", "Draft the notes")],
        "prj-2": [blocked("n_b", "Localize the order email")],
      },
    });
    const user = userEvent.setup();

    renderScreen();

    expect(await screen.findByRole("tab", { name: "Fix setup, 1 act" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Resume, 1 act" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Rule, 1 act" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Decide proposal, 0 acts, clear" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Resume, 1 act" }));

    expect(within(listOf()).getByRole("button", { name: "Draft the notes" })).toBeInTheDocument();
    expect(within(listOf()).queryByRole("button", { name: "Localize the order email" })).toBeNull();
    expect(screen.getByRole("region", { name: /^Draft the notes/ })).toBeVisible();
  });

  it("shows the empty tab with a way to the Start here card", async () => {
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    const user = userEvent.setup();

    renderScreen();
    await user.click(await screen.findByRole("tab", { name: "Act outside, 0 acts, clear" }));

    expect(screen.getByText("Nothing waits in Act outside.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to Audit log" })).toBeInTheDocument();
  });
});

describe("OverviewScreen scope", () => {
  it("offers All first and shows both projects by default", async () => {
    serve({ nodes: { "prj-1": [blocked("n_a", "A")], "prj-2": [blocked("n_b", "B")] } });

    renderScreen();

    expect(await screen.findByRole("button", { name: "All · 2" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(cardButton("A")).toBeInTheDocument();
    expect(cardButton("B")).toBeInTheDocument();
  });

  it("narrows the board and the workforce fact to the project of the parameter", async () => {
    serve({
      nodes: { "prj-1": [blocked("n_a", "A")], "prj-2": [blocked("n_b", "B")] },
      jobs: { "prj-1": [job("prj-1", "n_a")], "prj-2": [job("prj-2", "n_b"), job("prj-2", "n_c")] },
    });

    renderScreen("/?project=prj-2");

    await waitFor(() => expect(cardButton("B")).toBeInTheDocument());
    expect(within(listOf()).queryByRole("button", { name: "A" })).toBeNull();
    expect(screen.getByRole("button", { name: "atlas · 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("0 executions run · 2 jobs wait")).toBeInTheDocument();
  });

  it("narrows the board and announces the counts when the human presses a project", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "A")], "prj-2": [blocked("n_b", "B")] } });
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "kanthord · 1" }));

    expect(within(listOf()).getByRole("button", { name: "A" })).toBeInTheDocument();
    expect(within(listOf()).queryByRole("button", { name: "B" })).toBeNull();
    expect(screen.getByText("kanthord: 1 act in Rule, 1 act in all tabs.")).toBeInTheDocument();
    expect(searchOf().get("project")).toBe("prj-1");
  });

  it("returns to All on a press of the pressed item", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "A")], "prj-2": [blocked("n_b", "B")] } });
    renderScreen("/?project=prj-1");

    await user.click(await screen.findByRole("button", { name: "kanthord · 1" }));

    expect(within(listOf()).getByRole("button", { name: "B" })).toBeInTheDocument();
    expect(searchOf().get("project")).toBeNull();
  });

  it("offers Show all projects on a tab that the filter empties", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "A")], "prj-2": [paused("n_p", "P")] } });
    renderScreen("/?project=prj-1&kind=paused");

    expect(await screen.findByText("Nothing waits in Resume in kanthord.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show all projects" }));

    expect(await within(listOf()).findByRole("button", { name: "P" })).toBeInTheDocument();
  });
});

describe("OverviewScreen assessment", () => {
  it("reads the rationale and shows it as a quote of its actor", async () => {
    serve({
      nodes: {
        "prj-1": [
          blocked("n_a", "Audit log", {
            closingEvent: "external-failed",
            result: "undetermined",
          }),
        ],
      },
      rationales: { n_a: "The audit entry holds no actor." },
    });
    renderScreen();

    const item = await findDetail();

    expect(within(cardOf("Audit log")).getByText(/^External action failed/)).toBeInTheDocument();
    const quote = await within(item).findByText("The audit entry holds no actor.");
    expect(quote.tagName).toBe("BLOCKQUOTE");
    expect(within(item).getByText("Kanthor Labs").tagName).toBe("CITE");
    expect(listNodeAssessments).toHaveBeenCalledWith("n_a", 2);
  });

  it("shows the open fix proposal of an examine node under Proposal", async () => {
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

    const item = await findDetail();

    expect(
      await within(item).findByText("Send the invite in the workspace language"),
    ).toBeInTheDocument();
    expect(within(item).getByText("The invite email uses the workspace language.")).toBeVisible();
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

    const item = await findDetail();
    expect(await within(item).findByText("Could not read the assessment.")).toBeInTheDocument();
    vi.mocked(listNodeAssessments).mockResolvedValue([assessment("n_a", "Read after the retry.")]);
    await user.click(within(item).getByRole("button", { name: "Retry" }));

    expect(await within(item).findByText("Read after the retry.")).toBeInTheDocument();
  });
});

describe("OverviewScreen acts", () => {
  it("offers Unblock and Discard for an implement node at once", async () => {
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    renderScreen();

    const item = await findDetail();

    expect(within(item).getByRole("button", { name: "Unblock" })).toBeEnabled();
    expect(within(item).getByRole("button", { name: "Discard" })).toBeEnabled();
    expect(within(item).queryByText(/needs:/)).toBeNull();
  });

  it("leads a Decide proposal card with Decide and ends every card with Discard", async () => {
    serve({
      nodes: { "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })] },
      proposals: { n_t: [proposal("n_t", "Send the invite in the workspace language")] },
    });
    renderScreen();

    const item = await findDetail();
    await waitFor(() => expect(within(item).getByRole("button", { name: "Decide" })).toBeEnabled());

    const acts = within(within(item).getByRole("group", { name: "Acts" })).getAllByRole("button");
    expect(acts.map(labelOf)).toEqual(["Decide", "Unblock", "Override", "Discard"]);
    expect(within(cardOf("Team workspaces")).getByText("Decide")).toBeInTheDocument();
  });

  it("gates the acts of an examine node until the proposals read answers", async () => {
    let answer: (value: readonly MissionProposal[]) => void = () => undefined;
    serve({ nodes: { "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })] } });
    vi.mocked(listNodeProposals).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderScreen();

    const item = await findDetail();
    expect(within(item).getByText(/Reading the fix proposals/)).toBeInTheDocument();
    expect(within(item).getByText("Decide needs: the proposals read.")).toBeInTheDocument();
    expect(within(item).getByText("Unblock needs: the proposals read.")).toBeInTheDocument();
    expect(within(item).getByText("Discard needs: the proposals read.")).toBeInTheDocument();
    expectGated(item, "Decide");
    expectGated(item, "Unblock");
    expectGated(item, "Discard");

    answer([]);

    await waitFor(() =>
      expect(within(item).getByRole("button", { name: "Unblock" })).toBeEnabled(),
    );
    expect(within(item).getByRole("button", { name: "Discard" })).toBeEnabled();
    expect(within(item).queryByText(/needs:/)).toBeNull();
  });

  it("keeps the acts of an examine node gated when the proposals read fails", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })] } });
    vi.mocked(listNodeProposals).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    renderScreen();

    const item = await findDetail();
    expect(
      await within(item).findByText(
        /The fix proposals could not be read: The daemon did not answer\.\. Unblock and Discard wait for them\./,
      ),
    ).toBeInTheDocument();
    expect(within(item).getByText("Unblock needs: the proposals read.")).toBeInTheDocument();
    expectGated(item, "Unblock");
    expect(within(item).getByText("Could not read the proposals.")).toBeInTheDocument();
    vi.mocked(listNodeProposals).mockResolvedValue([]);
    await user.click(within(item).getAllByRole("button", { name: "Retry" })[0] as HTMLElement);

    await waitFor(() =>
      expect(within(item).getByRole("button", { name: "Unblock" })).toBeEnabled(),
    );
  });

  it("names the rejected proposals in the Unblock dialog and sends the unblock", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })] },
      proposals: { n_t: [proposal("n_t", "Send the invite in the workspace language")] },
    });
    renderScreen();

    const item = await findDetail();
    await waitFor(() =>
      expect(within(item).getByRole("button", { name: "Unblock" })).toBeEnabled(),
    );
    await user.click(within(item).getByRole("button", { name: "Unblock" }));
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

  it("discards after the reason and reads the board again", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-2": [blocked("n_b", "Localize the order email")] } });
    renderScreen();

    const item = await findDetail();
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
    expect(screen.getAllByText("No decision waits for you.").length).toBeGreaterThan(0);
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("replaces All clear with a notice that names the missing records", async () => {
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
    expect(screen.getByText("No act found")).toBeInTheDocument();
    expect(screen.getByText("Some records could not be read.")).toBeInTheDocument();
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
    await findDetail();

    vi.mocked(listMissionNodes).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(
      await screen.findByText(textContent(/Some records could not be read: kanthord node list/)),
    ).toBeInTheDocument();
    expect(cardButton("Audit log")).toBeInTheDocument();
  });

  it("shows the heading and a busy skeleton while the first read runs", () => {
    serve({});
    vi.mocked(listProjects).mockReturnValue(new Promise(() => undefined));

    renderScreen();

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Loading the board" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByText(/Nothing waits/)).toBeNull();
    expect(screen.queryByText("All clear")).toBeNull();
    expect(screen.queryByRole("group", { name: "Show the acts of" })).toBeNull();
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
    expect(screen.queryByRole("tab")).toBeNull();
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

    const item = await findDetail();
    expect(
      await within(item).findByText("The last execution ended: provider failed (rate limited)."),
    ).toBeInTheDocument();
    expect(within(cardOf("Compute the shipping rates")).getByText(/^Failure limit/)).toBeVisible();
    expect(within(item).getAllByText("Paused")).toHaveLength(2);
    expect(within(item).getByText("kanthord")).toBeInTheDocument();
    expect(within(item).getByText("2 hours ago")).toBeInTheDocument();
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

    const item = await findDetail();
    const links = await within(item).findAllByRole("button", { name: "Last trace" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/traces/trace_new"]);
    expect(within(item).getByRole("link", { name: "e2" })).toHaveAttribute(
      "href",
      "/traces/trace_new",
    );
  });

  it("shows the cause of the last trace under Root cause", async () => {
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

    const item = await findDetail();
    expect(await within(item).findByText("LLM provider - rate limited")).toBeInTheDocument();
    expect(listTracePage).toHaveBeenCalledWith({ execution_id: "e1" }, null, 1);
  });

  it("offers no Last trace and no cause to a Paused node without an execution", async () => {
    serve({ nodes: { "prj-1": [paused("n_p", "Draft the notes")] } });

    renderScreen();

    const item = await findDetail();
    await waitFor(() => expect(within(item).getByRole("button", { name: "Resume" })).toBeEnabled());
    expect(within(item).queryByRole("button", { name: "Last trace" })).toBeNull();
    expect(within(item).getByText("No cause: this is a wait, not a fault.")).toBeInTheDocument();
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

    const item = await findDetail();
    expect(await within(item).findByText("The last execution ended: lost.")).toBeInTheDocument();
    expect(within(cardOf("Compute the shipping rates")).getByText(/^Failure limit/)).toBeVisible();
    expect(within(item).getByText("4 hours ago")).toBeInTheDocument();
  });

  it("names the Further-work limit after a budget end", async () => {
    serve({
      nodes: { "prj-1": [paused("n_p", "Print the packing slip")] },
      executions: {
        n_p: [ended("e1", "n_p", { stop: { reason: "budget_end", code: "turns" } })],
      },
    });

    renderScreen();

    const item = await findDetail();
    expect(
      await within(item).findByText("The last execution ended at its budget (turns)."),
    ).toBeInTheDocument();
    expect(within(cardOf("Print the packing slip")).getByText(/^Further-work limit/)).toBeVisible();
  });

  it("names a pause by a human with an unknown age when no execution ran", async () => {
    serve({ nodes: { "prj-1": [paused("n_p", "Draft the notes")] } });

    renderScreen();

    const item = await findDetail();
    expect(
      await within(item).findByText("No execution limit explains the pause."),
    ).toBeInTheDocument();
    const card = cardOf("Draft the notes");
    expect(within(card).getByText("Paused by a human")).toBeInTheDocument();
    expect(within(card).getByText("age unknown")).toBeInTheDocument();
  });

  it("gates the acts of a Paused node until the executions and the actions answer", async () => {
    let answer: (value: readonly MissionExternalAction[]) => void = () => undefined;
    serve({ nodes: { "prj-1": [paused("n_p", "Draft the notes")] } });
    vi.mocked(listNodeExternalActions).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderScreen();

    const item = await findDetail();
    expect(
      within(item).getByText(/Reading the executions and the external actions of attempt 2/),
    ).toBeInTheDocument();
    expect(
      within(item).getByText("Resume needs: the executions and external actions read."),
    ).toBeInTheDocument();
    expect(
      within(item).getByText("Discard needs: the executions and external actions read."),
    ).toBeInTheDocument();
    expectGated(item, "Resume");
    expectGated(item, "Discard");

    answer([]);

    await waitFor(() =>
      expect(within(item).getByRole("button", { name: "Discard" })).toBeEnabled(),
    );
    expect(within(item).queryByText(/needs:/)).toBeNull();
  });

  it("keeps Discard off and names the reason when an unresolved request waits", async () => {
    serve({
      nodes: { "prj-1": [paused("n_p", "Publish the changelog")] },
      actions: { n_p: [requested("n_p", "unresolved")] },
    });

    renderScreen();

    const item = await findDetail();
    expect(
      await within(item).findByText(
        "Attempt 2 has an unresolved pull request. Override and discard wait for its end state. Resume the node.",
      ),
    ).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it("keeps the acts gated when a read fails and reads again on Retry", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [paused("n_p", "Draft the notes")] } });
    vi.mocked(listNodeExecutions).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    renderScreen();

    const item = await findDetail();
    expect(
      await within(item).findByText(
        "The executions or the external actions of attempt 2 could not be read: The daemon did not answer. The controls wait for them.",
      ),
    ).toBeInTheDocument();
    expectGated(item, "Discard");
    await user.click(within(item).getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(within(item).getByRole("button", { name: "Discard" })).toBeEnabled(),
    );
  });

  it("offers Resume, Override and Discard for a Paused node at attempt 0 without a read", async () => {
    serve({ nodes: { "prj-1": [paused("n_p", "Draft the notes", 0)] } });
    vi.mocked(listNodeExecutions).mockRejectedValue(
      new ApiError("malformed", "Request validation failed.", 400),
    );
    renderScreen();

    const item = await findDetail();
    await waitFor(() => expect(within(item).getByRole("button", { name: "Resume" })).toBeEnabled());
    expect(within(item).getByRole("button", { name: "Override" })).toBeEnabled();
    expect(within(item).getByRole("button", { name: "Discard" })).toBeEnabled();
    expect(within(cardOf("Draft the notes")).getByText("Paused by a human")).toBeInTheDocument();
    expect(listNodeExecutions).not.toHaveBeenCalled();
    expect(listNodeExternalActions).not.toHaveBeenCalled();
  });

  it("leads a paused card with Resume and Discard last", async () => {
    serve({
      nodes: { "prj-1": [paused("n_p", "Draft the notes", 0)] },
    });
    renderScreen();

    const item = await findDetail();

    const acts = within(within(item).getByRole("group", { name: "Acts" })).getAllByRole("button");
    expect(acts.map(labelOf)).toEqual(["Resume", "Override", "Discard"]);
    expect(within(cardOf("Draft the notes")).getByText("Resume")).toBeInTheDocument();
  });

  it("discards a Paused node with the expected state Paused", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [paused("n_p", "Draft the notes", 3)] } });
    renderScreen();

    const item = await findDetail();
    await waitFor(() =>
      expect(within(item).getByRole("button", { name: "Discard" })).toBeEnabled(),
    );
    await user.click(within(item).getByRole("button", { name: "Discard" }));
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

    const item = await findDetail();
    expect(within(item).getAllByText("Pending")).toHaveLength(2);
    expect(
      within(item).getByText(
        textContent(
          "It depends on Drop the legacy checkout, which is Discarded. A discarded node satisfies no dependency.",
        ),
      ),
    ).toBeInTheDocument();
    const card = cardOf("Redirect the legacy links");
    expect(
      within(card).getByText("Discarded dependency · Drop the legacy checkout"),
    ).toBeInTheDocument();
    expect(within(card).getByText("atlas")).toBeInTheDocument();
    expect(within(card).getByText("age unknown")).toBeInTheDocument();
    expect(listNodeExecutions).not.toHaveBeenCalled();
  });

  it("offers Discard at once and sends it with the expected state Pending", async () => {
    const user = userEvent.setup();
    serve(world);
    renderScreen();

    const item = await findDetail();
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

    const item = await findDetail();
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

    const item = await findDetail();
    expect(
      await within(item).findByText(
        "The external actions of attempt 2 could not be read: The daemon did not answer. Check now, Remove dependency and Discard wait for them.",
      ),
    ).toBeInTheDocument();
    expect(
      within(item).getByText("Remove dependency needs: the external actions read."),
    ).toBeInTheDocument();
    expectGated(item, "Discard");
    await user.click(within(item).getByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(within(item).getByRole("button", { name: "Discard" })).toBeEnabled(),
    );
  });

  it("gates Remove dependency, Check now and Discard until the external actions answer", async () => {
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

    const item = await findDetail();
    expect(
      within(item).getByText(/Reading the external actions of attempt 2\. The acts show/),
    ).toBeInTheDocument();
    expect(
      within(item).getByText("Check now needs: the external actions read."),
    ).toBeInTheDocument();
    expect(within(item).getByText("Discard needs: the external actions read.")).toBeInTheDocument();
    expectGated(item, /Remove dependency on/);

    answer([]);

    await waitFor(() =>
      expect(within(item).getByRole("button", { name: "Discard" })).toBeEnabled(),
    );
  });
});

describe("OverviewScreen proposal decision", () => {
  it("decides the open proposals of an examine node with one Decide button", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })] },
      proposals: {
        n_t: [
          proposal("n_t", "Send the invite in the workspace language"),
          proposal("n_t", "Expire the invite link"),
        ],
      },
    });
    renderScreen();

    const item = await findDetail();
    await waitFor(() => expect(within(item).getByRole("button", { name: "Decide" })).toBeEnabled());
    expect(within(item).getAllByRole("button", { name: "Decide" })).toHaveLength(1);
    expect(within(item).queryByRole("button", { name: /^Approve proposal/ })).toBeNull();
    await user.click(within(item).getByRole("button", { name: "Decide" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("Decide the proposals of Team workspaces?"),
    ).toBeInTheDocument();
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Send the invite in the workspace language" }),
    );
    await user.type(within(dialog).getByLabelText("Reason"), "The fix is right.");
    await user.click(within(dialog).getByRole("button", { name: "Decide" }));

    expect(decideProposals).toHaveBeenCalledWith("assessment_n_t", {
      expected_mission_version: 7,
      approved_proposal_ids: ["proposal_Send_the_invite_in_the_workspace_language"],
      reason: "The fix is right.",
    });
  });

  it("offers no Decide for a decided proposal", async () => {
    serve({
      nodes: { "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })] },
      proposals: { n_t: [proposal("n_t", "Old fix", 5)] },
    });

    renderScreen();

    const item = await findDetail();
    await waitFor(() =>
      expect(within(item).getByRole("button", { name: "Unblock" })).toBeEnabled(),
    );
    expect(screen.queryByRole("button", { name: "Decide" })).toBeNull();
  });

  it("offers no Decide for an implement node", async () => {
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });

    renderScreen();

    const item = await findDetail();
    expect(within(item).getByRole("button", { name: "Unblock" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Decide" })).toBeNull();
  });
});

describe("OverviewScreen next card", () => {
  function threeBlocked(): Record<string, MissionNodeRecord[]> {
    return {
      "prj-1": [
        blocked("n_a", "First item", { createdAt: NOW - 9 * HOUR }),
        blocked("n_b", "Second item", { createdAt: NOW - 8 * HOUR }),
        blocked("n_c", "Third item", { createdAt: NOW - 7 * HOUR }),
      ],
    };
  }

  async function discard(item: HTMLElement) {
    const user = userEvent.setup();
    await user.click(within(item).getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Out of scope.");
    await user.click(within(dialog).getByRole("button", { name: "Discard node" }));
  }

  function discardRemoves(nodes: Record<string, MissionNodeRecord[]>) {
    vi.mocked(discardNode).mockImplementation(async (nodeId) => {
      nodes["prj-1"] = (nodes["prj-1"] ?? []).filter((node) => node.id !== nodeId);
      return {} as MissionControlResult;
    });
  }

  it("selects the next card and moves focus to the detail title after a discard", async () => {
    const nodes = threeBlocked();
    serve({ nodes });
    discardRemoves(nodes);
    renderScreen();

    const item = await showItem("Second item");
    await discard(item);

    await waitFor(() =>
      expect(within(listOf()).queryByRole("button", { name: "Second item" })).toBeNull(),
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 3, name: /^Third item/ })).toHaveFocus(),
    );
    expect(cardOf("Third item").firstElementChild).toHaveAttribute("aria-current", "true");
    expect(screen.queryByText("This item no longer waits")).toBeNull();
  });

  it("selects the last card when the discarded card was the last", async () => {
    const nodes = threeBlocked();
    serve({ nodes });
    discardRemoves(nodes);
    renderScreen();

    const item = await showItem("Third item");
    await discard(item);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 3, name: /^Second item/ })).toHaveFocus(),
    );
  });

  it("selects the next card of the filtered list only", async () => {
    const nodes: Record<string, MissionNodeRecord[]> = {
      "prj-1": [
        blocked("n_a", "First item", { createdAt: NOW - 9 * HOUR }),
        blocked("n_b", "Second item", { createdAt: NOW - 8 * HOUR }),
      ],
      "prj-2": [blocked("n_z", "Other project item", { createdAt: NOW - 10 * HOUR })],
    };
    serve({ nodes });
    discardRemoves(nodes);
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole("button", { name: "kanthord · 2" }));
    const item = await showItem("Second item");
    await discard(item);

    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 3, name: /^First item/ })).toHaveFocus(),
    );
  });

  it("shows the new kind of an item in its own tab after a resume", async () => {
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

    const item = await findDetail();
    await waitFor(() => expect(within(item).getByRole("button", { name: "Resume" })).toBeEnabled());
    await user.click(within(item).getByRole("button", { name: "Resume" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Try again.");
    await user.click(within(dialog).getByRole("button", { name: "Resume node" }));

    expect(await screen.findByRole("tab", { name: "Rule, 1 act" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Resume, 0 acts, clear" })).toBeInTheDocument();
  });

  it("moves focus to the All clear title when no card is left", async () => {
    const nodes: Record<string, MissionNodeRecord[]> = { "prj-1": [blocked("n_a", "Only item")] };
    serve({ nodes });
    discardRemoves(nodes);
    renderScreen();

    const item = await findDetail();
    await discard(item);

    await waitFor(() => expect(screen.getByText("All clear")).toHaveFocus());
  });

  it("moves no focus when the human cancels a dialog", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "First item"), blocked("n_b", "Second item")] } });
    renderScreen();

    const first = await findDetail();
    await user.click(within(first).getByRole("button", { name: "Discard" }));
    await user.click(await screen.findByRole("button", { name: "Keep the node" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(cardButton("Second item")).not.toHaveFocus();
    expect(cardOf("First item").firstElementChild).toHaveAttribute("aria-current", "true");
  });
});

describe("OverviewScreen polling", () => {
  it("holds the poll while a dialog is open and reads at once after it closes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    serve({ nodes: { "prj-1": [blocked("n_a", "First item")] } });
    renderScreen();

    const item = await findDetail();
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

  it("reads the board again every 15 s while no dialog is open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve({ nodes: { "prj-1": [blocked("n_a", "First item")] } });
    renderScreen();
    await findDetail();
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

    const item = await findDetail();
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

    const item = await findDetail();
    await waitFor(() =>
      expect(within(item).getByRole("button", { name: "Override" })).toBeEnabled(),
    );
    await user.click(within(item).getByRole("button", { name: "Override" }));
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

  it("shows the message of a state conflict in the dialog and reads the board again", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    vi.mocked(overrideNode).mockRejectedValue(
      new ApiError("conflict", "State conflict.", 409, "mission.node.state_conflict"),
    );
    renderScreen();

    const item = await findDetail();
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

    const item = await findDetail();
    await user.click(within(item).getByRole("button", { name: "Override" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Verified.");
    vi.mocked(listMissionNodes).mockResolvedValue([]);
    await user.click(within(dialog).getByRole("button", { name: "Override node" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Audit log" })).toBeNull());
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

    const item = await findDetail();

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

    const item = await findDetail();
    await within(item).findByText("The last execution ended: lost.");
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

    const item = await findDetail();
    await within(item).findByText("The last execution ended at its budget (turns).");
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

    const item = await findDetail();
    await within(item).findByText("The last execution ended at its budget (turns).");
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

    const item = await findDetail();
    await waitFor(() => expect(within(item).getByRole("button", { name: "Resume" })).toBeEnabled());
    await user.click(within(item).getByRole("button", { name: "Resume" }));
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

    const item = await findDetail();
    await waitFor(() => expect(within(item).getByRole("button", { name: "Resume" })).toBeEnabled());
    await user.click(within(item).getByRole("button", { name: "Resume" }));
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

    const item = await findDetail();
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

    const item = await findDetail();
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
    const item = await findDetail();

    for (const act of ["Unblock", "Override", "Discard"]) {
      await user.click(within(item).getByRole("button", { name: act }));
      await expectReasonFocused();
      await user.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    }
  });

  it("focuses Reason first in the Decide dialog", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })] },
      proposals: { n_t: [proposal("n_t", "Send the invite in the workspace language")] },
    });
    renderScreen();
    const item = await findDetail();
    await waitFor(() => expect(within(item).getByRole("button", { name: "Decide" })).toBeEnabled());

    await user.click(within(item).getByRole("button", { name: "Decide" }));

    await expectReasonFocused();
  });

  it("focuses Reason first in the Resume dialog that offers a target choice", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [paused("n_p", "Print the packing slip")] },
      executions: { n_p: [ended("e1", "n_p", { stop: { reason: "budget_end", code: "turns" } })] },
    });
    renderScreen();
    const item = await findDetail();
    await within(item).findByText("The last execution ended at its budget (turns).");

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
    const item = await findDetail();

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

    const item = await findDetail();
    expect(within(item).getAllByText("External.Requested")).toHaveLength(2);
    expect(
      within(item).getByText(
        textContent(
          "Pull request #12 on github.com/kanthorlabs/atlas waits for a merge. Merge it, then check.",
        ),
      ),
    ).toBeInTheDocument();
    expect(within(item).getByText("25 minutes ago")).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Check now" })).toBeEnabled();
    expect(
      within(cardOf("Stripe webhook")).getByText("Waits for merge · pull request #12"),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Act outside, 1 act" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("region", { name: "PR #12 waits for your merge" })).toBeVisible();
  });

  it("lists a push as unconfirmed after 10 minutes and names it", async () => {
    serve({
      nodes: { "prj-1": [outside("n_o", "Publish the changelog")] },
      actions: { n_o: [requested("n_o", "unresolved", { action: "merge_push" })] },
      evidence: { n_o: [requestEvidence("n_o", AGED, null)] },
    });

    renderScreen();

    const item = await findDetail();
    expect(
      within(item).getByText(
        textContent(
          "kanthord pushed to main 25 minutes ago, and no end state arrived. Check the delivery.",
        ),
      ),
    ).toBeInTheDocument();
    expect(
      within(cardOf("Publish the changelog")).getByText("Delivery not confirmed"),
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
    expect(screen.queryByRole("button", { name: "Publish the changelog" })).toBeNull();
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

    await screen.findAllByRole("tab");
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

    await screen.findAllByRole("tab");
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

    const item = await findDetail();
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

    const item = await findDetail();
    await user.click(await within(item).findByRole("button", { name: "Check now" }));

    expect(await within(item).findByText("Not delivered yet")).toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(vi.mocked(toast.error).mock.calls[0]?.[1]).toMatchObject({
      description: "Unknown failure. (system.operation.unknown)",
      action: { label: "Retry" },
    });
  });

  it("reads the board again after a check", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-2": [outside("n_o", "Stripe webhook")] },
      actions: { n_o: [requested("n_o", "unresolved")] },
      evidence: { n_o: [requestEvidence("n_o", AGED)] },
    });
    vi.mocked(checkNode).mockResolvedValue({ results: [], failures: [] });
    renderScreen();
    const item = await findDetail();
    const reads = vi.mocked(listProjects).mock.calls.length;

    await user.click(await within(item).findByRole("button", { name: "Check now" }));

    await waitFor(() => expect(vi.mocked(listProjects).mock.calls.length).toBeGreaterThan(reads));
  });

  it("offers Check now on a Paused node with an unresolved request", async () => {
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

    const item = await findDetail();
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

    const item = await findDetail();
    await waitFor(() => expect(within(item).getByRole("button", { name: "Resume" })).toBeEnabled());

    expect(within(item).queryByRole("button", { name: "Check now" })).toBeNull();
  });

  it("selects the next card after a check removes an item", async () => {
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

    const first = await findDetail();
    await user.click(await within(first).findByRole("button", { name: "Check now" }));

    await waitFor(() =>
      expect(within(listOf()).queryByRole("button", { name: "First wait" })).toBeNull(),
    );
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 3, name: /Second wait|PR #12/ })).toHaveFocus(),
    );
    expect(cardOf("Second wait").firstElementChild).toHaveAttribute("aria-current", "true");
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
  instances: readonly string[] | null = ["coder-1"],
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
      instances === null ? { worker, instance_count: 1 } : { worker, worker_instances: instances },
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

    const item = await findDetail();
    expect(within(cardOf("engine")).getByText(/^Environment failed/)).toBeInTheDocument();
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

  it("shows the failed command of the environment under Why", async () => {
    serve({ environments: { "prj-1": [failedEnvironment()] } });
    renderScreen();

    const item = await findDetail();

    expect(within(item).getByText(/exited with 127/)).toHaveTextContent(
      "make exited with 127. Reproduce it with make.",
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

    const item = await findDetail();
    expect(within(cardOf("engine")).getByText(/^Environment waiting/)).toBeInTheDocument();
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

    const item = await findDetail();
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
    expect(cardOf("kanthord")).toBeInTheDocument();
  });

  it("lists a paused project and resumes it in place", async () => {
    const user = userEvent.setup();
    const paused = { ...KANTHORD, paused_at: NOW - 3 * HOUR };
    serve({ projects: [paused, ATLAS] });
    vi.mocked(readProject).mockResolvedValue(paused);
    renderScreen();

    const item = await findDetail();
    expect(within(cardOf("kanthord")).getByText("Project paused")).toBeInTheDocument();
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

  it("counts the fixes on their own tab and in the summary", async () => {
    serve({
      projects: [{ ...KANTHORD, paused_at: NOW - HOUR }, ATLAS],
      nodes: { "prj-2": [blocked("n_b", "Localize the order email")] },
    });

    renderScreen();

    expect(await screen.findByRole("tab", { name: "Fix setup, 1 act" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Rule, 1 act" })).toBeInTheDocument();
    expect(screen.getByText(/Start here:/)).toHaveTextContent(/^2 acts wait for you\./);
  });

  describe("no taker", () => {
    const waiting = plain("n_w", "Invoices page", "Waiting");

    it("names a hosted binding that lists an instance and has no live registration", async () => {
      serve({
        nodes: { "prj-1": [waiting] },
        jobs: {
          "prj-1": [agedJob("prj-1", "n_w", 5 * 60_000), agedJob("prj-1", "n_w", 3 * 60_000)],
        },
        bindings: { "prj-1": [workerBinding("reviewer-main", "reviewer@1", ["reviewer-1"])] },
      });

      renderScreen();

      const item = await findDetail();
      const card = cardOf("Implement jobs in state Waiting");
      expect(within(card).getByText(/^No taker/)).toBeInTheDocument();
      expect(within(card).getByText("5 minutes ago")).toBeInTheDocument();
      expect(within(item).getByText("Waiting")).toBeInTheDocument();
      expect(
        within(item).getByText(
          textContent(
            "2 implement jobs in state Waiting wait. Binding reviewer-main (reviewer@1) matches them and has no live registration of a listed instance. Open the worker page to check its instances.",
          ),
        ),
      ).toBeInTheDocument();
      expect(within(item).getByRole("button", { name: "Open bindings" })).toHaveAttribute(
        "href",
        "/projects/prj-1?tab=bindings",
      );
    });

    it("tells the human to add an instance to a hosted binding that lists none", async () => {
      serve({
        nodes: { "prj-1": [waiting] },
        jobs: { "prj-1": [agedJob("prj-1", "n_w", 5 * 60_000)] },
        bindings: { "prj-1": [workerBinding("reviewer-main", "reviewer@1", [])] },
      });

      renderScreen();

      const item = await findDetail();
      expect(
        within(item).getByText(
          textContent(
            "1 implement job in state Waiting waits. Binding reviewer-main (reviewer@1) matches it and lists no instance. Add an instance to the binding on the Bindings tab.",
          ),
        ),
      ).toBeInTheDocument();
    });

    it("sends the human to the worker page for a hosted binding that lists a worker instance", async () => {
      serve({
        nodes: { "prj-1": [waiting] },
        jobs: { "prj-1": [agedJob("prj-1", "n_w", 5 * 60_000)] },
        bindings: { "prj-1": [workerBinding("reviewer-main", "reviewer@1", ["box-1"])] },
      });

      renderScreen();

      const item = await findDetail();
      expect(
        within(item).getByText(
          textContent(
            "1 implement job in state Waiting waits. Binding reviewer-main (reviewer@1) matches it and has no live registration of a listed instance. Open the worker page to check its instances.",
          ),
        ),
      ).toBeInTheDocument();
    });

    it("tells the human to start the worker program of an external harness", async () => {
      serve({
        nodes: { "prj-1": [waiting] },
        jobs: { "prj-1": [agedJob("prj-1", "n_w", 5 * 60_000)] },
        bindings: { "prj-1": [workerBinding("claude-main", "claude-code@1", null)] },
        catalog: [
          {
            name: "claude-code@1",
            host: "external-harness",
            declared_node_states: ["Waiting"],
            declared_intents: ["implement"],
          },
        ],
      });

      renderScreen();

      const item = await findDetail();
      expect(
        within(item).getByText(
          textContent(
            "1 implement job in state Waiting waits. Binding claude-main (claude-code@1) matches it and has no live registration. Start its worker program.",
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
        bindings: { "prj-1": [workerBinding("general-main", "coder@1")] },
      });

      renderScreen();

      const item = await findDetail();
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

      const item = await findDetail();
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
        bindings: { "prj-1": [workerBinding("reviewer-main", "reviewer@1", ["reviewer-1"])] },
      });

      renderScreen();

      expect(await screen.findByText("All clear")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Implement jobs in state Waiting" })).toBeNull();
    });

    it("lists nothing when a live registration declares the state", async () => {
      serve({
        nodes: { "prj-1": [waiting] },
        jobs: { "prj-1": [agedJob("prj-1", "n_w", 5 * 60_000)] },
        bindings: { "prj-1": [workerBinding("reviewer-main", "reviewer@1", ["reviewer-1"])] },
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

    const item = await findDetail();
    const card = cardOf("swe@1");
    expect(within(card).getByText(/^Invalid agent configuration/)).toBeInTheDocument();
    expect(within(card).getByText("kanthord")).toBeInTheDocument();
    expect(within(card).getByText("age unknown")).toBeInTheDocument();
    expect(
      within(item).getByText(
        textContent(
          "Agent swe@1 has an invalid configuration (agent.enablement.unavailable) in binding coder-main in project kanthord. Fix the enablement on the agent page.",
        ),
      ),
    ).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Open agent" })).toHaveAttribute(
      "href",
      "/agents/swe%401",
    );
    expect(within(listOf()).queryByRole("button", { name: "re@1" })).toBeNull();
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

    const item = await findDetail();
    expect(within(listOf()).getAllByRole("button", { name: "swe@1" })).toHaveLength(1);
    expect(
      within(item).getByText(
        textContent(
          "Agent swe@1 has an invalid configuration (agent.enablement.unavailable) in binding coder-main in project kanthord, binding coder-extra in project atlas. Fix the enablement on the agent page.",
        ),
      ),
    ).toBeInTheDocument();
    expect(within(item).getByText("2 bindings in 2 projects")).toBeInTheDocument();
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

      const item = await findDetail();
      expect(within(cardOf("openai-main")).getByText(/^Credential refused/)).toBeInTheDocument();
      expect(
        within(item).getByText(
          textContent(
            "The provider refused openai-main (unauthorized) in the execution of Add password reset. Rotate the credential.",
          ),
        ),
      ).toBeInTheDocument();
      expect(within(item).getByText("2 hours ago")).toBeInTheDocument();
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

      const item = await findDetail();
      expect(within(item).getByText("2 nodes in 2 projects")).toBeInTheDocument();
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

      const item = await findDetail();
      expect(
        within(cardOf("swe@1")).getByText(/^Provider rejected the request/),
      ).toBeInTheDocument();
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

  describe("cooling chain", () => {
    const cooling = {
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
    };

    it("shows a cooling chain as a fact line of the summary, not as an item", async () => {
      serve(cooling);

      renderScreen();

      expect(
        await screen.findByText(
          textContent(
            "swe@1 in coder-main of kanthord: every model cools down until 2026-10-15 14:05 UTC.",
          ),
        ),
      ).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "swe@1" })).toHaveAttribute(
        "href",
        "/agents/swe%401",
      );
      expect(screen.getByText("All clear")).toBeInTheDocument();
    });

    it("names the project of a cooling line only under All projects", async () => {
      serve(cooling);

      renderScreen("/?project=prj-1");

      expect(
        await screen.findByText(
          textContent("swe@1 in coder-main: every model cools down until 2026-10-15 14:05 UTC."),
        ),
      ).toBeInTheDocument();
    });
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

    const item = await findDetail();
    const card = cardOf("Create the project account-recovery");
    expect(
      within(card).getByText("Waits for approval · swe@1 · project.create"),
    ).toBeInTheDocument();
    expect(within(card).getByText("1 hour ago")).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Open chat" })).toHaveAttribute(
      "href",
      "/workbench/workbench_session_A",
    );
    expect(
      within(item).getByText(/waits for your answer to operation project\.create\./),
    ).toBeVisible();
    expect(screen.getByRole("tab", { name: "Approve tool, 1 act" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText(/Start here:/)).toHaveTextContent(/^1 act waits for you\./);
    expect(screen.queryByText("All clear")).toBeNull();
  });

  it("titles the item with the name of the session before its first message", async () => {
    serve({ sessions: [session("workbench_session_A", { name: "Recovery flow" })] });

    renderScreen();

    await findDetail();
    expect(cardButton("Recovery flow")).toBeInTheDocument();
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

  it("counts the approval with the acts of the nodes", async () => {
    serve({
      nodes: { "prj-1": [blocked("n_a", "Audit log")] },
      sessions: [session("workbench_session_A")],
    });

    renderScreen();

    expect(await screen.findByRole("tab", { name: "Approve tool, 1 act" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Rule, 1 act" })).toBeInTheDocument();
    expect(screen.getByText(/Start here:/)).toHaveTextContent(/^2 acts wait for you\./);
  });

  it("counts the approval under a project filter and says that it counts all projects", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-2": [blocked("n_b", "B")] },
      sessions: [session("workbench_session_A")],
    });

    renderScreen("/?project=prj-2");

    const tab = await screen.findByRole("tab", { name: "Approve tool, 1 act, all projects" });
    expect(screen.getByRole("button", { name: "atlas · 2" })).toBeInTheDocument();
    await user.click(tab);
    expect(screen.getByText("Approve or reject. Counts all projects.")).toBeInTheDocument();
    expect(
      within(listOf()).getByRole("button", { name: "Create the project account-recovery" }),
    ).toBeInTheDocument();
  });

  it("reads the sessions under a project filter", async () => {
    serve({ sessions: [session("workbench_session_A")] });

    renderScreen("/?project=prj-1");

    expect(
      await screen.findByRole("tab", { name: "Approve tool, 1 act, all projects" }),
    ).toBeInTheDocument();
    expect(listWorkbenchSessions).toHaveBeenCalledTimes(1);
  });

  it("names a failed session read under a project filter and holds back All clear", async () => {
    serve({});
    vi.mocked(listWorkbenchSessions).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );

    renderScreen("/?project=prj-1");

    expect(
      await screen.findByText(textContent(/Some records could not be read: workbench sessions/)),
    ).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
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

describe("OverviewScreen widths", () => {
  function threeBlocked(): Record<string, MissionNodeRecord[]> {
    return {
      "prj-1": [
        blocked("n_a", "First item", { createdAt: NOW - 9 * HOUR }),
        blocked("n_b", "Second item", { createdAt: NOW - 8 * HOUR }),
        blocked("n_c", "Third item", { createdAt: NOW - 7 * HOUR }),
      ],
    };
  }

  it("shows the list and the detail side by side on expanded width", async () => {
    serve({ nodes: threeBlocked() });

    renderScreen();
    setWidth(EXPANDED_WIDTH);

    expect(await screen.findByRole("region", { name: /^First item/ })).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(screen.getByText("1 of 3")).toBeVisible();
    expect(screen.getByRole("button", { name: "kanthord · 3" })).toBeVisible();
  });

  it("selects a card without a sheet on expanded width", async () => {
    serve({ nodes: threeBlocked() });
    renderScreen();
    setWidth(EXPANDED_WIDTH);

    await showItem("Second item");

    expect(screen.getByRole("region", { name: /^Second item/ })).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(searchOf().get("item")).toBe("blocked:n_b");
    expect(searchOf().get("kind")).toBe("blocked");
  });

  it("opens a right sheet with Close and steps through the cards on medium width", async () => {
    const user = userEvent.setup();
    serve({ nodes: threeBlocked() });
    renderScreen();
    setWidth(MEDIUM_WIDTH);
    await screen.findAllByRole("tab");

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByText(/^Act on the stopped node\. A node stops until you act/),
    ).toBeInTheDocument();
    await user.click(cardButton("Second item"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass("data-[side=right]:w-[min(560px,100%)]");
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeVisible();
    expect(within(dialog).getByText("2 of 3")).toBeVisible();
    expect(screen.getByText("Second item, 2 of 3.")).toBeInTheDocument();
    await waitFor(() =>
      expect(within(dialog).getByRole("heading", { level: 3, name: /^Second item/ })).toHaveFocus(),
    );

    await user.click(within(dialog).getByRole("button", { name: "Next card" }));

    expect(within(dialog).getByText("3 of 3")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Next card" })).toBeDisabled();
    expect(searchOf().get("item")).toBe("blocked:n_c");
    expect(screen.getByText("Third item, 3 of 3.")).toBeInTheDocument();
    expect(within(dialog).getByRole("heading", { level: 3, name: /^Third item/ })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Previous card" }));
    await user.click(within(dialog).getByRole("button", { name: "Previous card" }));

    expect(within(dialog).getByText("1 of 3")).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Previous card" })).toBeDisabled();
    expect(searchOf().get("item")).toBe("blocked:n_a");

    await user.click(within(dialog).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens a full-width sheet with Back on compact width", async () => {
    const user = userEvent.setup();
    serve({ nodes: threeBlocked() });
    renderScreen();
    setWidth(COMPACT_WIDTH);
    await screen.findAllByRole("tab");

    await user.click(cardButton("First item"));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveClass("data-[side=right]:w-full");
    expect(within(dialog).getByRole("button", { name: "Back" })).toBeVisible();
    expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
    expect(within(dialog).getByText("1 of 3")).toBeVisible();
  });

  it("opens the detail of a deep link on compact width", async () => {
    serve({ nodes: threeBlocked() });

    renderScreen("/?item=blocked:n_b");
    setWidth(COMPACT_WIDTH);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("2 of 3")).toBeVisible();
    expect(within(dialog).getByRole("heading", { level: 3, name: /^Second item/ })).toBeVisible();
  });

  it("keeps the selection when the width grows to expanded and opens no sheet when it shrinks", async () => {
    const user = userEvent.setup();
    serve({ nodes: threeBlocked() });
    renderScreen();
    setWidth(MEDIUM_WIDTH);
    await screen.findAllByRole("tab");
    await user.click(cardButton("Second item"));
    await screen.findByRole("dialog");

    setWidth(EXPANDED_WIDTH);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("region", { name: /^Second item/ })).toBeVisible();
    setWidth(COMPACT_WIDTH);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(cardOf("Second item").firstElementChild).toHaveAttribute("aria-current", "true");
  });

  it("pins a selected item that leaves the list and offers the next card", async () => {
    const user = userEvent.setup();
    const nodes = threeBlocked();
    serve({ nodes });
    renderScreen();
    await showItem("Second item");

    nodes["prj-1"] = (nodes["prj-1"] ?? []).filter((node) => node.id !== "n_b");
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByText("This item no longer waits")).toBeVisible();
    expect(
      screen.getByText(
        "Second item left the list at the last refresh. An act elsewhere or a change outside KanthorD resolved it.",
      ),
    ).toBeVisible();
    expect(screen.getByText("The selected item no longer waits.")).toBeInTheDocument();
    expect(within(listOf()).queryByRole("button", { name: "Second item" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Next card" }));

    expect(await screen.findByRole("region", { name: /^First item/ })).toBeVisible();
    expect(screen.queryByText("This item no longer waits")).toBeNull();
  });

  it("shows the unknown item of a link as an item that does not wait", async () => {
    serve({ nodes: threeBlocked() });

    renderScreen("/?item=blocked:n_missing");

    expect(await screen.findByText("This item no longer waits")).toBeVisible();
    expect(screen.getByText("The link points to an item that does not wait now.")).toBeVisible();
    expect(screen.getByText("The selected item no longer waits.")).toBeInTheDocument();
  });

  it("closes the sheet and focuses the next card after a confirmed act on medium width", async () => {
    const user = userEvent.setup();
    const nodes = threeBlocked();
    serve({ nodes });
    vi.mocked(discardNode).mockImplementation(async (nodeId) => {
      nodes["prj-1"] = (nodes["prj-1"] ?? []).filter((node) => node.id !== nodeId);
      return {} as MissionControlResult;
    });
    renderScreen();
    setWidth(MEDIUM_WIDTH);
    await screen.findAllByRole("tab");
    await user.click(cardButton("Second item"));
    const sheet = await screen.findByRole("dialog");

    await user.click(within(sheet).getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Out of scope.");
    await user.click(within(dialog).getByRole("button", { name: "Discard node" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(cardButton("Third item")).toHaveFocus());
    expect(within(listOf()).queryByRole("button", { name: "Second item" })).toBeNull();
  });
});

describe("OverviewScreen keyboard", () => {
  function threeBlocked(): Record<string, MissionNodeRecord[]> {
    return {
      "prj-1": [
        blocked("n_a", "First item", { createdAt: NOW - 9 * HOUR }),
        blocked("n_b", "Second item", { createdAt: NOW - 8 * HOUR }),
        blocked("n_c", "Third item", { createdAt: NOW - 7 * HOUR }),
      ],
    };
  }

  function selected(name: string): boolean {
    return cardOf(name).firstElementChild?.getAttribute("aria-current") === "true";
  }

  function resumable(): Record<string, MissionNodeRecord[]> {
    return { "prj-1": [paused("n_p", "Print the packing slip")] };
  }

  const BUDGET_END = {
    n_p: [ended("e1", "n_p", { stop: { reason: "budget_end", code: "turns" } })],
  };

  async function openShortcuts(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole("button", { name: "Keyboard shortcuts" }));
    return screen.findByRole("dialog", { name: "Keyboard shortcuts" });
  }

  it("moves the selection and the focus with ArrowDown and j, and leaves the list with one Tab", async () => {
    const user = userEvent.setup();
    serve({ nodes: threeBlocked() });
    renderScreen();
    await showItem("First item");

    await user.keyboard("{ArrowDown}");
    expect(cardButton("Second item")).toHaveFocus();
    expect(selected("Second item")).toBe(true);
    expect(within(await findDetail()).getByRole("heading", { level: 3 })).toHaveTextContent(
      /^Second item/,
    );
    expect(cardButton("Second item")).toHaveAttribute("tabindex", "0");
    expect(cardButton("First item")).toHaveAttribute("tabindex", "-1");

    await user.keyboard("j");
    expect(cardButton("Third item")).toHaveFocus();
    await user.keyboard("{ArrowUp}k");
    expect(cardButton("First item")).toHaveFocus();
    await user.keyboard("{End}");
    expect(cardButton("Third item")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(cardButton("First item")).toHaveFocus();

    await user.keyboard("j");
    await user.tab();
    expect(listOf()).not.toContainElement(document.activeElement as HTMLElement);
  });

  it("does nothing to the cards with an arrow key or a letter outside the list", async () => {
    const user = userEvent.setup();
    serve({ nodes: threeBlocked() });
    renderScreen();
    await showItem("First item");
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await user.keyboard("{ArrowDown}j{End}");

    expect(selected("First item")).toBe(true);
  });

  it("selects Fix setup with 2", async () => {
    const user = userEvent.setup();
    serve({ nodes: threeBlocked(), environments: { "prj-1": [failedEnvironment()] } });
    renderScreen();
    await screen.findAllByRole("tab");

    await user.keyboard("2");

    expect(screen.getByRole("tab", { name: /^Fix setup,/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(await within(listOf()).findByRole("button", { name: "engine" })).toBeVisible();
    expect(selected("engine")).toBe(true);
  });

  it("opens the resume dialog with r on a selected Resume card", async () => {
    const user = userEvent.setup();
    serve({ nodes: resumable(), executions: BUDGET_END });
    renderScreen();
    const item = await findDetail();
    await within(item).findByText("The last execution ended at its budget (turns).");

    await user.keyboard("r");

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Resume node" })).toBeVisible();
  });

  it("shows the key hints and aria-keyshortcuts while the shortcuts are on", async () => {
    serve({ nodes: resumable(), executions: BUDGET_END });
    renderScreen();
    const item = await findDetail();
    await within(item).findByText("The last execution ended at its budget (turns).");

    const resume = within(item).getByRole("button", { name: "Resume" });

    expect(resume).toHaveAttribute("aria-keyshortcuts", "r");
    expect(resume.querySelector("kbd")).toHaveTextContent("r");
    expect(screen.getByRole("tab", { name: /^Fix setup,/ })).toHaveAttribute(
      "aria-keyshortcuts",
      "2",
    );
  });

  it("turns the shortcuts off and keeps the setting after a reload", async () => {
    const user = userEvent.setup();
    serve({ nodes: resumable(), executions: BUDGET_END });
    const first = renderScreen();
    const item = await findDetail();
    await within(item).findByText("The last execution ended at its budget (turns).");
    const dialog = await openShortcuts(user);

    await user.click(within(dialog).getByRole("switch", { name: "Single-key shortcuts" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await user.keyboard("2r");

    expect(screen.getByRole("tab", { name: /^Resume,/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(within(item).getByRole("button", { name: "Resume" })).not.toHaveAttribute(
      "aria-keyshortcuts",
    );
    expect(within(item).getByRole("button", { name: "Resume" }).querySelector("kbd")).toBeNull();
    expect(screen.getByRole("tab", { name: /^Fix setup,/ })).not.toHaveAttribute(
      "aria-keyshortcuts",
    );

    first.unmount();
    renderScreen();
    const again = await findDetail();
    await within(again).findByText("The last execution ended at its budget (turns).");
    await user.keyboard("2r");

    expect(screen.getByRole("tab", { name: /^Resume,/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByText("r", { selector: "kbd" })).toBeNull();
  });

  it("opens the shortcuts dialog with ?", async () => {
    const user = userEvent.setup();
    serve({ nodes: threeBlocked() });
    renderScreen();
    await screen.findAllByRole("tab");

    await user.keyboard("?");

    expect(await screen.findByRole("dialog", { name: "Keyboard shortcuts" })).toBeVisible();
  });

  it("keeps the key of an act that waits for a read and names what it needs", async () => {
    const user = userEvent.setup();
    serve({ nodes: resumable() });
    vi.mocked(listNodeExecutions).mockReturnValue(new Promise(() => undefined));
    renderScreen();
    const item = await findDetail();

    const resume = within(item).getByRole("button", { name: "Resume" });
    expect(resume).toHaveAttribute("aria-disabled", "true");
    expect(resume).toHaveAttribute("aria-keyshortcuts", "r");
    expect(resume.querySelector("kbd")).toHaveTextContent("r");

    await user.keyboard("r");

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getAllByRole("status").map((region) => region.textContent)).toContain(
      "Resume needs: the executions and external actions read.",
    );
  });

  it("moves focus to the detail title with Enter and back to the card with Esc", async () => {
    const user = userEvent.setup();
    serve({ nodes: threeBlocked() });
    renderScreen();
    await showItem("Second item");

    await user.keyboard("{Enter}");
    await waitFor(() =>
      expect(screen.getByRole("heading", { level: 3, name: /^Second item/ })).toHaveFocus(),
    );

    await user.keyboard("{Escape}");
    expect(cardButton("Second item")).toHaveFocus();
  });

  it("opens the next card in the sheet with j and closes the sheet with 3 on compact width", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [...(threeBlocked()["prj-1"] ?? []), paused("n_p", "Print the slip")] },
    });
    renderScreen();
    setWidth(COMPACT_WIDTH);
    await screen.findAllByRole("tab");
    await user.click(cardButton("First item"));
    const sheet = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(within(sheet).getByRole("heading", { level: 3, name: /^First item/ })).toHaveFocus(),
    );

    await user.keyboard("j");

    expect(within(sheet).getByText("2 of 3")).toBeVisible();
    await waitFor(() =>
      expect(within(sheet).getByRole("heading", { level: 3, name: /^Second item/ })).toHaveFocus(),
    );

    await user.keyboard("3");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("tab", { name: /^Resume,/ })).toHaveAttribute("aria-selected", "true");
    expect(cardButton("Print the slip")).toBeVisible();
  });
});

describe("OverviewScreen history and phone", () => {
  function threeBlocked(): Record<string, MissionNodeRecord[]> {
    return {
      "prj-1": [
        blocked("n_a", "First item", { createdAt: NOW - 9 * HOUR }),
        blocked("n_b", "Second item", { createdAt: NOW - 8 * HOUR }),
        blocked("n_c", "Third item", { createdAt: NOW - 7 * HOUR }),
      ],
    };
  }

  function BrowserBack() {
    const navigate = useNavigate();
    const location = useLocation();
    return (
      <>
        <button type="button" onClick={() => navigate(-1)}>
          Browser back
        </button>
        <output aria-label="Path">{location.pathname}</output>
      </>
    );
  }

  function renderHistory(
    entries: readonly (string | { pathname: string; search: string })[],
    strict = false,
  ) {
    const tree = (
      <MemoryRouter initialEntries={[...entries]} initialIndex={entries.length - 1}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <OverviewScreen />
                <Location />
              </>
            }
          />
          <Route path="/previous" element={<p>Previous page</p>} />
          <Route path="/traces/:traceId" element={<p>Trace page</p>} />
        </Routes>
        <BrowserBack />
      </MemoryRouter>
    );
    return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
  }

  async function goBack(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole("button", { name: "Browser back", hidden: true }));
  }

  function pathOf(): string | null {
    return screen.getByRole("status", { name: "Path", hidden: true }).textContent;
  }

  async function openFirstOnPhone(user: ReturnType<typeof userEvent.setup>) {
    setWidth(COMPACT_WIDTH);
    await screen.findAllByRole("tab");
    await user.click(cardButton("First item"));
    return screen.findByRole("dialog");
  }

  it("closes the detail with Back and focuses the card", async () => {
    const user = userEvent.setup();
    serve({ nodes: threeBlocked() });
    renderHistory(["/previous", "/"]);
    await openFirstOnPhone(user);

    await goBack(user);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(pathOf()).toBe("/");
    expect(cardButton("First item")).toHaveFocus();
    await goBack(user);
    expect(await screen.findByText("Previous page")).toBeVisible();
  });

  it("closes the sheet with 3, writes kind paused and leaves no entry behind", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [...(threeBlocked()["prj-1"] ?? []), paused("n_p", "Print the slip")] },
    });
    renderHistory(["/previous", "/"]);
    await openFirstOnPhone(user);

    await user.keyboard("3");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(searchOf().get("kind")).toBe("paused");
    await goBack(user);
    expect(await screen.findByText("Previous page")).toBeVisible();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the sheet with Esc through one history pop", async () => {
    const user = userEvent.setup();
    serve({ nodes: threeBlocked() });
    renderHistory(["/previous", "/"]);
    await openFirstOnPhone(user);

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await goBack(user);
    expect(await screen.findByText("Previous page")).toBeVisible();
  });

  it("shows Done this session closed after a discard and leaves no entry behind", async () => {
    const user = userEvent.setup();
    const nodes = threeBlocked();
    serve({ nodes });
    vi.mocked(discardNode).mockImplementation(async (nodeId) => {
      nodes["prj-1"] = (nodes["prj-1"] ?? []).filter((node) => node.id !== nodeId);
      return {} as MissionControlResult;
    });
    renderHistory(["/previous", "/"]);
    const sheet = await openFirstOnPhone(user);

    await user.click(within(sheet).getByRole("button", { name: "More (2)" }));
    const more = await screen.findByRole("dialog", { name: "More acts on First item" });
    await user.click(within(more).getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "Out of scope.");
    await user.click(within(dialog).getByRole("button", { name: "Discard node" }));

    const toggle = await screen.findByRole("button", { name: "Done this session 1" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(cardButton("Second item")).toHaveFocus());
    await user.click(toggle);
    expect(await screen.findByText("Discarded First item.")).toBeVisible();
    await goBack(user);
    expect(await screen.findByText("Previous page")).toBeVisible();
  });

  it("closes only the act dialog on Back and keeps the sheet", async () => {
    const user = userEvent.setup();
    serve({ nodes: threeBlocked() });
    renderHistory(["/previous", "/"]);
    const sheet = await openFirstOnPhone(user);
    await user.click(within(sheet).getByRole("button", { name: "More (2)" }));
    const more = await screen.findByRole("dialog", { name: "More acts on First item" });
    await user.click(within(more).getByRole("button", { name: "Discard" }));
    await screen.findByRole("alertdialog");

    await goBack(user);

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByRole("dialog", { name: "More acts on First item" })).toBeInTheDocument();
    expect(pathOf()).toBe("/");
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "More acts on First item" })).toBeNull(),
    );
    expect(screen.getByText("1 of 3")).toBeVisible();
    await goBack(user);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(pathOf()).toBe("/");
  });

  it("reopens the sheet on Back from Last trace and returns to the list with a second Back", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [paused("n_p", "Print the slip")] },
      executions: { n_p: [ended("e1", "n_p", { trace_id: "trace_one" })] },
    });
    renderHistory(["/previous", "/"]);
    setWidth(COMPACT_WIDTH);
    await screen.findAllByRole("tab");
    await user.click(await waitFor(() => cardButton("Print the slip")));
    const sheet = await screen.findByRole("dialog");
    await user.click(await within(sheet).findByRole("button", { name: "More (3)" }));
    const more = await screen.findByRole("dialog", { name: "More acts on Print the slip" });
    await user.click(within(more).getByRole("button", { name: "Last trace" }));
    expect(await screen.findByText("Trace page")).toBeVisible();

    await goBack(user);

    expect(await screen.findByRole("dialog", { name: /Print the slip/ })).toBeVisible();
    await goBack(user);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(pathOf()).toBe("/");
    await goBack(user);
    expect(await screen.findByText("Previous page")).toBeVisible();
  });

  it("opens the detail of a reloaded deep link under StrictMode and returns to the list with one Back", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [...(threeBlocked()["prj-1"] ?? []), paused("n_p", "Print the slip")] },
    });
    renderHistory(["/previous", { pathname: "/", search: "?kind=paused&item=paused:n_p" }], true);
    setWidth(COMPACT_WIDTH);

    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByRole("heading", { level: 3, name: /^Print the slip/ })).toBeVisible();

    await goBack(user);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(pathOf()).toBe("/");
    await goBack(user);
    expect(await screen.findByText("Previous page")).toBeVisible();
  });

  it("leaves the Overview entry with the first Back after medium, expanded and medium", async () => {
    const user = userEvent.setup();
    serve({ nodes: threeBlocked() });
    renderHistory(["/previous", "/"]);
    setWidth(MEDIUM_WIDTH);
    await screen.findAllByRole("tab");
    await user.click(cardButton("Second item"));
    await screen.findByRole("dialog");

    setWidth(EXPANDED_WIDTH);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    setWidth(MEDIUM_WIDTH);
    await goBack(user);

    expect(await screen.findByText("Previous page")).toBeVisible();
  });

  it("opens More on compact width and closes only that sheet with Esc", async () => {
    const user = userEvent.setup();
    serve({ nodes: threeBlocked() });
    renderHistory(["/previous", "/"]);
    const sheet = await openFirstOnPhone(user);
    const trigger = within(sheet).getByRole("button", { name: "More (2)" });

    await user.click(trigger);
    await screen.findByRole("dialog", { name: "More acts on First item" });
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "More acts on First item" })).toBeNull(),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(pathOf()).toBe("/");
  });
});
