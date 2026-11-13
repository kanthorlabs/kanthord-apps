import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

vi.mock("@/api/client", () => ({
  connectionBaseUrl: vi.fn(),
}));

vi.mock("@/api/resources/projects", () => ({
  listProjects: vi.fn(),
  listWorkerBindings: vi.fn(),
  listBindingAgents: vi.fn(),
  listBindings: vi.fn(),
  listProjectEnvironments: vi.fn(),
  readProject: vi.fn(),
  resumeProject: vi.fn(),
  pauseProject: vi.fn(),
  rebuildEnvironment: vi.fn(),
}));

vi.mock("@/api/resources/workers", () => ({
  listWorkerCatalog: vi.fn(),
  listWorkerRegistrations: vi.fn(),
  listAgents: vi.fn(),
  readAgent: vi.fn(),
  listAgentProviderModels: vi.fn(),
}));

vi.mock("@/features/auth/session/session-context", () => ({
  useSession: () => ({
    session: {
      instance: { id: "i-local", name: "local", baseUrl: "http://localhost:31415" },
      token: "jwt-1",
      identity: { kind: "human", sub: "kanthorlabs", name: "Ulrich" },
    },
  }),
}));

vi.mock("@/api/resources/credentials", () => ({
  listAllCredentials: vi.fn(),
  listCredentialPlatforms: vi.fn(),
  verifyCredential: vi.fn(),
  rotateCredential: vi.fn(),
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
  decideFollowup: vi.fn(),
  listProjectFollowups: vi.fn(),
  listInboxItems: vi.fn(),
  doneInboxItem: vi.fn(),
  pauseNode: vi.fn(),
  listNodeLinkUpdates: vi.fn(),
  overrideNode: vi.fn(),
  resumeNode: vi.fn(),
  removeDependency: vi.fn(),
  discardNode: vi.fn(),
  listUndecidedFindings: vi.fn(),
  listNodeRevisions: vi.fn(),
  readNodeRevision: vi.fn(),
  decideFinding: vi.fn(),
  createFinding: vi.fn(),
  updateFinding: vi.fn(),
}));

