import { act, render, screen, waitFor, within } from "@testing-library/react";
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
  checkNode,
  decideFinding,
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
  pauseNode,
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
  listBindings,
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
  queue: [],
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

  it("gives the deck grid one column that the card cannot outgrow", async () => {
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });

    renderScreen();

    const primary = await findPrimary();
    expect(primary.closest(".z-30")?.parentElement).toHaveClass("grid-cols-[minmax(0,1fr)]");
  });

  it("stacks the command list above the deck and picks /brief", async () => {
    const user = userEvent.setup();
    serve({
      yumi: "on",
      sessions: [opsSession("workbench_session_Y1")],
      nodes: { "prj-1": [blocked("n_a", "Audit log")] },
    });
    vi.mocked(sendWorkbenchMessage).mockResolvedValue({
      session_id: "workbench_session_Y1",
      run_active: true,
      queued_message_id: null,
      cleared: [],
    });
    renderScreen();
    const primary = await findPrimary();

    await user.click(await composerBox());
    const list = await screen.findByRole("listbox", { name: "Commands" });

    const deckGrid = primary.closest(".z-30")?.parentElement;
    expect(deckGrid).toHaveClass("isolate");
    expect(deckGrid).not.toContainElement(list);
    expect(deckGrid?.compareDocumentPosition(list)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    await user.click(within(list).getByRole("option", { name: /\/brief/ }));
    await waitFor(() =>
      expect(sendWorkbenchMessage).toHaveBeenCalledWith(expect.any(String), BRIEF_TEXT, "queue"),
    );
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
      await screen.findByText(
        textContent(/Some records could not be read: atlas queue/),
        {},
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
    vi.mocked(listQueueJobs).mockImplementation(async () => []);
    for (const read of [listProjects, readMission, listMissionNodes, listWorkbenchSessions]) {
      vi.mocked(read).mockClear();
    }
    vi.mocked(listQueueJobs).mockClear();
    vi.mocked(listInboxItems).mockClear();

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("All clear", {}, { timeout: 4000 })).toBeInTheDocument();
    expect(listQueueJobs).toHaveBeenCalledTimes(1);
    expect(listQueueJobs).toHaveBeenCalledWith("prj-2");
    expect(listProjects).not.toHaveBeenCalled();
    expect(readMission).not.toHaveBeenCalled();
    expect(listMissionNodes).not.toHaveBeenCalled();
    expect(listWorkbenchSessions).not.toHaveBeenCalled();
    expect(listInboxItems).not.toHaveBeenCalled();
  }, 15_000);

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
        queue: [],
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

function finding(
  nodeId: string,
  label: string,
  name: string,
  source: MissionFinding["source"] = "reviewer",
): MissionFinding {
  return missionFinding({
    id: `finding_${nodeId}_${label}`,
    node_id: nodeId,
    assessment_id: `assessment_${nodeId}`,
    source,
    label,
    name,
    created_at: NOW - HOUR,
  });
}

const GONE_TEXT = "The selected item no longer waits.";

type NodeWorld = Record<string, readonly MissionNodeRecord[]>;

async function confirmWithReason(name: string, reason: string) {
  const user = userEvent.setup();
  const dialog = await screen.findByRole("alertdialog");
  await user.type(within(dialog).getByLabelText("Reason"), reason);
  await user.click(within(dialog).getByRole("button", { name }));
}

async function openFindingSheet(user: ReturnType<typeof userEvent.setup>) {
  await press(user, "Decide");
  return screen.findByRole("dialog", { name: /^Decide findings of / });
}

async function expectDone(line: string) {
  expect(await screen.findByText(line)).toBeVisible();
  expect(screen.queryByText(GONE_TEXT)).toBeNull();
}

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
    queue: [],
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
      queued_message_id: null,
      cleared: [],
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
      queued_message_id: null,
      cleared: [],
    });
    renderScreen();

    await user.click(await composerBox());
    await user.click(await screen.findByRole("option", { name: /\/brief/ }));

    await waitFor(() => expect(sendWorkbenchMessage).toHaveBeenCalledTimes(1));
    expect(sendWorkbenchMessage).toHaveBeenCalledWith("workbench_session_Y1", BRIEF_TEXT, "queue");
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

