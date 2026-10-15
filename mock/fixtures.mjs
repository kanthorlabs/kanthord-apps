const now = Date.now();

export const PROJECT = {
  id: "prj-kanthord",
  name: "kanthord",
  binding_set_version: 1,
  created_at: now,
  paused_at: null,
  workspace_directory: "/home/kanthord/.local/state/kanthord/projects/prj-kanthord",
};

export const PROJECT_ATLAS = {
  id: "prj-atlas",
  name: "atlas",
  binding_set_version: 1,
  created_at: now,
  paused_at: null,
  workspace_directory: "/home/kanthord/.local/state/kanthord/projects/prj-atlas",
};

const BASE_PROMPT = `You are a senior software engineer.

## Principles

1. **Think before you act.** Investigate the evidence first.`;

const TOOL_INPUT = { type: "object" };

export const WORKBENCH_PROMPT = `You work in a workbench session with a human.
Answer in the language of the human and keep each answer short.`;

export const PROMPT_SWITCHES = {
  system: ["host_file", "base", "custom", "layer"],
  agent: ["agent_file", "shipped", "custom"],
  workbench: ["agents_md", "agents_local_md", "claude_md", "claude_local_md", "shipped", "custom"],
};

const AGENT_CONFIGURATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["agent_provider", "provider", "credential", "model_identifier", "reasoning_effort"],
};

export const WORKER_CATALOG = [
  {
    name: "coder@1",
    host: "kanthord",
    declared_node_states: ["Available"],
    required_node_format: ["objective"],
  },
  {
    name: "reviewer@1",
    host: "kanthord",
    declared_node_states: ["Waiting", "External.Requested"],
    required_node_format: ["objective"],
  },
];

export const RELEASED_WORKERS = ["coder@1", "reviewer@1"];

export const WORKER_INSTANCES = [
  {
    runtime_identity: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0A01",
    project_id: PROJECT.id,
    resource_identity: "worker:kanthord:general-main",
    worker_name: "coder@1",
    host: "kanthord",
    placement: "server",
    activity: "executing",
    draining: false,
    execution_id: "execution_01J9ZQ4XKM3B6V8N2R5T7W0E01",
    registered: true,
  },
  {
    runtime_identity: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0A02",
    project_id: PROJECT.id,
    resource_identity: "worker:kanthord:reviewer-main",
    worker_name: "reviewer@1",
    host: "kanthord",
    placement: "worker",
    activity: "idle",
    draining: true,
    registered: true,
  },
  {
    runtime_identity: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0A03",
    project_id: PROJECT_ATLAS.id,
    resource_identity: "worker:kanthord:general-main",
    worker_name: "coder@1",
    host: "kanthord",
    placement: "server",
    activity: "executing",
    draining: false,
    execution_id: "execution_01J9ZQ4XKM3B6V8N2R5T7W0AF2",
    registered: true,
  },
];

export const AGENT_DECLARATIONS = [
  {
    agent_name: "re@1",
    worker_names: ["reviewer@1"],
    configuration_schema: AGENT_CONFIGURATION_SCHEMA,
    overridable_fields: ["agent_provider", "model_identifier", "reasoning_effort"],
    enablement: null,
    basePrompt: BASE_PROMPT,
    agentPrompt: `## Role

Your role is \`re@1\`, the reviewer.
Your responsibility is the assessment of a node.
Judge the evidence against the criterion of the node and the default standard.
Change no file of the repository.`,
    tools: ["read", "grep", "find", "ls"].map((name) => ({
      name,
      source: "builtin",
      input_schema: TOOL_INPUT,
    })),
  },
  {
    agent_name: "swe@1",
    worker_names: ["coder@1"],
    configuration_schema: AGENT_CONFIGURATION_SCHEMA,
    overridable_fields: ["agent_provider", "model_identifier", "reasoning_effort"],
    enablement: {
      agent_name: "swe@1",
      state: "enabled",
      agent_providers: [
        { name: "atlas-llm", provider: "openai-compatible", credential: "atlas-router" },
        { name: "openai-org", provider: "openai-compatible", credential: "openai-main" },
      ],
      default_configuration: {
        agent_provider: "atlas-llm",
        model_identifier: "qwen3-coder",
        reasoning_effort: "off",
      },
      fallback_configurations: [],
      revision: 2,
    },
    basePrompt: BASE_PROMPT,
    agentPrompt: `## Role

Your role is \`swe@1\`, the software engineer that performs the steps of a task.
Your responsibility is the change that the task describes, in the workspace, to the default standard.`,
    tools: [
      ...["read", "edit", "write", "grep", "find", "ls", "bash"].map((name) => ({
        name,
        source: "builtin",
        input_schema: TOOL_INPUT,
      })),
      { name: "evidence-upload", source: "host", input_schema: TOOL_INPUT },
    ],
  },
];

export const AGENT_PROVIDER_MODELS = {
  "atlas-router": [
    { model_identifier: "qwen3-coder", reasoning_efforts: ["off", "low", "high"] },
    { model_identifier: "glm-4.6", reasoning_efforts: ["off"] },
  ],
  "openai-main": [
    { model_identifier: "gpt-5", reasoning_efforts: ["off", "minimal", "low", "medium", "high"] },
    { model_identifier: "gpt-5-mini", reasoning_efforts: ["off", "low"] },
  ],
};