vi.mock("@/api/resources/workbench", () => ({
  listWorkbenchSessions: vi.fn(),
  readWorkbenchSession: vi.fn(),
  readWorkbenchEvents: vi.fn(),
  approveWorkbenchCall: vi.fn(),
  createWorkbenchSession: vi.fn(),
  sendWorkbenchMessage: vi.fn(),
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
  decideFollowup,
  decideProposals,
  discardNode,
  doneInboxItem,
  listInboxItems,
  listMissionNodes,
  listNodeAssessments,
  listNodeEvidence,
  listNodeExternalActions,
  listNodeLinkUpdates,
  listNodeProposals,
  listNodeRevisions,
  listProjectFollowups,
  listUndecidedFindings,
  overrideNode,
  readMission,
  readNodeRevision,
  removeDependency,
  resumeNode,
  unblockNode,
} from "@/api/resources/mission";
import { connectionBaseUrl } from "@/api/client";
import {
  listAllCredentials,
  listCredentialPlatforms,
  verifyCredential,
} from "@/api/resources/credentials";
import { readLiveness } from "@/api/resources/gateway";
import {
  listBindingAgents,
  listProjectEnvironments,
  listProjects,
  listWorkerBindings,
  pauseProject,
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
  createWorkbenchSession,
  listWorkbenchSessions,
  readWorkbenchEvents,
  readWorkbenchSession,
  sendWorkbenchMessage,
} from "@/api/resources/workbench";
import {
  listAgentProviderModels,
  listAgents,
  listWorkerCatalog,
  listWorkerRegistrations,
  readAgent,
} from "@/api/resources/workers";
import type {
  AgentDeclaration,
  AgentEnablement,
  BindingAgentView,
  Credential,
  EnvironmentState,
  InboxItem,
  Intent,
  LivenessReport,
  MissionAssessment,
  MissionAssessmentResult,
  MissionClosingEvent,
  MissionControlResult,
  MissionEvidence,
  MissionExternalAction,
  MissionFinding,
  MissionFollowupProposal,
  MissionNodeChange,
  MissionNodeRecord,
  MissionProposal,
  MissionProposalDecideResult,
  MissionRevision,
  NodeState,
  Project,
  SchedulerExecutionRecord,
  SchedulerJob,
  WorkbenchRunSnapshot,
  WorkbenchSession,
  WorkbenchSessionListItem,
  WorkerBindingRecord,
  WorkerCatalogItem,
  WorkerRegistrationRecord,
} from "@/api/types";

import { textContent } from "../../../test/text-content";

import { HomeScreen } from "./home-screen";

let NOW = 0;
const HOUR = 3_600_000;

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
    round: null,
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
  readonly yumi?: "off" | "on" | "unconfigured";
  readonly environments?: Readonly<Record<string, readonly EnvironmentState[]>>;
  readonly findings?: Readonly<Record<string, readonly MissionFinding[]>>;
  readonly followups?: Readonly<Record<string, readonly MissionFollowupProposal[]>>;
  readonly inbox?: readonly InboxItem[];
  readonly inboxPage?: number;
  readonly inboxSnoozed?: number;
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

const YUMI_CONFIGURATION = {
  agent_provider: "atlas-llm",
  model_identifier: "qwen3-coder",
  reasoning_effort: "off",
} as const;

function yumiEnablement(mode: "off" | "on" | "unconfigured"): AgentEnablement | null {
  if (mode === "off") return null;
  return {
    agent_name: "ops@1",
    state: "enabled",
    agent_providers: [
      { name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" },
    ],
    default_configuration:
      mode === "on" ? YUMI_CONFIGURATION : { ...YUMI_CONFIGURATION, agent_provider: "" },
    fallback_configurations: [],
    revision: 1,
  };
}

function conversation(id: string, text: string): WorkbenchSession {
  return {
    id,
    agent_name: "ops@1",
    configuration: YUMI_CONFIGURATION,
    entries: [
      {
        type: "message",
        id: `entry_${id}`,
        parentId: null,
        timestamp: "2026-10-05T09:00:00.000Z",
        message: { role: "user", content: text },
      },
    ],
    run_active: false,
    resume_command: "pi --session ~/session.jsonl",
  };
}

const IDLE_SNAPSHOT: WorkbenchRunSnapshot = {
  streaming_message: null,
  pending_tool_calls: [],
  pending_approval: null,
  run_active: false,
  error_message: null,
};

function followEvents(snapshot: WorkbenchRunSnapshot) {
  vi.mocked(readWorkbenchEvents).mockImplementation(async (_id, _after, version) =>
    version === null ? { entries: [], snapshot, version: 1 } : new Promise(() => undefined),
  );
}

function serve(world: World) {
  const enablement = yumiEnablement(world.yumi ?? "off");
  vi.mocked(listAgents).mockResolvedValue([
    {
      agentName: "ops@1",
      displayName: "Yumi",
      workerNames: [],
      consumers: ["workbench"],
      toolCounts: { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 3 },
      enablement,
    },
  ]);
  vi.mocked(readAgent).mockResolvedValue({ enablement } as AgentDeclaration);
  vi.mocked(listAgentProviderModels).mockResolvedValue([]);
  vi.mocked(readWorkbenchSession).mockImplementation(async (id) =>
    conversation(id, "What needs me?"),
  );
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
  vi.mocked(listUndecidedFindings).mockImplementation(
    async (projectId) => world.findings?.[projectId] ?? [],
  );
  vi.mocked(listProjectFollowups).mockImplementation(
    async (projectId) => world.followups?.[projectId] ?? [],
  );
  vi.mocked(listInboxItems).mockImplementation(async (query) => {
    const matching = (world.inbox ?? []).filter(
      (item) => query.projectId === null || item.project_id === query.projectId,
    );
    const size = Math.min(world.inboxPage ?? query.limit, query.limit);
    const from = query.cursor === null ? 0 : Number(query.cursor);
    const items = matching.slice(from, from + size);
    return {
      items,
      next_cursor: from + size < matching.length ? String(from + size) : null,
      counts: { open: matching.length, snoozed: world.inboxSnoozed ?? 0 },
    };
  });
  vi.mocked(listNodeLinkUpdates).mockResolvedValue([]);
  vi.mocked(listNodeRevisions).mockResolvedValue([]);
  vi.mocked(readNodeRevision).mockImplementation(
    async (nodeId, revision) =>
      ({
        node_id: nodeId,
        revision,
        content: { name: `Sign-up form, revision ${revision}` },
      }) as unknown as MissionRevision,
  );
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
  vi.mocked(listCredentialPlatforms).mockResolvedValue({
    items: [
      {
        platform: "openai-compatible",
        secret_shape: "api_key",
        login_modes: [],
        metadata_fields: [],
        verifiable: true,
      },
    ],
  });
  vi.mocked(listWorkbenchSessions).mockImplementation(async (agentName) =>
    (world.sessions ?? []).filter((item) => agentName === null || item.agent_name === agentName),
  );
  followEvents(IDLE_SNAPSHOT);
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

function followup(nodeId: string, nodeRevision: number): MissionFollowupProposal {
  return {
    id: `followup_${nodeId}`,
    node_id: nodeId,
    attempt: 1,
    assessment_id: null,
    content: { node_revision: nodeRevision },
    created_node_id: null,
    approved_at: null,
    rejected_at: null,
    created_at: NOW - HOUR,
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
function thread(id: string, overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    link_update_id: id,
    project_id: "prj-1",
    external_link: {
      kind: "github_issue",
      resource_identity: "conversation:github:acme/shop",
      number: 42,
    },
    reason: "linked",
    state: "open",
    occurred_at: NOW - 2 * HOUR,
    done_at: null,
    snoozed_until: null,
    inbound_event_id: `event_${id}`,
    actor_id: "actor_1",
    trusted: true,
    linked_node_ids: [],
    content: {
      author: "ulrich",
      body: `Body of ${id}`,
      url: "https://github.com/acme/shop/issues/42",
      occurred_at: NOW - 2 * HOUR,
    },
    ...overrides,
  };
}
function renderScreen(entry = "/", onResume?: () => void) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <HomeScreen onResume={onResume} />
    </MemoryRouter>,
  );
}

async function findPrimary(name: RegExp | string = /^Primary: /): Promise<HTMLElement> {
  const primary = await screen.findByRole("group", { name });
  await waitFor(() => expect(within(primary).getAllByRole("button").length).toBeGreaterThan(0));
  return primary;
}

async function press(user: ReturnType<typeof userEvent.setup>, name: string | RegExp) {
  const direct = screen.queryByRole("button", { name });
  if (direct !== null) {
    await user.click(direct);
    return;
  }
  await user.click(await screen.findByRole("button", { name: /^More/ }));
  const sheet = await screen.findByRole("dialog", { name: /^More acts on / });
  await user.click(within(sheet).getByRole("button", { name }));
}

beforeEach(() => {
  vi.resetAllMocks();
  NOW = Date.now();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("HomeScreen layout", () => {
  it("renders the heading Home and the deck as the last entry before the composer", async () => {
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });

    renderScreen();

    const heading = screen.getByRole("heading", { level: 2, name: "Home" });
    const deck = await screen.findByRole("region", { name: "Waiting acts" });
    const column = heading.parentElement?.parentElement;
    expect(column).toContainElement(deck);
    expect(deck.nextElementSibling).toContainElement(
      screen.getByRole("form", { name: "Composer" }),
    );
    expect(column).toHaveClass("max-w-[760px]", "mx-auto", "w-full");
  });

  it("offers Resume onboarding while a setup step is open", async () => {
    serve({});
    const onResume = vi.fn();

    renderScreen("/", onResume);
    await userEvent.click(await screen.findByRole("button", { name: "Resume onboarding" }));

    expect(onResume).toHaveBeenCalledOnce();
  });

  it("shows the no-project empty state with New project", async () => {
    serve({ projects: [] });

    renderScreen();

    expect(await screen.findByText("No projects")).toBeInTheDocument();
    expect(screen.getByText("This server holds no project.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New project" })).toHaveAttribute(
      "href",
      "/projects/new",
    );
    expect(screen.queryByRole("region", { name: "Waiting acts" })).toBeNull();
  });

  it("shows an alert with Retry when the project list fails on the first read", async () => {
    const user = userEvent.setup();
    serve({});
    vi.mocked(listProjects).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );

    renderScreen();

    expect(await screen.findByText("Home could not be read.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Waiting acts" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("All clear")).toBeInTheDocument();
  });
});

describe("HomeScreen reads", () => {
  it("names a failed source and reads only that source on Retry", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [], "prj-2": [] } });
    vi.mocked(listQueueJobs).mockImplementation(async (projectId) => {
      if (projectId === "prj-2") throw new ApiError("unreachable", "The daemon did not answer.", 0);
      return [];
    });
    renderScreen();
    expect(
      await screen.findByText(textContent(/Some records could not be read: atlas queue/)),
    ).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
    vi.mocked(listQueueJobs).mockImplementation(async () => []);
    for (const read of [listProjects, readMission, listMissionNodes, listWorkbenchSessions]) {
      vi.mocked(read).mockClear();
    }
    vi.mocked(listQueueJobs).mockClear();
    vi.mocked(listInboxItems).mockClear();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("All clear")).toBeInTheDocument();
    expect(listQueueJobs).toHaveBeenCalledTimes(1);
    expect(listQueueJobs).toHaveBeenCalledWith("prj-2");
    expect(listProjects).not.toHaveBeenCalled();
    expect(readMission).not.toHaveBeenCalled();
    expect(listMissionNodes).not.toHaveBeenCalled();
    expect(listWorkbenchSessions).not.toHaveBeenCalled();
    expect(listInboxItems).not.toHaveBeenCalled();
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

  it("shows the health alert when the daemon reports an unhealthy service", async () => {
    serve({
      nodes: { "prj-1": [blocked("n_a", "Audit log")] },
      liveness: { healthy: false, services: { server: { gateway: 200, store: 503, log: 200 } } },
    });

    renderScreen();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

describe("HomeScreen scope", () => {
  it("holds the items of every project and renders no project filter", async () => {
    serve({
      nodes: {
        "prj-1": [blocked("n_a", "Audit log", { createdAt: NOW - 5 * HOUR })],
        "prj-2": [blocked("n_b", "Localize the email", { createdAt: NOW - 4 * HOUR })],
      },
    });

    renderScreen("/?project=prj-2");

    const primary = await findPrimary(/^Primary: Audit log/);
    expect(within(primary).getByText("kanthord")).toBeVisible();
    expect(screen.getByText(/^1 of 2 waiting/)).toBeVisible();
    expect(screen.getByText(/^Next #2 Localize the email/)).toBeVisible();
    expect(screen.queryByRole("combobox", { name: /project/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /^kanthord · / })).toBeNull();
    expect(screen.queryByRole("tab")).toBeNull();
  });
});

describe("HomeScreen acts on the primary card", () => {
  it("opens the Resume dialog", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [paused("n_p", "Compute the rates", 3)] },
      executions: {
        n_p: [ended("e1", "n_p", { claim_state: "lost", ended_at: null, expired_at: NOW - HOUR })],
      },
    });
    renderScreen();

    const primary = await findPrimary();
    await waitFor(() =>
      expect(within(primary).getByRole("button", { name: "Resume" })).toBeEnabled(),
    );
    await user.click(within(primary).getByRole("button", { name: "Resume" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Resume Compute the rates?")).toBeVisible();
    await user.type(within(dialog).getByLabelText("Reason"), "Try again.");
    await user.click(within(dialog).getByRole("button", { name: "Resume node" }));
    expect(resumeNode).toHaveBeenCalledWith(
      "n_p",
      expect.objectContaining({ reason: "Try again." }),
    );
  });

  it("opens the Unblock dialog", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    renderScreen();

    const primary = await findPrimary();
    await user.click(await within(primary).findByRole("button", { name: "Unblock" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Unblock Audit log?")).toBeVisible();
    await user.type(within(dialog).getByLabelText("Reason"), "Retry.");
    await user.click(within(dialog).getByRole("button", { name: "Unblock node" }));
    expect(unblockNode).toHaveBeenCalledWith(
      "n_a",
      expect.objectContaining({ blocked_attempt: 2, reason: "Retry." }),
    );
  });

  it("opens the Decide dialog of the proposals", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })] },
      proposals: { n_t: [proposal("n_t", "Send the invite in the workspace language")] },
    });
    renderScreen();

    const primary = await findPrimary();
    await waitFor(() =>
      expect(within(primary).getByRole("button", { name: "Decide" })).toBeEnabled(),
    );
    await user.click(within(primary).getByRole("button", { name: "Decide" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Decide the proposals of Team workspaces?")).toBeVisible();
  });

  it("opens the Decide dialog of the follow-up proposal", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [plain("n_f", "Sign-up form", "Completed")] },
      followups: { "prj-1": [followup("n_f", 2)] },
    });
    vi.mocked(decideFollowup).mockResolvedValue({});
    renderScreen();

    const primary = await findPrimary();
    await user.click(await within(primary).findByRole("button", { name: "Decide" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText("Decide the follow-up proposal of Sign-up form?"),
    ).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Create follow-up node" }));
    expect(decideFollowup).toHaveBeenCalledWith("n_f", {
      expected_mission_version: 7,
      approve: true,
    });
  });

  it("opens the Remove dependency dialog", async () => {
    const user = userEvent.setup();
    serve({
      nodes: {
        "prj-1": [
          { ...pending("n_c", "Redirect the legacy links", ["n_b"]), attempt: 0 },
          plain("n_b", "Drop the legacy checkout", "Discarded"),
        ],
      },
    });
    renderScreen();

    const primary = await findPrimary();
    await user.click(
      await within(primary).findByRole("button", {
        name: "Remove dependency on Drop the legacy checkout",
      }),
    );

    const dialog = await screen.findByRole("alertdialog");
    await user.type(within(dialog).getByLabelText("Reason"), "The checkout is gone.");
    await user.click(within(dialog).getByRole("button", { name: "Remove dependency" }));
    expect(removeDependency).toHaveBeenCalledWith("n_c", "n_b", {
      reason: "The checkout is gone.",
      expected_mission_version: 7,
    });
  });

  it("opens the Rotate sheet of a refused credential", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [paused("n_p", "Print the slip")] },
      pages: { "prj-1": [providerStop("e1", "n_p", "unauthorized")] },
      executions: { n_p: [providerStop("e1", "n_p", "unauthorized")] },
      credentials: [llmCredential("openai-main", NOW - 5 * HOUR)],
    });
    renderScreen();

    await findPrimary(/^Primary: openai-main/);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Rotate" })).not.toHaveAttribute("aria-disabled"),
    );
    await user.click(screen.getByRole("button", { name: "Rotate" }));

    expect(await screen.findByRole("dialog", { name: "Rotate openai-main" })).toBeVisible();
  });

  it("sends Mark done of an Inbox thread", async () => {
    const user = userEvent.setup();
    serve({ inbox: [thread("link_update_a")] });
    vi.mocked(doneInboxItem).mockResolvedValue({} as never);
    renderScreen();

    const primary = await findPrimary();
    expect(within(primary).getByText("Body of link_update_a")).toBeVisible();
    await user.click(await within(primary).findByRole("button", { name: "Mark done" }));

    await waitFor(() => expect(doneInboxItem).toHaveBeenCalledWith("link_update_a", {}));
  });

  it("keeps Discard in More", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    renderScreen();

    const primary = await findPrimary();
    await within(primary).findByRole("button", { name: "Unblock" });
    expect(within(primary).queryByRole("button", { name: "Discard" })).toBeNull();
    await press(user, "Discard");

    expect(await screen.findByRole("alertdialog")).toBeVisible();
  });
});