describe("HomeScreen chat beside the read states", () => {
  it("shows the Yumi chat and the empty state of a server with no project", async () => {
    serve({ yumi: "on", projects: [] });

    renderScreen();

    expect(await composerBox()).toBeVisible();
    expect(await screen.findByText("No projects")).toBeVisible();
  });

  it("shows the Yumi chat and the alert when the project list fails", async () => {
    serve({ yumi: "on" });
    vi.mocked(listProjects).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );

    renderScreen();

    expect(await composerBox()).toBeVisible();
    expect(await screen.findByText("Home could not be read.")).toBeVisible();
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

function offerConversation(targetId: string, operationId: string): WorkbenchSession {
  const base = conversation("workbench_session_Y1", GENERAL);
  return {
    ...base,
    entries: [
      ...base.entries,
      {
        type: "custom",
        id: "entry_offer",
        parentId: null,
        timestamp: "2026-10-05T09:00:01.000Z",
        customType: "kanthord.workbench.record",
        data: {
          kind: "action_offer",
          tool_call_id: "call_offer",
          operation_id: operationId,
          target_id: targetId,
          seen: { state: "Blocked", attempt: 2 },
        },
      },
    ],
  };
}

describe("HomeScreen action card", () => {
  it("shows the queue line of a card whose target holds a deck item and no card", async () => {
    const user = userEvent.setup();
    serve({
      yumi: "on",
      sessions: [opsSession("workbench_session_Y1")],
      nodes: {
        "prj-1": [
          blocked("node_first", "Audit log", { createdAt: NOW - 5 * HOUR }),
          blocked("node_42", "Sign-up form", { createdAt: NOW - HOUR }),
        ],
      },
    });
    vi.mocked(readWorkbenchSession).mockResolvedValue(
      offerConversation("node_42", "mission.node.unblock"),
    );
    renderScreen();

    const line = await screen.findByText(/in your queue\.$/, { selector: "span" });
    expect(line.parentElement).toHaveTextContent("is #2 in your queue.");
    expect(screen.queryByRole("button", { name: "Unblock node_42" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show #2 in the deck" }));

    const primary = await findPrimary(/^Primary: /);
    expect(within(primary).getByText("#2")).toBeVisible();
  });

  it("shows the action card for a target that holds no deck item", async () => {
    serve({
      yumi: "on",
      sessions: [opsSession("workbench_session_Y1")],
      nodes: { "prj-1": [blocked("n_a", "Audit log")] },
    });
    vi.mocked(readWorkbenchSession).mockResolvedValue(
      offerConversation("node_42", "mission.node.unblock"),
    );

    renderScreen();

    expect(await screen.findByRole("button", { name: "Unblock node_42" })).toBeEnabled();
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
      queued_message_id: null,
      cleared: [],
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

describe("HomeScreen settled exit after a decision act", () => {
  it("lets the item leave after Unblock", async () => {
    const user = userEvent.setup();
    const nodes: NodeWorld = { "prj-1": [blocked("n_a", "Audit log")] };
    serve({ nodes });
    vi.mocked(unblockNode).mockImplementation(async () => {
      nodes["prj-1"] = [];
      return {} as MissionControlResult;
    });
    renderScreen();

    const primary = await findPrimary();
    await user.click(await within(primary).findByRole("button", { name: "Unblock" }));
    await confirmWithReason("Unblock node", "Retry.");

    await expectDone("Done: Audit log · 0 items wait");
  });

  it("lets the item leave after Decide of the proposals", async () => {
    const user = userEvent.setup();
    const nodes: NodeWorld = {
      "prj-1": [blocked("n_t", "Team workspaces", { intent: "examine" })],
    };
    serve({
      nodes,
      proposals: { n_t: [proposal("n_t", "Send the invite in the workspace language")] },
    });
    vi.mocked(decideProposals).mockImplementation(async () => {
      nodes["prj-1"] = [];
      return DECIDED;
    });
    renderScreen();

    const primary = await findPrimary();
    await waitFor(() =>
      expect(within(primary).getByRole("button", { name: "Decide" })).toBeEnabled(),
    );
    await user.click(within(primary).getByRole("button", { name: "Decide" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("checkbox", { name: "Send the invite in the workspace language" }),
    );
    await confirmWithReason("Decide", "The fix is right.");

    await expectDone("Done: Team workspaces · 0 items wait");
  });

  it("lets the item leave after Decide of the follow-up proposal", async () => {
    const user = userEvent.setup();
    const followups: Record<string, readonly MissionFollowupProposal[]> = {
      "prj-1": [followup("n_f", 2)],
    };
    serve({ nodes: { "prj-1": [plain("n_f", "Sign-up form", "Completed")] }, followups });
    vi.mocked(decideFollowup).mockImplementation(async () => {
      followups["prj-1"] = [];
      return {};
    });
    renderScreen();

    const primary = await findPrimary();
    await user.click(await within(primary).findByRole("button", { name: "Decide" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Create follow-up node" }));

    await expectDone("Done: Sign-up form · 0 items wait");
  });

  it("lets the item leave after Override", async () => {
    const user = userEvent.setup();
    const nodes: NodeWorld = { "prj-1": [blocked("n_a", "Audit log")] };
    serve({ nodes });
    vi.mocked(overrideNode).mockImplementation(async () => {
      nodes["prj-1"] = [];
      return {} as MissionControlResult;
    });
    renderScreen();

    await findPrimary();
    await press(user, "Override");
    await confirmWithReason("Override node", "Verified by hand.");

    await expectDone("Done: Audit log · 0 items wait");
  });

  it("lets the item leave after Resume", async () => {
    const user = userEvent.setup();
    const nodes: NodeWorld = { "prj-1": [paused("n_p", "Compute the rates", 3)] };
    serve({
      nodes,
      executions: {
        n_p: [ended("e1", "n_p", { claim_state: "lost", ended_at: null, expired_at: NOW - HOUR })],
      },
    });
    vi.mocked(resumeNode).mockImplementation(async () => {
      nodes["prj-1"] = [];
      return {} as MissionControlResult;
    });
    renderScreen();

    const primary = await findPrimary();
    await waitFor(() =>
      expect(within(primary).getByRole("button", { name: "Resume" })).toBeEnabled(),
    );
    await user.click(within(primary).getByRole("button", { name: "Resume" }));
    await confirmWithReason("Resume node", "Try again.");

    await expectDone("Done: Compute the rates · 0 items wait");
  });

  it("lets the item leave after Remove dependency", async () => {
    const user = userEvent.setup();
    const nodes: NodeWorld = {
      "prj-1": [
        pending("n_c", "Redirect the legacy links", ["n_b"]),
        plain("n_b", "Drop the legacy checkout", "Discarded"),
      ],
    };
    serve({ nodes });
    vi.mocked(removeDependency).mockImplementation(async () => {
      nodes["prj-1"] = [plain("n_b", "Drop the legacy checkout", "Discarded")];
      return {} as MissionNodeChange;
    });
    renderScreen();

    const primary = await findPrimary();
    await user.click(
      await within(primary).findByRole("button", {
        name: "Remove dependency on Drop the legacy checkout",
      }),
    );
    await confirmWithReason("Remove dependency", "The checkout is gone.");

    await expectDone("Done: Redirect the legacy links · 0 items wait");
  });

  it("lets the item leave after Discard from More", async () => {
    const user = userEvent.setup();
    const nodes: NodeWorld = { "prj-1": [blocked("n_a", "Audit log")] };
    serve({ nodes });
    vi.mocked(discardNode).mockImplementation(async () => {
      nodes["prj-1"] = [];
      return {} as MissionControlResult;
    });
    renderScreen();

    await findPrimary();
    await press(user, "Discard");
    await confirmWithReason("Discard node", "The feature moves.");

    await expectDone("Done: Audit log · 0 items wait");
  });

  it("lets the item leave after the last decision of a finding", async () => {
    const user = userEvent.setup();
    const findings: Record<string, readonly MissionFinding[]> = {
      "prj-1": [finding("n_s", "S1", "Trim the email")],
    };
    serve({ nodes: { "prj-1": [plain("n_s", "Sign-up form", "Completed")] }, findings });
    vi.mocked(decideFinding).mockImplementation(async (findingId, body) => {
      const decided = (findings["prj-1"] ?? []).find((item) => item.id === findingId);
      if (decided === undefined) throw new Error(`No finding ${findingId}.`);
      findings["prj-1"] = [];
      return { ...decided, decision: body.decision, decision_reason: body.decision_reason };
    });
    renderScreen();

    await findPrimary();
    const sheet = await openFindingSheet(user);
    await user.click(await within(sheet).findByRole("button", { name: "Dismiss the finding S1" }));
    await confirmWithReason("Dismiss", "No defect.");

    await expectDone("Done: Sign-up form · 0 items wait");
    expect(decideFinding).toHaveBeenCalledWith("finding_n_s_S1", {
      decision: "dismissed",
      decision_reason: "No defect.",
    });
  });

  it("keeps the card with the new count after one decision of two findings", async () => {
    const user = userEvent.setup();
    const findings: Record<string, readonly MissionFinding[]> = {
      "prj-1": [
        finding("n_s", "S1", "Trim the email"),
        finding("n_s", "S2", "Submit while pending"),
      ],
    };
    serve({ nodes: { "prj-1": [plain("n_s", "Sign-up form", "Completed")] }, findings });
    vi.mocked(decideFinding).mockImplementation(async (findingId, body) => {
      const decided = (findings["prj-1"] ?? []).find((item) => item.id === findingId);
      if (decided === undefined) throw new Error(`No finding ${findingId}.`);
      findings["prj-1"] = (findings["prj-1"] ?? []).filter((item) => item.id !== findingId);
      return { ...decided, decision: body.decision, decision_reason: body.decision_reason };
    });
    renderScreen();

    await findPrimary();
    const sheet = await openFindingSheet(user);
    await user.click(await within(sheet).findByRole("button", { name: "Dismiss the finding S1" }));
    await confirmWithReason("Dismiss", "No defect.");

    await waitFor(() =>
      expect(within(sheet).queryByRole("button", { name: "Dismiss the finding S1" })).toBeNull(),
    );
    expect(within(sheet).getByRole("button", { name: "Dismiss the finding S2" })).toBeEnabled();
    expect(screen.queryByText(/^Done:/)).toBeNull();
  });
});

describe("HomeScreen Cancel then an outside removal", () => {
  it("shows the gone text after Cancel of Unblock", async () => {
    const user = userEvent.setup();
    const nodes: NodeWorld = { "prj-1": [blocked("n_a", "Audit log")] };
    serve({ nodes });
    renderScreen();

    const primary = await findPrimary();
    await user.click(await within(primary).findByRole("button", { name: "Unblock" }));
    await screen.findByRole("alertdialog");
    nodes["prj-1"] = [];
    await user.click(screen.getByRole("button", { name: "Keep it blocked" }));

    expect(await screen.findByText(GONE_TEXT)).toBeVisible();
    expect(screen.queryByText(/^Done:/)).toBeNull();
  });

  it("shows the gone text after Cancel of Discard", async () => {
    const user = userEvent.setup();
    const nodes: NodeWorld = { "prj-1": [blocked("n_a", "Audit log")] };
    serve({ nodes });
    renderScreen();

    await findPrimary();
    await press(user, "Discard");
    await screen.findByRole("alertdialog");
    nodes["prj-1"] = [];
    await user.click(screen.getByRole("button", { name: "Keep the node" }));

    expect(await screen.findByText(GONE_TEXT)).toBeVisible();
    expect(screen.queryByText(/^Done:/)).toBeNull();
  });

  it("shows the gone text after Cancel of Decide of the follow-up proposal", async () => {
    const user = userEvent.setup();
    const followups: Record<string, readonly MissionFollowupProposal[]> = {
      "prj-1": [followup("n_f", 2)],
    };
    serve({ nodes: { "prj-1": [plain("n_f", "Sign-up form", "Completed")] }, followups });
    renderScreen();

    const primary = await findPrimary();
    await user.click(await within(primary).findByRole("button", { name: "Decide" }));
    await screen.findByRole("alertdialog");
    followups["prj-1"] = [];
    await user.click(screen.getByRole("button", { name: "Keep the proposal" }));

    expect(await screen.findByText(GONE_TEXT)).toBeVisible();
    expect(screen.queryByText(/^Done:/)).toBeNull();
  });
});

describe("HomeScreen Discard flow", () => {
  it("discards after the reason and reads Home again", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-2": [blocked("n_b", "Localize the order email")] } });
    renderScreen();

    await findPrimary();
    await press(user, "Discard");
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
    await waitFor(() => expect(vi.mocked(listMissionNodes).mock.calls.length).toBeGreaterThan(2));
  });
});

describe("HomeScreen review findings", () => {
  it("accepts a finding with the reason in the body", async () => {
    const user = userEvent.setup();
    const target = finding("n_s", "S2", "Submit while pending");
    serve({
      nodes: { "prj-1": [plain("n_s", "Sign-up form", "Completed")] },
      findings: { "prj-1": [target] },
    });
    vi.mocked(decideFinding).mockResolvedValue({ ...target, decision: "accepted" });
    renderScreen();

    await findPrimary();
    const sheet = await openFindingSheet(user);
    await user.click(await within(sheet).findByRole("button", { name: "Accept the finding S2" }));
    await confirmWithReason("Accept", "The next mission adds it.");

    expect(decideFinding).toHaveBeenCalledWith("finding_n_s_S2", {
      decision: "accepted",
      decision_reason: "The next mission adds it.",
    });
  });

  it("names a node with only a human finding Found after delivery", async () => {
    serve({
      nodes: { "prj-1": [plain("n_s", "Sign-up form", "Completed")] },
      findings: { "prj-1": [finding("n_s", "H1", "Duplicate account", "human")] },
    });
    renderScreen();

    const primary = await findPrimary();

    expect(within(primary).getByText(/Found after delivery · 1 finding/)).toBeVisible();
  });
});

describe("HomeScreen retry and polling", () => {
  it("disables Retry while the retry runs", async () => {
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
    let finish: () => void = () => undefined;
    vi.mocked(listQueueJobs).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve([]);
        }),
    );

    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
    await act(async () => finish());
    expect(await screen.findByText("All clear")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("holds the poll while a dialog is open and reads at once after it closes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    serve({ nodes: { "prj-1": [blocked("n_a", "First item")] } });
    renderScreen();

    await findPrimary();
    await press(user, "Discard");
    await screen.findByRole("alertdialog");
    const reads = vi.mocked(listProjects).mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    expect(vi.mocked(listProjects).mock.calls.length).toBe(reads);
    await user.click(screen.getByRole("button", { name: "Keep the node" }));

    await waitFor(() => expect(vi.mocked(listProjects).mock.calls.length).toBeGreaterThan(reads));
  });

  it("reads Home again every 15 s while no dialog is open", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    serve({ nodes: { "prj-1": [blocked("n_a", "First item")] } });
    renderScreen();
    await findPrimary();
    const reads = vi.mocked(listProjects).mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_100);
    });

    expect(vi.mocked(listProjects).mock.calls.length).toBeGreaterThan(reads);
  });
});

describe("HomeScreen Inbox acts", () => {
  const RUN = plain("n_run", "Running node", "Executing");
  const DONE = plain("n_done", "Finished node", "Completed");
  const IDLE = plain("n_idle", "Idle node", "Discarded");

  function openWorld(inbox: InboxItem[], extra: Partial<Parameters<typeof serve>[0]> = {}) {
    serve({ inbox, nodes: { "prj-1": [RUN, DONE, IDLE] }, ...extra });
  }

  function removeOnDone(inbox: InboxItem[], state: InboxItem["state"] = "done") {
    vi.mocked(doneInboxItem).mockImplementation(async (id) => {
      const at = inbox.findIndex((entry) => entry.link_update_id === id);
      const [item] = inbox.splice(at, 1);
      if (item === undefined) throw new Error("No item.");
      return { ...item, state };
    });
  }

  it("loads every page of the Inbox into the deck", async () => {
    serve({
      inbox: [
        thread("link_update_a", { occurred_at: NOW - 3 * HOUR }),
        thread("link_update_b", { occurred_at: NOW - 2 * HOUR }),
        thread("link_update_c", { occurred_at: NOW - HOUR }),
      ],
      inboxPage: 1,
    });

    renderScreen();

    await findPrimary();
    expect(await screen.findByText(/^1 of 3 waiting/)).toBeVisible();
    expect(listInboxItems).toHaveBeenCalledTimes(3);
  });

  it("sends the local time of Tomorrow 08:00 with Snooze", async () => {
    const user = userEvent.setup();
    const inbox = [thread("link_update_a")];
    openWorld(inbox);
    removeOnDone(inbox, "snoozed");
    renderScreen();
    const tomorrow = new Date();
    const expected = new Date(
      tomorrow.getFullYear(),
      tomorrow.getMonth(),
      tomorrow.getDate() + 1,
      8,
    ).getTime();

    await findPrimary(/^Primary: acme\/shop#42/);
    await press(user, "Snooze");
    const dialog = await screen.findByRole("dialog", { name: /Snooze/ });
    expect(within(dialog).getByRole("button", { name: "In 3 hours" })).toBeVisible();
    await user.click(within(dialog).getByRole("button", { name: "Tomorrow 08:00" }));

    await waitFor(() =>
      expect(doneInboxItem).toHaveBeenCalledWith("link_update_a", { snoozed_until: expected }),
    );
    await expectDone("Done: acme/shop#42 · 0 items wait");
  });

  it("keeps the card and says that a new update arrived when the answer is open", async () => {
    const user = userEvent.setup();
    const inbox = [thread("link_update_a")];
    openWorld(inbox);
    vi.mocked(doneInboxItem).mockResolvedValue({ ...(inbox[0] as InboxItem), state: "open" });
    renderScreen();

    const primary = await findPrimary(/^Primary: acme\/shop#42/);
    await user.click(await within(primary).findByRole("button", { name: "Mark done" }));

    expect(await within(primary).findByText("A new update arrived.")).toBeVisible();
    expect(within(primary).getByRole("button", { name: "Mark done" })).toBeVisible();
    expect(screen.queryByText(/^Done:/)).toBeNull();
  });

  it("shows the failure of Mark done and keeps the card", async () => {
    const user = userEvent.setup();
    openWorld([thread("link_update_a")]);
    vi.mocked(doneInboxItem).mockRejectedValue(
      new ApiError("not_found", "No such inbox item.", 404, "mission.inbox_item.not_found"),
    );
    renderScreen();

    const primary = await findPrimary(/^Primary: acme\/shop#42/);
    await user.click(await within(primary).findByRole("button", { name: "Mark done" }));

    expect(await within(primary).findByRole("alert")).toHaveTextContent("No such inbox item.");
    expect(within(primary).getByRole("button", { name: "Mark done" })).toBeVisible();
    expect(screen.queryByText(/^Done:/)).toBeNull();
  });

  it("offers Pause for a running linked node only and pauses it with a reason", async () => {
    const user = userEvent.setup();
    openWorld([thread("link_update_a", { linked_node_ids: ["n_run", "n_done", "n_idle"] })]);
    vi.mocked(pauseNode).mockResolvedValue({} as MissionControlResult);
    renderScreen();

    await findPrimary(/^Primary: acme\/shop#42/);
    await user.click(await screen.findByRole("button", { name: /^More/ }));
    const more = await screen.findByRole("dialog", { name: /^More acts on / });
    expect(within(more).getAllByRole("button", { name: /^Pause / })).toHaveLength(1);
    await user.click(within(more).getByRole("button", { name: "Pause Running node" }));
    await confirmWithReason("Pause node", "Hold the work.");

    await waitFor(() =>
      expect(pauseNode).toHaveBeenCalledWith("n_run", {
        reason: "Hold the work.",
        expected_mission_version: 7,
        expected_state: "Executing",
        expected_attempt: 1,
      }),
    );
  });

  it("checks a linked node with Check now", async () => {
    const user = userEvent.setup();
    openWorld([thread("link_update_a", { linked_node_ids: ["n_done"] })]);
    vi.mocked(checkNode).mockResolvedValue({ results: [], failures: [], link_updates: [] });
    renderScreen();

    await findPrimary(/^Primary: acme\/shop#42/);
    await press(user, "Check now");

    await waitFor(() =>
      expect(checkNode).toHaveBeenCalledWith("n_done", { expected_mission_version: 7 }),
    );
  });

  it("moves the cursor to the follow-up card of a linked node with Decide follow-up", async () => {
    const user = userEvent.setup();
    openWorld([thread("link_update_a", { linked_node_ids: ["n_done"] })], {
      followups: { "prj-1": [followup("n_done", 2)] },
    });
    renderScreen();

    await findPrimary(/^Primary: Finished node/);
    await user.click(await screen.findByRole("button", { name: "Next ›" }));
    await findPrimary(/^Primary: acme\/shop#42/);
    await press(user, "Decide follow-up");

    const card = await findPrimary(/^Primary: Finished node/);
    expect(within(card).getByText("#1")).toBeVisible();
  });

  it("opens Create node with the conversation binding preselected", async () => {
    const user = userEvent.setup();
    openWorld([thread("link_update_a")]);
    vi.mocked(listBindings).mockResolvedValue([
      {
        id: "binding_chat",
        project_id: "prj-1",
        name: "shop-github",
        kind: "conversation",
        resource_identity: "conversation:github:acme/shop",
        revision: 1,
        config: {},
        created_at: 1,
        removed_at: null,
      },
    ]);
    renderScreen();

    await findPrimary(/^Primary: acme\/shop#42/);
    await press(user, "Create node");

    const dialog = await screen.findByRole("dialog", { name: "Create node" });
    expect(within(dialog).getByText("Body of link_update_a")).toBeVisible();
    await waitFor(() =>
      expect(within(dialog).getByRole("checkbox", { name: /shop-github/ })).toBeChecked(),
    );
    expect(within(dialog).getByLabelText("Requirement")).toHaveValue("");
  });

  it("opens Link to node with the open nodes of the project", async () => {
    const user = userEvent.setup();
    openWorld([thread("link_update_a")]);
    vi.mocked(listBindings).mockResolvedValue([]);
    renderScreen();

    await findPrimary(/^Primary: acme\/shop#42/);
    await press(user, "Link to node");

    const dialog = await screen.findByRole("dialog", { name: /Link acme\/shop#42 to a node/ });
    expect(within(dialog).getAllByRole("radio")).toHaveLength(1);
    expect(within(dialog).getByRole("radio", { name: /Running node/ })).toBeVisible();
  });
});