export const AGENT_KIND_MODELS = {
  anthropic: [
    {
      model_identifier: "claude-sonnet-4-5",
      reasoning_efforts: ["off", "minimal", "low", "medium", "high"],
    },
    { model_identifier: "claude-haiku-4-5", reasoning_efforts: ["off", "low"] },
  ],
  "anthropic-subscription": [
    { model_identifier: "claude-haiku-5-5", reasoning_efforts: ["off", "low"] },
    {
      model_identifier: "claude-sonnet-5-5",
      reasoning_efforts: ["off", "minimal", "low", "medium", "high"],
    },
    {
      model_identifier: "claude-opus-5-5",
      reasoning_efforts: ["off", "minimal", "low", "medium", "high", "xhigh"],
    },
    { model_identifier: "claude-fable-5-1", reasoning_efforts: ["off", "low", "medium", "high"] },
  ],
  "github-copilot": [{ model_identifier: "gpt-5", reasoning_efforts: ["off", "low", "high"] }],
  "openai-codex": [
    { model_identifier: "gpt-5-codex", reasoning_efforts: ["low", "medium", "high"] },
  ],
  openrouter: [{ model_identifier: "qwen/qwen3-coder", reasoning_efforts: ["off"] }],
};

export const MISSION = {
  id: "mission_01J9ZQ4XKM3B6V8N2R5T7W0YM1",
  version: 3,
};

export const MISSION_ENTRIES = [
  {
    filename: "onboarding.md",
    id: "node_01J9ZQ4XKM3B6V8N2R5T7W0YA1",
    kind: "initiative",
    name: "Onboarding",
    requirement: "A new account reaches a usable workspace.",
    criterion: "A new account reaches the workspace in one session.",
    verifications: ["pnpm test"],
    bindings: ["kanthord-repo", "evidence"],
  },
  {
    filename: "reset-email.md",
    id: "node_01J9ZQ4XKM3B6V8N2R5T7W0YA2",
    kind: "objective",
    name: "Add password reset",
    requirement: "A human resets a forgotten password by email.",
    criterion: "The reset link signs the human in once.",
    verifications: ["pnpm test --filter reset"],
    bindings: ["kanthord-repo", "general-main", "reviewer-main", "evidence"],
    parent: "onboarding.md",
  },
  {
    filename: "reset-expiry.md",
    id: "node_01J9ZQ4XKM3B6V8N2R5T7W0YA3",
    kind: "task",
    name: "Add reset token expiry",
    requirement: "A reset token expires after 30 minutes.",
    criterion: "An expired token refuses the reset.",
    verifications: ["pnpm test --filter expiry"],
    bindings: [],
    parent: "reset-email.md",
  },
];

export const BINDING_SET = {
  version: 2,
  bindings: {
    "kanthord-repo": {
      kind: "repository",
      config: {
        available: true,
        platform: "github",
        address: "git@github.com:kanthorlabs/kanthord.git",
        strategy: {
          base_branch: "main",
          action: { name: "pull_request", follows: { type: "assessment_passed" } },
        },
        ssh_credential: "atlas-ssh",
        credential: "atlas-github",
        working_layer: {
          agents_md: true,
          agents_local_md: true,
          claude_md: true,
          claude_local_md: true,
          project_prompt: true,
        },
      },
    },
    "general-main": {
      kind: "worker",
      config: {
        worker: "coder@1",
        instance_count: 2,
        resource_budget: { turns: 200, wall_time_ms: 7200000 },
        entries: [{ agent: "swe@1", reasoning_effort: "high" }],
      },
    },
    "reviewer-main": {
      kind: "worker",
      config: { worker: "reviewer@1", instance_count: 1 },
    },
    evidence: {
      kind: "storage",
      config: {
        available: true,
        endpoint: "https://s3.eu-central-1.amazonaws.com",
        bucket: "kanthord-evidence",
        region: "eu-central-1",
        prefix: "kanthord/",
        credential: "atlas-evidence",
      },
    },
  },
};

const minutes = (count) => now - count * 60_000;

const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ulidAt = (ms, tail) => {
  let rest = ms;
  let time = "";
  for (let i = 0; i < 10; i += 1) {
    time = ULID_ALPHABET.charAt(rest % 32) + time;
    rest = Math.floor(rest / 32);
  }
  return `${time}${tail.padStart(16, "0")}`;
};
const graphId = (suffix) => `node_01J9ZQ4XKM3B6V8N2R5T7W0${suffix}`;
const commitOf = (seed) => seed.repeat(40).slice(0, 40);

export const GRAPH_BINDINGS = {
  repositoryOld: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BR1",
    name: "kanthord-repo",
    kind: "repository",
    resource_identity: "repository:github:kanthorlabs/kanthord",
    revision: 1,
    created_at: minutes(9000),
    removed_at: null,
  },
  repository: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BR2",
    name: "kanthord-repo",
    kind: "repository",
    resource_identity: "repository:github:kanthorlabs/kanthord",
    revision: 2,
    created_at: minutes(3000),
    removed_at: null,
  },
  storage: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BS1",
    name: "evidence",
    kind: "storage",
    resource_identity: "storage:s3:s3.eu-central-1.amazonaws.com/kanthord-evidence",
    revision: 1,
    created_at: minutes(9000),
    removed_at: null,
  },
  worker: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BW1",
    name: "general-main",
    kind: "worker",
    resource_identity: "worker:kanthord:general-main",
    revision: 1,
    created_at: minutes(9000),
    removed_at: null,
  },
  reviewer: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BW2",
    name: "reviewer-main",
    kind: "worker",
    resource_identity: "worker:kanthord:reviewer-main",
    revision: 1,
    created_at: minutes(9000),
    removed_at: null,
  },
};

const REPO = GRAPH_BINDINGS.repository.id;
const REPO_OLD = GRAPH_BINDINGS.repositoryOld.id;
const STORAGE = GRAPH_BINDINGS.storage.id;

const content = (name, bindings, extra = {}) => ({
  name,
  requirement: `${name}: the requirement that the plan file states.`,
  criterion: `${name}: the criterion that a reviewer checks.`,
  verifications: ["pnpm test", "pnpm lint"],
  bindings,
  ...extra,
});