describe("HomeScreen tool approval", () => {
  it("calls the approve resource once and the card exits", async () => {
    const user = userEvent.setup();
    let waits = true;
    serve({ sessions: [session("workbench_session_A")] });
    vi.mocked(listWorkbenchSessions).mockImplementation(async () =>
      waits ? [session("workbench_session_A")] : [],
    );
    vi.mocked(readWorkbenchEvents).mockResolvedValue({
      entries: [],
      snapshot: {
        streaming_message: null,
        pending_tool_calls: [],
        pending_approval: {
          tool_call_id: "call_1",
          operation_id: "project.create",
          input: { name: "account-recovery" },
        },
        run_active: false,
        error_message: null,
      },
      version: 1,
    });
    vi.mocked(approveWorkbenchCall).mockImplementation(async () => {
      waits = false;
      return { session_id: "workbench_session_A", tool_call_id: "call_1", approved: true };
    });
    renderScreen();

    const primary = await findPrimary(/^Primary: Create the project account-recovery/);
    expect(await within(primary).findByText("name becomes")).toBeVisible();
    await waitFor(() =>
      expect(within(primary).getByRole("button", { name: "Approve" })).toBeEnabled(),
    );
    await user.click(within(primary).getByRole("button", { name: "Approve" }));

    await waitFor(() => expect(approveWorkbenchCall).toHaveBeenCalledTimes(1));
    expect(approveWorkbenchCall).toHaveBeenCalledWith("workbench_session_A", "call_1", true);
    expect(await screen.findByText("All clear")).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /^Primary: / })).toBeNull();
    expect(approveWorkbenchCall).toHaveBeenCalledTimes(1);
  });
});