const graphNode = (suffix, kind, filename, parentId, nodeContent, runtime) => ({
  id: graphId(suffix),
  filename,
  mission_id: "mission_01J9ZQ4XKM3B6V8N2R5T7W0YM1",
  kind,
  parent_id: parentId,
  visible_revision: runtime?.visible_revision ?? 1,
  content: nodeContent,
  retired_at: null,
  pinned_by_attempts: runtime?.pinned_by_attempts ?? [],
  ...(kind === "task"
    ? {}
    : { state: runtime.state, attempt: runtime.attempt, priority: runtime.priority ?? 0 }),
});

export const GRAPH_IDS = {
  onboarding: graphId("YA1"),
  reset: graphId("YA2"),
  expiry: graphId("YA3"),
  recovery: graphId("YB1"),
  billing: graphId("YC1"),
  signup: graphId("YA4"),
  verify: graphId("YA5"),
  codes: graphId("YB2"),
  audit: graphId("YB3"),
  mail: graphId("YB4"),
  webhook: graphId("YC2"),
  invoices: graphId("YC3"),
  metering: graphId("YC4"),
  team: graphId("YD1"),
  invite: graphId("YD2"),
  inviteFix: graphId("YD3"),
  inviteFixTask: graphId("YD4"),
};

const ids = GRAPH_IDS;