describe("HomeScreen gated Resume", () => {
  it("shows the need of a gated Resume and moves the cursor to the credential with Go to", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [paused("n_p", "Print the slip")] },
      pages: { "prj-1": [providerStop("e1", "n_p", "unauthorized")] },
      executions: { n_p: [providerStop("e1", "n_p", "unauthorized")] },
      credentials: [llmCredential("openai-main", NOW - 5 * HOUR)],
    });
    renderScreen();

    await findPrimary(/^Primary: openai-main/);
    await user.click(await screen.findByRole("button", { name: "Next ›" }));
    const slip = await findPrimary(/^Primary: Print the slip/);
    await within(slip).findByRole("button", { name: "Go to openai-main" });
    await user.click(within(slip).getByRole("button", { name: /^More/ }));
    const more = await screen.findByRole("dialog", { name: "More acts on Print the slip" });

    expect(within(more).getByRole("button", { name: "Resume" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(more).getByText("Resume needs: Rotate openai-main in Fix setup.")).toBeVisible();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /^More acts/ })).toBeNull());
    await user.click(within(slip).getByRole("button", { name: "Go to openai-main" }));

    const credential = await findPrimary(/^Primary: openai-main/);
    expect(within(credential).getByText("#1")).toBeVisible();
    expect(within(credential).getByText("Provider refuses credential openai-main")).toBeVisible();
  });
});