export const GRAPH_NODES = [
  graphNode("YA1", "initiative", "onboarding.md", null, content("Onboarding", [STORAGE]), {
    state: "Completed",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  graphNode("YB1", "initiative", "account-recovery.md", null, content("Account recovery", []), {
    state: "Available",
    attempt: 0,
  }),
  graphNode("YC1", "initiative", "billing.md", null, content("Billing", []), {
    state: "Available",
    attempt: 0,
    priority: 5,
  }),
  graphNode("YA4", "objective", "signup-form.md", ids.onboarding, content("Sign-up form", [REPO]), {
    state: "Completed",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  graphNode(
    "YA5",
    "objective",
    "email-verification.md",
    ids.onboarding,
    content("Email verification", [REPO]),
    { state: "Completed", attempt: 1, pinned_by_attempts: [1] },
  ),
  graphNode(
    "YB2",
    "objective",
    "recovery-codes.md",
    ids.recovery,
    content("Add recovery codes", [REPO]),
    {
      state: "Executing",
      attempt: 1,
      pinned_by_attempts: [1],
    },
  ),
  graphNode(
    "YA2",
    "objective",
    "reset-email.md",
    ids.recovery,
    content("Add password reset", [REPO, STORAGE]),
    {
      state: "Pending",
      attempt: 0,
      priority: 2,
    },
  ),
  graphNode("YA3", "task", "reset-expiry.md", ids.reset, content("Add reset token expiry", [])),
  graphNode("YB4", "task", "reset-mail.md", ids.reset, content("Send the reset email", [])),
  graphNode(
    "YB3",
    "objective",
    "audit-log.md",
    ids.recovery,
    content("Audit log for account changes", [REPO], {
      criterion: "Every account change writes one audit entry with the actor and the time.",
    }),
    { state: "Blocked", attempt: 1, pinned_by_attempts: [1], visible_revision: 2 },
  ),
  graphNode(
    "YC2",
    "objective",
    "stripe-webhook.md",
    ids.billing,
    content("Stripe webhook", [REPO]),
    {
      state: "External.Requested",
      attempt: 1,
      pinned_by_attempts: [1],
    },
  ),
  graphNode("YC3", "objective", "invoices-page.md", ids.billing, content("Invoices page", [REPO]), {
    state: "Waiting",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  graphNode(
    "YC4",
    "objective",
    "usage-metering.md",
    ids.billing,
    content("Meter the usage of every workspace and report it to the billing provider each night", [
      REPO,
    ]),
    { state: "Pending", attempt: 0 },
  ),
  graphNode("YD1", "initiative", "team-workspaces.md", null, content("Team workspaces", []), {
    state: "Blocked",
    attempt: 2,
    pinned_by_attempts: [2],
  }),
  graphNode("YD2", "objective", "invite-members.md", ids.team, content("Invite members", [REPO]), {
    state: "Completed",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  graphNode(
    "YD3",
    "objective",
    "proposal-01j9zq4xkm3b6v8n2r5t7w0pd1.md",
    ids.team,
    content("Expire an invite link after its first use", [REPO]),
    { state: "Completed", attempt: 1, pinned_by_attempts: [1] },
  ),
  graphNode(
    "YD4",
    "task",
    "proposal-01j9zq4xkm3b6v8n2r5t7w0pd1-task.md",
    ids.inviteFix,
    content("Mark the invite link used", []),
  ),
];

export const GRAPH_EDGES = [
  { kind: "dependency", dependent_id: ids.recovery, depends_on_id: ids.onboarding },
  { kind: "dependency", dependent_id: ids.verify, depends_on_id: ids.signup },
  { kind: "dependency", dependent_id: ids.reset, depends_on_id: ids.codes },
  { kind: "dependency", dependent_id: ids.audit, depends_on_id: ids.signup },
  { kind: "dependency", dependent_id: ids.metering, depends_on_id: ids.webhook },
  ...GRAPH_NODES.filter((node) => node.parent_id !== null).map((node) => ({
    kind: "containment",
    parent_id: node.parent_id,
    child_id: node.id,
  })),
];

const human = { kind: "human", account: "kanthorlabs", name: "Kanthor Labs" };
const execution = (suffix, name) => ({
  kind: "execution",
  execution_id: `execution_01J9ZQ4XKM3B6V8N2R5T7W0${suffix}`,
  client_id: null,
  name,
});

const pullRequest = (key, bindingId) => ({
  key,
  binding_id: bindingId,
  action: "pull_request",
  expected_end_state: "pull_request_merged",
  follows: null,
  configuration: { base_branch: "main" },
});

export const GRAPH_ATTEMPTS = {
  [ids.onboarding]: [
    {
      node_id: ids.onboarding,
      attempt: 1,
      node_revision: 1,
      start_point: "base_branch",
      required_external_actions: [],
      opened_at: minutes(4000),
      closed_at: minutes(3900),
      outcome_ids: ["outcome_01J9ZQ4XKM3B6V8N2R5T7W0OA1"],
      opened_by: execution("EA1", "reviewer-main #1"),
    },
  ],
  [ids.signup]: [
    {
      node_id: ids.signup,
      attempt: 1,
      node_revision: 1,
      start_point: "base_branch",
      required_external_actions: [pullRequest("kanthord-repo.pull_request", REPO_OLD)],
      opened_at: minutes(6000),
      closed_at: minutes(5000),
      outcome_ids: ["outcome_01J9ZQ4XKM3B6V8N2R5T7W0OS1"],
      opened_by: execution("ES1", "general-main #1"),
    },
  ],
  [ids.audit]: [
    {
      node_id: ids.audit,
      attempt: 1,
      node_revision: 1,
      start_point: "base_branch",
      required_external_actions: [pullRequest("kanthord-repo.pull_request", REPO_OLD)],
      opened_at: minutes(400),
      closed_at: minutes(120),
      outcome_ids: ["outcome_01J9ZQ4XKM3B6V8N2R5T7W0OB3"],
      opened_by: execution("EB3", "general-main #2"),
    },
  ],
  [ids.codes]: [
    {
      node_id: ids.codes,
      attempt: 1,
      node_revision: 1,
      start_point: "base_branch",
      required_external_actions: [pullRequest("kanthord-repo.pull_request", REPO)],
      opened_at: minutes(30),
      closed_at: null,
      outcome_ids: [],
      opened_by: execution("EB2", "general-main #1"),
    },
  ],
  [ids.webhook]: [
    {
      node_id: ids.webhook,
      attempt: 1,
      node_revision: 1,
      start_point: "base_branch",
      required_external_actions: [pullRequest("kanthord-repo.pull_request", REPO)],
      opened_at: minutes(300),
      closed_at: null,
      outcome_ids: [],
      opened_by: human,
    },
  ],
  [ids.invoices]: [
    {
      node_id: ids.invoices,
      attempt: 1,
      node_revision: 1,
      start_point: "base_branch",
      required_external_actions: [pullRequest("kanthord-repo.pull_request", REPO)],
      opened_at: minutes(200),
      closed_at: null,
      outcome_ids: [],
      opened_by: execution("EC3", "general-main #2"),
    },
  ],
  [ids.team]: [1, 2].map((attempt) => ({
    node_id: ids.team,
    attempt,
    node_revision: 1,
    start_point: attempt === 1 ? "base_branch" : "node_branch",
    required_external_actions: [],
    opened_at: minutes(attempt === 1 ? 1800 : 1400),
    closed_at: minutes(attempt === 1 ? 1600 : 90),
    outcome_ids: attempt === 1 ? [] : ["outcome_01J9ZQ4XKM3B6V8N2R5T7W0OD1"],
    opened_by: execution("ED9", "reviewer-main #1"),
  })),
  [ids.verify]: [
    {
      node_id: ids.verify,
      attempt: 1,
      node_revision: 1,
      start_point: "base_branch",
      required_external_actions: [],
      opened_at: minutes(4800),
      closed_at: minutes(4200),
      outcome_ids: [],
      opened_by: execution("EA5", "general-main #1"),
    },
  ],
};

const verification = (bindingId, seed, exitCodes) => ({
  tested_input: { kind: "repository", binding_id: bindingId, commit: commitOf(seed) },
  results: ["pnpm test", "pnpm lint"].map((command, index) => ({
    command,
    exit_code: exitCodes[index] ?? null,
    signal: null,
    timed_out: false,
  })),
});

const repositoryAsset = (suffix, bindingId, seed) => ({
  id: `evidence_asset_01J9ZQ4XKM3B6V8N2R5T7W0${suffix}`,
  kind: "repository",
  address: { kind: "repository", binding_id: bindingId, commit: commitOf(seed) },
  published_at: minutes(100),
  expired_at: null,
});

export const GRAPH_EVIDENCE = [
  {
    id: "evidence_01J9ZQ4XKM3B6V8N2R5T7W0VB3",
    node_id: ids.audit,
    attempt: 1,
    subject: "Audit log writer and its migration",
    assets: [repositoryAsset("AB3", REPO_OLD, "b3")],
    provenance: execution("EB3", "general-main #2"),
    created_at: minutes(200),
    verification: verification(REPO_OLD, "b3", [0, 1]),
  },
  {
    id: "evidence_01J9ZQ4XKM3B6V8N2R5T7W0VS1",
    node_id: ids.signup,
    attempt: 1,
    subject: "Sign-up form with validation",
    assets: [repositoryAsset("AS1", REPO_OLD, "a4")],
    provenance: execution("ES1", "general-main #1"),
    created_at: minutes(5500),
    verification: verification(REPO_OLD, "a4", [0, 0]),
  },
  {
    id: "evidence_01J9ZQ4XKM3B6V8N2R5T7W0VC2",
    node_id: ids.webhook,
    attempt: 1,
    subject: "Webhook handler for invoice events",
    assets: [repositoryAsset("AC2", REPO, "c2")],
    provenance: execution("EC2", "general-main #1"),
    created_at: minutes(260),
    verification: verification(REPO, "c2", [0, 0]),
  },
  {
    id: "evidence_01J9ZQ4XKM3B6V8N2R5T7W0RC2",
    node_id: ids.webhook,
    attempt: 1,
    subject: "Pull request for the webhook handler",
    assets: [
      {
        id: "evidence_asset_01J9ZQ4XKM3B6V8N2R5T7W0PC2",
        kind: "platform",
        address: {
          kind: "pull_request",
          resource_identity: "repository:github:kanthorlabs/kanthord",
          number: 142,
        },
        published_at: minutes(240),
        expired_at: null,
      },
    ],
    provenance: execution("EC9", "reviewer-main #1"),
    created_at: minutes(240),
    requirement_key: "kanthord-repo.pull_request",
  },
];

export const GRAPH_ASSESSMENTS = [
  {
    id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SB3",
    node_id: ids.audit,
    execution_id: "execution_01J9ZQ4XKM3B6V8N2R5T7W0EB9",
    attempt: 1,
    node_revision: 1,
    evidence_ids: ["evidence_01J9ZQ4XKM3B6V8N2R5T7W0VB3"],
    child_outcome_ids: [],
    result: "criterion-not-met",
    rationale: "The verification pnpm lint exits 1. The audit entry holds no actor.",
    tested_input: { kind: "repository", binding_id: REPO_OLD, commit: commitOf("b3") },
    actor: execution("EB9", "reviewer-main #1"),
    created_at: minutes(125),
    currency: {
      current: true,
      context_matches: true,
      authority_admits: true,
      order_selected: true,
      reasons: [],
    },
    child_node_ids: [],
    worker_version: "reviewer@1",
  },
  {
    id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SS1",
    node_id: ids.signup,
    execution_id: "execution_01J9ZQ4XKM3B6V8N2R5T7W0ES9",
    attempt: 1,
    node_revision: 1,
    evidence_ids: ["evidence_01J9ZQ4XKM3B6V8N2R5T7W0VS1"],
    child_outcome_ids: [],
    result: "success",
    rationale: "Every verification exits 0, and the form meets the criterion.",
    tested_input: { kind: "repository", binding_id: REPO_OLD, commit: commitOf("a4") },
    actor: execution("ES9", "reviewer-main #1"),
    created_at: minutes(5100),
    currency: null,
    child_node_ids: [],
    worker_version: "reviewer@1",
  },
  {
    id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SC2",
    node_id: ids.webhook,
    execution_id: "execution_01J9ZQ4XKM3B6V8N2R5T7W0EC9",
    attempt: 1,
    node_revision: 1,
    evidence_ids: ["evidence_01J9ZQ4XKM3B6V8N2R5T7W0VC2"],
    child_outcome_ids: [],
    result: "success",
    rationale: "Every verification exits 0. The pull request waits for its merge.",
    tested_input: { kind: "repository", binding_id: REPO, commit: commitOf("c2") },
    actor: execution("EC9", "reviewer-main #1"),
    created_at: minutes(245),
    currency: {
      current: true,
      context_matches: true,
      authority_admits: true,
      order_selected: true,
      reasons: [],
    },
    child_node_ids: [],
    worker_version: "reviewer@1",
  },
  ...[1, 2].map((attempt) => ({
    id: `assessment_01J9ZQ4XKM3B6V8N2R5T7W0SD${attempt}`,
    node_id: ids.team,
    execution_id: "execution_01J9ZQ4XKM3B6V8N2R5T7W0ED9",
    attempt,
    node_revision: 1,
    evidence_ids: [],
    child_outcome_ids: [],
    result: "criterion-not-met",
    rationale:
      attempt === 1
        ? "Invite members is Completed, but one invite link admits a second member."
        : "Invite members is Completed, but the invite email uses the language of the sender.",
    tested_input: null,
    actor: execution("ED9", "reviewer-main #1"),
    created_at: minutes(attempt === 1 ? 1600 : 95),
    currency: null,
    child_node_ids: [ids.invite],
    worker_version: "reviewer@1",
  })),
  {
    id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SF8",
    node_id: graphId("YF8"),
    execution_id: "execution_01J9ZQ4XKM3B6V8N2R5T7W0EF9",
    attempt: 1,
    node_revision: 1,
    evidence_ids: [],
    child_outcome_ids: [],
    result: "undetermined",
    rationale:
      "The criterion names the language of the receiver, and the plan file lists no source for it. The reviewer cannot judge the email text.",
    tested_input: null,
    actor: execution("EF9", "reviewer-main #1"),
    created_at: minutes(42),
    currency: null,
    child_node_ids: [],
    worker_version: "reviewer@1",
  },
];

export const GRAPH_OUTCOMES = [
  {
    id: "outcome_01J9ZQ4XKM3B6V8N2R5T7W0OB3",
    node_id: ids.audit,
    attempt: 1,
    node_revision: 1,
    closing_event: "assessment-not-passed",
    result: "criterion-not-met",
    assessment_id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SB3",
    evidence_ids: ["evidence_01J9ZQ4XKM3B6V8N2R5T7W0VB3"],
    created_at: minutes(120),
  },
  {
    id: "outcome_01J9ZQ4XKM3B6V8N2R5T7W0OS1",
    node_id: ids.signup,
    attempt: 1,
    node_revision: 1,
    closing_event: "assessment-passed",
    result: "success",
    assessment_id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SS1",
    evidence_ids: ["evidence_01J9ZQ4XKM3B6V8N2R5T7W0VS1"],
    created_at: minutes(5000),
  },
  {
    id: "outcome_01J9ZQ4XKM3B6V8N2R5T7W0OD1",
    node_id: ids.team,
    attempt: 2,
    node_revision: 1,
    closing_event: "assessment-not-passed",
    result: "criterion-not-met",
    assessment_id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SD2",
    evidence_ids: [],
    created_at: minutes(90),
  },
];

const proposalTask = (name, requirement, criterion) => ({
  name,
  requirement,
  criterion,
  verifications: ["pnpm test invites", "pnpm lint"],
});

export const GRAPH_PROPOSALS = [
  {
    id: "proposal_01J9ZQ4XKM3B6V8N2R5T7W0PD1",
    node_id: ids.team,
    attempt: 1,
    assessment_id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SD1",
    content: {
      objective_id: ids.invite,
      name: "Expire an invite link after its first use",
      requirement: "An invite link admits one member. A second use of the link fails.",
      criterion: "A test uses one invite link twice and the second use answers 410.",
      task: proposalTask(
        "Mark the invite link used",
        "Store the first use of an invite link and refuse every later use.",
        "The invite store holds the use time after the first use.",
      ),
    },
    objective_node_id: ids.inviteFix,
    approved_at: minutes(1500),
    created_at: minutes(1600),
  },
  {
    id: "proposal_01J9ZQ4XKM3B6V8N2R5T7W0PD2",
    node_id: ids.team,
    attempt: 2,
    assessment_id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SD2",
    content: {
      objective_id: ids.invite,
      name: "Send the invite email in the language of the workspace",
      requirement:
        "The invite email uses the language that the workspace settings name, not the language of the sender.",
      criterion: "A test invites a member to a German workspace and the email text is German.",
      task: proposalTask(
        "Pick the invite template by the workspace language",
        "Read the workspace language before the invite email renders.",
        "The rendered email names the workspace language in its lang attribute.",
      ),
    },
    objective_node_id: null,
    approved_at: null,
    created_at: minutes(90),
  },
];

const selection = (agentName, credential, modelIdentifier) => ({
  agent_name: agentName,
  position: 0,
  level: "enablement",
  agent_provider: "openai-org",
  provider: "openai-compatible",
  credential,
  model_identifier: modelIdentifier,
  reasoning_effort: "off",
});

const executionRecord = (projectId, spec, index) => ({
  execution_id: spec.executionId,
  project_id: projectId,
  node_id: spec.nodeId,
  claimant: {
    worker_binding_id: spec.binding.id,
    resource_identity: spec.binding.resource_identity,
    runtime_identity: `worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0I${String(index).padStart(2, "0")}`,
    ...(spec.unnamed ? {} : { name: `${spec.binding.name} #${(index % 2) + 1}` }),
  },
  attempt: spec.attempt ?? 1,
  pinned_revision: 1,
  node_branch: `kanthord/${spec.nodeId}`,
  credentials: ["credential_01J9ZQ4XKM3B6V8N2R5T7W0CR1"],
  agent_selections:
    spec.binding === GRAPH_BINDINGS.worker
      ? [selection("swe@1", "openai-main", "gpt-5")]
      : [selection("re@1", "atlas-router", "qwen3-coder")],
  claim_state: spec.claimState,
  expired_at:
    spec.expiresIn === undefined ? minutes(spec.startedAgo - 240) : minutes(-spec.expiresIn),
  created_at: minutes(spec.startedAgo),
  ended_at: spec.endedAgo === null ? null : minutes(spec.endedAgo),
  stop: spec.stop ?? null,
  trace_id: `${spec.traceSeed}${"0".repeat(32 - spec.traceSeed.length)}`,
  root_span_id: `${spec.traceSeed}${"0".repeat(16 - spec.traceSeed.length)}`,
});

export const GRAPH_EXECUTIONS = [
  ["EB2", ids.codes, "running", 30, null, GRAPH_BINDINGS.worker],
  ["EB3", ids.audit, "finished", 400, 210, GRAPH_BINDINGS.worker],
  [
    "EB9",
    ids.audit,
    "finished",
    180,
    120,
    GRAPH_BINDINGS.reviewer,
    { reason: "provider_failed", code: "rate_limited" },
  ],
  ["EC2", ids.webhook, "finished", 290, 255, GRAPH_BINDINGS.worker],
  ["EC9", ids.webhook, "finished", 250, 235, GRAPH_BINDINGS.reviewer],
  [
    "EC3",
    ids.invoices,
    "finished",
    200,
    150,
    GRAPH_BINDINGS.worker,
    { reason: "budget_end", code: "turns" },
  ],
  ["EC5", ids.invoices, "lost", 300, 20, GRAPH_BINDINGS.reviewer],
  ["EC6", ids.invoices, "lost", 330, null, GRAPH_BINDINGS.worker],
  ["EC7", ids.invoices, "finished", 160, 140, GRAPH_BINDINGS.worker, null, true],
].map(([suffix, nodeId, claimState, startedAgo, endedAgo, binding, stop, unnamed], index) =>
  executionRecord(
    PROJECT.id,
    {
      executionId: `execution_01J9ZQ4XKM3B6V8N2R5T7W0${suffix}`,
      traceSeed: suffix.toLowerCase(),
      nodeId,
      claimState,
      startedAgo,
      endedAgo,
      binding,
      stop,
      unnamed,
    },
    index,
  ),
);

const jobOf = (projectId, nodeId, priority, agoMinutes, tail) => ({
  job_id: `job_${ulidAt(minutes(agoMinutes), tail)}`,
  project_id: projectId,
  node_id: nodeId,
  priority,
});

export const GRAPH_QUEUE = [
  jobOf(PROJECT.id, ids.billing, 5, 600, "J01"),
  jobOf(PROJECT.id, ids.recovery, 0, 540, "J02"),
  jobOf(PROJECT.id, ids.webhook, 0, 180, "J03"),
  jobOf(PROJECT.id, ids.invoices, 0, 95, "J04"),
];

const atlasId = (suffix) => graphId(suffix);
const atlasNode = (suffix, kind, filename, parentSuffix, name, runtime) => ({
  ...graphNode(
    suffix,
    kind,
    filename,
    parentSuffix === null ? null : atlasId(parentSuffix),
    content(name, [REPO]),
    runtime,
  ),
  mission_id: "mission_01J9ZQ4XKM3B6V8N2R5T7W0YM2",
});

export const ATLAS_MISSION = {
  id: "mission_01J9ZQ4XKM3B6V8N2R5T7W0YM2",
  version: 1,
};

export const ATLAS_NODES = [
  atlasNode("YF1", "initiative", "checkout.md", null, "Checkout", {
    state: "Pending",
    attempt: 0,
  }),
  atlasNode("YF2", "objective", "cart-totals.md", "YF1", "Add cart totals", {
    state: "Executing",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  atlasNode("YF3", "objective", "receipt-email.md", "YF1", "Verify the receipt email", {
    state: "Evaluating",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  atlasNode("YF4", "objective", "discount-codes.md", "YF1", "Apply discount codes", {
    state: "Available",
    attempt: 0,
    priority: 3,
  }),
  atlasNode(
    "YF5",
    "objective",
    "tax-rounding.md",
    "YF1",
    "Round the tax of every line item and print the rounding rule on the receipt of the order",
    { state: "Waiting", attempt: 1, pinned_by_attempts: [1] },
  ),
  atlasNode("YF6", "objective", "order-archive.md", "YF1", "Archive the order history", {
    state: "Available",
    attempt: 0,
  }),
  atlasNode("YF7", "objective", "order-export.md", "YF1", "Export the orders as CSV", {
    state: "Completed",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  atlasNode("YF8", "objective", "order-email-locale.md", "YF1", "Localize the order email", {
    state: "Blocked",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
];

export const ATLAS_EDGES = ATLAS_NODES.filter((node) => node.parent_id !== null).map((node) => ({
  kind: "containment",
  parent_id: node.parent_id,
  child_id: node.id,
}));

export const ATLAS_OUTCOMES = [
  {
    id: "outcome_01J9ZQ4XKM3B6V8N2R5T7W0OF8",
    node_id: atlasId("YF8"),
    attempt: 1,
    node_revision: 1,
    closing_event: "assessment-not-passed",
    result: "undetermined",
    assessment_id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SF8",
    evidence_ids: [],
    created_at: minutes(40),
  },
];

export const ATLAS_QUEUE = [
  jobOf(PROJECT_ATLAS.id, atlasId("YF4"), 3, 50, "K01"),
  jobOf(PROJECT_ATLAS.id, atlasId("YF6"), 0, 130, "K02"),
  jobOf(PROJECT_ATLAS.id, atlasId("YF5"), 0, 25, "K03"),
];

const ATLAS_HISTORY_NODES = ["YF7", "YF4", "YF6", "YF5"];

const atlasHistory = Array.from({ length: 24 }, (_, index) => {
  const startedAgo = 60 + index * 45;
  const stop =
    index % 5 === 0
      ? { reason: "provider_failed", code: "rate_limited" }
      : index % 7 === 1
        ? { reason: "budget_end", code: "turns" }
        : null;
  return {
    executionId: `execution_${ulidAt(minutes(startedAgo), `H${String(index).padStart(2, "0")}`)}`,
    traceSeed: `h${String(index).padStart(2, "0")}`,
    nodeId: atlasId(ATLAS_HISTORY_NODES[index % ATLAS_HISTORY_NODES.length]),
    claimState: index % 7 === 3 ? "lost" : "finished",
    startedAgo,
    endedAgo: startedAgo - 20,
    binding: index % 2 === 0 ? GRAPH_BINDINGS.worker : GRAPH_BINDINGS.reviewer,
    attempt: Math.floor(index / 4) + 1,
    stop,
  };
});

export const ATLAS_EXECUTIONS = [
  {
    executionId: `execution_${ulidAt(minutes(12), "AF2")}`,
    traceSeed: "af2",
    nodeId: atlasId("YF2"),
    claimState: "running",
    startedAgo: 12,
    endedAgo: null,
    binding: GRAPH_BINDINGS.worker,
    expiresIn: 45,
  },
  {
    executionId: `execution_${ulidAt(minutes(4), "AF3")}`,
    traceSeed: "af3",
    nodeId: atlasId("YF3"),
    claimState: "running",
    startedAgo: 4,
    endedAgo: null,
    binding: GRAPH_BINDINGS.reviewer,
    expiresIn: 2,
  },
  ...atlasHistory,
].map((spec, index) => executionRecord(PROJECT_ATLAS.id, spec, index));

export const GRAPH_EXTRA_REVISIONS = {
  [ids.audit]: [
    {
      revision: 2,
      reason: "Name the actor and the time in the criterion. Move to the new repository binding.",
      actor: human,
      created_at: minutes(60),
      change: {
        write: "node.update",
        previous_revision: 1,
        changed_fields: ["criterion", "bindings"],
      },
      contentAt: (node) => node.content,
    },
  ],
};

export const GRAPH_ORIGINAL_CONTENT = {
  [ids.audit]: content("Audit log for account changes", [REPO_OLD]),
  [ids.signup]: content("Sign-up form", [REPO_OLD]),
};

export const GRAPH_HUMAN = human;

const DAY = 24 * 60 * 60 * 1000;
const credentialRevision = (id, revision, metadata, createdAt, endedAt = null) => ({
  id: `credential_01J9ZQ4XKM3B6V8N2R5T7W${id}`,
  revision,
  metadata,
  created_at: createdAt,
  ended_at: endedAt,
});
const ROUTER_URL = "https://openrouter.ai/api/v1";

export const CREDENTIALS = [
  {
    name: "atlas-github",
    platform: "github",
    revisions: [credentialRevision("0001", 1, null, Date.UTC(2026, 8, 1, 9, 0))],
  },
  {
    name: "atlas-ssh",
    platform: "ssh",
    revisions: [
      credentialRevision(
        "0002",
        1,
        { host: "github.com", hostname: "github.com", port: 22, identity_file: "~/.ssh/id_atlas" },
        Date.UTC(2026, 8, 1, 9, 5),
      ),
    ],
  },
  {
    name: "openai-main",
    platform: "openai-compatible",
    revisions: [
      credentialRevision(
        "0071",
        1,
        { base_url: "https://api.openai.com/v1", models: [{ id: "gpt-5", max_tokens: 16384 }] },
        Date.UTC(2026, 8, 2, 9, 0),
      ),
    ],
  },
  {
    name: "atlas-router",
    platform: "openai-compatible",
    revisions: [
      credentialRevision(
        "0013",
        3,
        { base_url: ROUTER_URL, models: [{ id: "qwen3-coder", max_tokens: 8192 }] },
        Date.UTC(2026, 8, 20, 9, 0),
      ),
      credentialRevision(
        "0012",
        2,
        { base_url: ROUTER_URL, models: [] },
        Date.UTC(2026, 8, 10, 9, 0),
      ),
      credentialRevision(
        "0011",
        1,
        { base_url: ROUTER_URL, models: [] },
        Date.UTC(2026, 8, 1, 9, 0),
        Date.UTC(2026, 8, 10, 9, 0),
      ),
    ],
  },
  {
    name: "atlas-evidence",
    platform: "s3",
    revisions: [
      credentialRevision(
        "0021",
        1,
        { endpoint: "https://s3.amazonaws.com", bucket: "atlas-evidence", region: "us-east-1" },
        Date.UTC(2026, 8, 2, 9, 0),
      ),
    ],
  },
  {
    name: "atlas-copilot",
    platform: "github-copilot",
    revisions: [credentialRevision("0031", 1, null, Date.UTC(2026, 8, 3, 9, 0))],
  },
  {
    name: "bad-anthropic",
    platform: "anthropic",
    revisions: [credentialRevision("0041", 1, null, Date.UTC(2026, 8, 4, 9, 0) - DAY)],
  },
  {
    name: "atlas-in-use",
    platform: "anthropic",
    revisions: [credentialRevision("0051", 1, null, Date.UTC(2026, 8, 5, 9, 0))],
  },
  {
    name: "legacy-anthropic",
    platform: "anthropic",
    revisions: [
      credentialRevision("0061", 1, null, Date.UTC(2026, 7, 5, 9, 0), Date.UTC(2026, 8, 1, 9, 0)),
    ],
  },
];

export const SSH_ALIASES = [
  {
    host: "github.com",
    hostname: "github.com",
    port: 22,
    identity_file: "~/.ssh/id_atlas",
    state: "present",
    reason: null,
  },
  {
    host: "github-personal",
    hostname: "github.com",
    port: 22,
    identity_file: "~/.ssh/id_personal",
    state: "ready",
    reason: null,
  },
  {
    host: "github-work",
    hostname: "github.com",
    port: 22,
    identity_file: null,
    state: "refused",
    reason: "repository.credential.ssh_identity_ambiguous",
  },
];

export const CREDENTIAL_DEPENDENTS = {
  "atlas-in-use": {
    agent_providers: ["claude-code"],
    bindings: ["project_atlas/source"],
    inbounds: ["inbound_atlas_webhook"],
  },
};

export const PINNED_CREDENTIAL_REVISIONS = ["credential_01J9ZQ4XKM3B6V8N2R5T7W0012"];

const SESSION_BASE = Date.parse("2026-10-05T09:00:00.000Z");
const entryAt = (index) => new Date(SESSION_BASE + index * 60000).toISOString();
const textMessage = (role, text) => ({ role, content: [{ type: "text", text }] });

export const WORKBENCH_SESSIONS = [
  {
    id: "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB1",
    agent_name: "swe@1",
    created: SESSION_BASE,
    configuration: {
      agent_provider: "atlas-llm",
      model_identifier: "qwen3-coder",
      reasoning_effort: "off",
    },
    entries: [
      {
        type: "model_change",
        id: "e0000001",
        parentId: null,
        timestamp: entryAt(0),
        provider: "openai-compatible",
        modelId: "qwen3-coder",
      },
      {
        type: "message",
        id: "e0000002",
        parentId: "e0000001",
        timestamp: entryAt(1),
        message: { role: "user", content: "List the open objectives of Account recovery" },
      },
      {
        type: "message",
        id: "e0000003",
        parentId: "e0000002",
        timestamp: entryAt(2),
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "I read the mission of the project first." },
            {
              type: "toolCall",
              id: "call_01",
              name: "mission.node.list",
              arguments: { mission_id: "mission_01J9ZQ4XKM3B6V8N2R5T7W0YM1" },
            },
          ],
        },
      },
      {
        type: "message",
        id: "e0000004",
        parentId: "e0000003",
        timestamp: entryAt(3),
        message: {
          role: "toolResult",
          toolCallId: "call_01",
          toolName: "mission.node.list",
          isError: false,
          content: [{ type: "text", text: '{"items":[{"name":"Add password reset"}]}' }],
        },
      },
      {
        type: "message",
        id: "e0000005",
        parentId: "e0000004",
        timestamp: entryAt(4),
        message: textMessage("assistant", "One objective is open: Add password reset."),
      },
    ],
  },
  {
    id: "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB2",
    agent_name: "swe@1",
    created: SESSION_BASE + 86400000,
    configuration: {
      agent_provider: "openai-org",
      model_identifier: "gpt-5",
      reasoning_effort: "high",
    },
    entries: [],
  },
];