const GENERAL = "What needs me?";
const BRIEF_TEXT = "Report the system status and the actions that need me.";

function opsSession(
  id: string,
  patch: Partial<WorkbenchSessionListItem> = {},
): WorkbenchSessionListItem {
  return session(id, {
    agent_name: "ops@1",
    first_message: GENERAL,
    run_active: false,
    pending_approval: null,
    ...patch,
  });
}

function pendingApproval() {
  followEvents({
    ...IDLE_SNAPSHOT,
    pending_approval: {
      tool_call_id: "call_1",
      operation_id: "project.create",
      input: { name: "account-recovery" },
    },
    run_active: true,
  });
}

function composerBox() {
  return screen.findByRole("combobox", { name: "Message" });
}

describe("HomeScreen Yumi chat", () => {
  it("makes no API call on New chat, then creates before it sends", async () => {
    const user = userEvent.setup();
    serve({ yumi: "on", sessions: [opsSession("workbench_session_Y1")] });
    vi.mocked(createWorkbenchSession).mockResolvedValue(conversation("workbench_session_Y2", "x"));
    vi.mocked(sendWorkbenchMessage).mockResolvedValue({
      session_id: "workbench_session_Y2",
      run_active: true,
    });
    renderScreen();
    expect(await screen.findByText(GENERAL)).toBeVisible();
    vi.mocked(listWorkbenchSessions).mockClear();
    vi.mocked(readWorkbenchSession).mockClear();

    await user.click(screen.getByRole("button", { name: "New chat" }));

    expect(await screen.findByText(/^Hello, I am Yumi\./)).toBeVisible();
    expect(listWorkbenchSessions).not.toHaveBeenCalled();
    expect(readWorkbenchSession).not.toHaveBeenCalled();
    expect(createWorkbenchSession).not.toHaveBeenCalled();
    expect(sendWorkbenchMessage).not.toHaveBeenCalled();
    await user.type(await composerBox(), "Brief me on atlas");
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => expect(readWorkbenchSession).toHaveBeenCalledWith("workbench_session_Y2"));
    expect(createWorkbenchSession).toHaveBeenCalledTimes(1);
    expect(createWorkbenchSession).toHaveBeenCalledWith({
      agent_name: "ops@1",
      ...YUMI_CONFIGURATION,
    });
    expect(sendWorkbenchMessage).toHaveBeenCalledWith("workbench_session_Y2", "Brief me on atlas");
    expect(vi.mocked(createWorkbenchSession).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(sendWorkbenchMessage).mock.invocationCallOrder[0]!,
    );
  });

  it("opens the newest general ops@1 conversation and none of the others", async () => {
    serve({
      yumi: "on",
      sessions: [
        opsSession("workbench_session_old", { modified: NOW - 5 * HOUR }),
        opsSession("workbench_session_new", { modified: NOW - HOUR }),
        opsSession("workbench_session_case", {
          modified: NOW,
          first_message: "Case: node `n` (Blocked). Explain.",
        }),
      ],
    });

    renderScreen();

    await waitFor(() => expect(readWorkbenchSession).toHaveBeenCalledWith("workbench_session_new"));
    expect(readWorkbenchSession).toHaveBeenCalledTimes(1);
  });

  it("sends the fixed text of a picked /brief once", async () => {
    const user = userEvent.setup();
    serve({ yumi: "on", sessions: [opsSession("workbench_session_Y1")] });
    vi.mocked(sendWorkbenchMessage).mockResolvedValue({
      session_id: "workbench_session_Y1",
      run_active: true,
    });
    renderScreen();

    await user.click(await composerBox());
    await user.click(await screen.findByRole("option", { name: /\/brief/ }));

    await waitFor(() => expect(sendWorkbenchMessage).toHaveBeenCalledTimes(1));
    expect(sendWorkbenchMessage).toHaveBeenCalledWith("workbench_session_Y1", BRIEF_TEXT);
    expect(screen.queryByRole("button", { name: "Brief me" })).toBeNull();
  });

  it("maps /new alone to New chat", async () => {
    const user = userEvent.setup();
    serve({ yumi: "on", sessions: [opsSession("workbench_session_Y1")] });
    renderScreen();
    expect(await screen.findByText(GENERAL, { selector: "div" })).toBeVisible();
    vi.mocked(readWorkbenchSession).mockClear();

    await user.type(await composerBox(), "/new");
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(await screen.findByText(/^Hello, I am Yumi\./)).toBeVisible();
    expect(readWorkbenchSession).not.toHaveBeenCalled();
    expect(sendWorkbenchMessage).not.toHaveBeenCalled();
    expect(createWorkbenchSession).not.toHaveBeenCalled();
  });

  it("renders the deck after the last chat entry and before the composer", async () => {
    serve({
      yumi: "on",
      sessions: [opsSession("workbench_session_Y1")],
      nodes: { "prj-1": [blocked("n_a", "Audit log")] },
    });

    renderScreen();

    const entry = await screen.findByText(GENERAL);
    const deck = await screen.findByRole("region", { name: "Waiting acts" });
    const composer = screen.getByRole("form", { name: "Composer" });
    expect(entry.compareDocumentPosition(deck) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(deck.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Brief me" })).toBeNull();
  });
});

describe("HomeScreen queue line", () => {
  it("shows the approval of the Home conversation as one line that moves the cursor", async () => {
    const user = userEvent.setup();
    serve({
      yumi: "on",
      sessions: [
        opsSession("workbench_session_Y1", {
          run_active: true,
          pending_approval: {
            tool_call_id: "call_1",
            operation_id: "project.create",
          },
        }),
      ],
      nodes: { "prj-1": [blocked("n_a", "Audit log")] },
    });
    pendingApproval();
    renderScreen();

    const line = await screen.findByText(/in your queue\.$/, { selector: "span" });
    expect(line.parentElement).toHaveTextContent(`${GENERAL} is #1 in your queue.`);
    expect(screen.queryByRole("group", { name: "Approval Required" })).toBeNull();
    await user.click(await screen.findByRole("button", { name: "Next ›" }));
    await findPrimary(/^Primary: Audit log/);
    await user.click(screen.getByRole("button", { name: "Show #1 in the deck" }));

    const primary = await findPrimary(new RegExp(`^Primary: ${GENERAL}`));
    expect(within(primary).getByText("#1")).toBeVisible();
    expect(await within(primary).findByRole("button", { name: "Approve" })).toBeVisible();
  });

  it("leaves the chat unchanged for the approval of another conversation", async () => {
    serve({
      yumi: "on",
      sessions: [
        opsSession("workbench_session_Y1"),
        session("workbench_session_A", { modified: NOW - 3 * HOUR }),
      ],
    });

    renderScreen();

    expect(await screen.findByText(GENERAL, { selector: "div" })).toBeVisible();
    const primary = await findPrimary(/^Primary: Create the project account-recovery/);
    expect(await within(primary).findByRole("button", { name: "Approve" })).toBeVisible();
    expect(screen.queryByText(/in your queue\./)).toBeNull();
  });
});

describe("HomeScreen Yumi off", () => {
  it("offers Enable Yumi, a disabled composer and a working deck", async () => {
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });

    renderScreen();

    const link = await screen.findByRole("button", { name: "Enable Yumi" });
    expect(link).toHaveAttribute("href", "/agents/ops%401");
    expect(screen.getByText(/^Yumi is not enabled\./)).toBeVisible();
    const box = screen.getByRole("combobox", { name: "Message" });
    expect(box).toBeDisabled();
    expect(box).toHaveAttribute("placeholder", "Enable Yumi to chat here.");
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "New chat" })).toBeNull();
    const primary = await findPrimary(/^Primary: Audit log/);
    expect(within(primary).getByRole("button", { name: "Unblock" })).toBeVisible();
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.queryByRole("heading", { name: "ops@1" })).toBeNull();
    expect(listWorkbenchSessions).not.toHaveBeenCalledWith("ops@1");
  });
});

describe("HomeScreen missing Yumi configuration", () => {
  it("shows the error line and sends nothing", async () => {
    const user = userEvent.setup();
    serve({ yumi: "unconfigured" });

    renderScreen();

    expect(await screen.findByText(/holds no valid agent provider/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.click(screen.getByRole("combobox", { name: "Message" }));
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(createWorkbenchSession).not.toHaveBeenCalled();
    expect(sendWorkbenchMessage).not.toHaveBeenCalled();
  });
});

describe("HomeScreen Ask Yumi", () => {
  async function openMore(user: ReturnType<typeof userEvent.setup>, primary: HTMLElement) {
    await user.click(within(primary).getByRole("button", { name: /^More/ }));
    return screen.findByRole("dialog", { name: /^More acts on / });
  }

  function waitingNode(): MissionNodeRecord {
    return { ...paused("n_w", "Await a taker"), state: "Waiting" };
  }

  function stuckJob(): SchedulerJob {
    return {
      job_id: "job_1",
      project_id: "prj-1",
      node_id: "n_w",
      priority: 0,
      queued_at: NOW - 5 * HOUR,
    };
  }

  it("sits in More of a blocked card", async () => {
    const user = userEvent.setup();
    serve({ yumi: "on", nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    renderScreen();

    const primary = await findPrimary(/^Primary: Audit log/);

    expect(within(primary).queryByRole("button", { name: "Ask Yumi" })).toBeNull();
    const more = await openMore(user, primary);
    expect(await within(more).findByRole("button", { name: "Ask Yumi" })).toBeVisible();
  });

  it("sits in More of a no_taker card", async () => {
    const user = userEvent.setup();
    serve({
      yumi: "on",
      nodes: { "prj-1": [waitingNode()] },
      jobs: { "prj-1": [stuckJob()] },
      bindings: { "prj-1": [] },
    });
    renderScreen();

    const primary = await findPrimary(/jobs in state Waiting/);

    expect(within(primary).queryByRole("button", { name: "Ask Yumi" })).toBeNull();
    const more = await openMore(user, primary);
    expect(await within(more).findByRole("button", { name: "Ask Yumi" })).toBeVisible();
  });

  it("is the lead act of an environment_failed card", async () => {
    const user = userEvent.setup();
    serve({ yumi: "on", environments: { "prj-1": [failedEnvironment()] } });
    renderScreen();

    const primary = await findPrimary(/^Primary: engine/);

    expect(await within(primary).findByRole("button", { name: "Ask Yumi" })).toBeVisible();
    expect(within(primary).queryByRole("button", { name: "Open project" })).toBeNull();
    const more = await openMore(user, primary);
    expect(within(more).getByRole("button", { name: "Open project" })).toBeVisible();
    expect(within(more).getByRole("button", { name: "Run onboarding again" })).toBeVisible();
  });

  it("leaves an environment_failed card with Open project while Yumi is not enabled", async () => {
    serve({ environments: { "prj-1": [failedEnvironment()] } });
    renderScreen();

    const primary = await findPrimary(/^Primary: engine/);

    expect(within(primary).getByRole("button", { name: "Open project" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Ask Yumi" })).toBeNull();
  });

  it("does not show while Yumi is not enabled", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    renderScreen();

    const more = await openMore(user, await findPrimary(/^Primary: Audit log/));

    expect(within(more).queryByRole("button", { name: "Ask Yumi" })).toBeNull();
  });

  it("does not show on a tool_approval card", async () => {
    serve({
      yumi: "on",
      sessions: [opsSession("workbench_session_Y1"), session("workbench_session_A")],
    });
    vi.mocked(readWorkbenchEvents).mockImplementation(async (id, _after, version) =>
      id === "workbench_session_A"
        ? {
            entries: [],
            snapshot: {
              ...IDLE_SNAPSHOT,
              pending_approval: {
                tool_call_id: "call_1",
                operation_id: "project.create",
                input: { name: "account-recovery" },
              },
            },
            version: 1,
          }
        : version === null
          ? { entries: [], snapshot: IDLE_SNAPSHOT, version: 1 }
          : new Promise(() => undefined),
    );
    renderScreen();

    const primary = await findPrimary(/^Primary: Create the project account-recovery/);

    expect(await within(primary).findByRole("button", { name: "Approve" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Ask Yumi" })).toBeNull();
    const more = within(primary).queryByRole("button", { name: /^More/ });
    if (more !== null) {
      await userEvent.click(more);
      expect(
        within(await screen.findByRole("dialog")).queryByRole("button", { name: "Ask Yumi" }),
      ).toBeNull();
    }
  });

  it("does not show on an Inbox card", async () => {
    serve({ yumi: "on", inbox: [thread("link_update_a")] });
    renderScreen();

    const primary = await findPrimary(/^Primary: /);

    expect(within(primary).getAllByText(/Body of link_update_a/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Ask Yumi" })).toBeNull();
    const more = within(primary).queryByRole("button", { name: /^More/ });
    if (more !== null) {
      await userEvent.click(more);
      expect(
        within(await screen.findByRole("dialog")).queryByRole("button", { name: "Ask Yumi" }),
      ).toBeNull();
    }
  });

  it("sends the case request to a new conversation, not to the Home chat, and keeps the card", async () => {
    const user = userEvent.setup();
    const tab = { closed: false, location: { replace: vi.fn() }, focus: vi.fn(), close: vi.fn() };
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    serve({
      yumi: "on",
      sessions: [opsSession("workbench_session_Y1")],
      nodes: { "prj-1": [blocked("n_case", "Case audit")] },
    });
    vi.mocked(createWorkbenchSession).mockResolvedValue(
      conversation("workbench_session_CASE", "x"),
    );
    vi.mocked(sendWorkbenchMessage).mockResolvedValue({
      session_id: "workbench_session_CASE",
      run_active: true,
    });
    renderScreen();
    const primary = await findPrimary(/^Primary: Case audit/);
    await screen.findByText(GENERAL, { selector: "div" });

    const more = await openMore(user, primary);
    await user.click(await within(more).findByRole("button", { name: "Ask Yumi" }));

    await waitFor(() => expect(sendWorkbenchMessage).toHaveBeenCalledTimes(1));
    expect(open).toHaveBeenCalledWith("", expect.stringMatching(/^kanthord-case-blocked:/));
    expect(createWorkbenchSession).toHaveBeenCalledTimes(1);
    expect(createWorkbenchSession).toHaveBeenCalledWith({
      agent_name: "ops@1",
      ...YUMI_CONFIGURATION,
    });
    const [sessionId, request] = vi.mocked(sendWorkbenchMessage).mock.calls[0]!;
    expect(sessionId).toBe("workbench_session_CASE");
    expect(request).toMatch(/^Case: node `n_case` \(Blocked\)\. /);
    expect(request).not.toContain("Case audit");
    await waitFor(() =>
      expect(tab.location.replace).toHaveBeenCalledWith("/workbench/workbench_session_CASE"),
    );
    await user.keyboard("{Escape}");
    expect(await findPrimary(/^Primary: Case audit/)).toBeVisible();
    open.mockRestore();
  });
});
