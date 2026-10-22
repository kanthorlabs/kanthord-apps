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

export const PROJECT_ORBIT = {
  id: "prj-orbit",
  name: "orbit",
  binding_set_version: 1,
  created_at: now,
  paused_at: now - 3 * 60 * 60_000,
  workspace_directory: "/home/kanthord/.local/state/kanthord/projects/prj-orbit",
};

export const BINDING_PLACEMENTS = {
  [PROJECT.id]: { "general-main": "server", "reviewer-main": "worker" },
  [PROJECT_ATLAS.id]: { "general-main": "server", "reviewer-main": "server" },
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
    declared_intents: ["implement", "examine"],
  },
  {
    name: "reviewer@1",
    host: "kanthord",
    declared_node_states: ["Waiting", "External.Requested"],
    declared_intents: ["implement", "examine"],
  },
  {
    name: "claude-code@1",
    host: "external-harness",
    declared_node_states: ["Available"],
    declared_intents: ["implement"],
  },
];

export const RELEASED_WORKERS = ["coder@1", "reviewer@1", "claude-code@1"];

export const WORKER_REGISTRATIONS = [
  {
    runtime_identity: "worker_registration_01J9ZQ4XKM3B6V8N2R5T7W0A01",
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
    runtime_identity: "worker_registration_01J9ZQ4XKM3B6V8N2R5T7W0A02",
    project_id: PROJECT.id,
    resource_identity: "worker:kanthord:reviewer-main",
    worker_name: "reviewer@1",
    host: "kanthord",
    placement: "worker",
    instance: "review-01",
    activity: "idle",
    draining: true,
    registered: true,
  },
  {
    runtime_identity: "worker_registration_01J9ZQ4XKM3B6V8N2R5T7W0A03",
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
  {
    runtime_identity: "worker_registration_01J9ZQ4XKM3B6V8N2R5T7W0A04",
    project_id: PROJECT_ATLAS.id,
    resource_identity: "worker:kanthord:reviewer-main",
    worker_name: "reviewer@1",
    host: "kanthord",
    placement: "server",
    activity: "idle",
    draining: false,
    registered: true,
  },
  {
    runtime_identity: "worker_registration_01J9ZQ4XKM3B6V8N2R5T7W0A05",
    project_id: PROJECT_ATLAS.id,
    resource_identity: "worker:kanthord:mac-main",
    worker_name: "coder@1",
    host: "kanthord",
    placement: "worker",
    instance: "mac-studio",
    activity: "idle",
    draining: false,
    registered: true,
  },
  {
    runtime_identity: "worker_registration_01J9ZQ4XKM3B6V8N2R5T7W0A07",
    project_id: PROJECT.id,
    resource_identity: "worker:kanthord:sandbox-main",
    worker_name: "coder@1",
    host: "kanthord",
    placement: "container",
    activity: "idle",
    draining: false,
    registered: true,
  },
  {
    runtime_identity: "worker_registration_01J9ZQ4XKM3B6V8N2R5T7W0A06",
    project_id: PROJECT_ATLAS.id,
    resource_identity: "worker:kanthord:harness-main",
    worker_name: "claude-code@1",
    host: "external-harness",
    activity: "idle",
    draining: false,
    registered: true,
  },
];

export const AGENT_DECLARATIONS = [
  {
    agent_name: "re@1",
    worker_names: ["reviewer@1"],
    configuration_schema: AGENT_CONFIGURATION_SCHEMA,
    overridable_fields: ["agent_provider", "model_identifier", "reasoning_effort"],
    enablement: {
      agent_name: "re@1",
      state: "enabled",
      agent_providers: [
        { name: "atlas-llm", provider: "openai-compatible", credential: "atlas-router" },
      ],
      default_configuration: {
        agent_provider: "atlas-llm",
        model_identifier: "qwen3-coder",
        reasoning_effort: "off",
      },
      fallback_configurations: [],
      revision: 1,
    },
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
    intent: "examine",
    name: "Onboarding",
    requirement: "A new account reaches a usable workspace.",
    criterion: "A new account reaches the workspace in one session.",
    verifications: ["pnpm test"],
    bindings: ["kanthord-repo", "evidence"],
    tags: [],
    depends_on: ["reset-email.md"],
  },
  {
    filename: "reset-email.md",
    id: "node_01J9ZQ4XKM3B6V8N2R5T7W0YA2",
    intent: "implement",
    name: "Add password reset",
    requirement: "A human resets a forgotten password by email.",
    criterion: "The reset link signs the human in once.",
    verifications: ["pnpm test --filter reset"],
    bindings: ["kanthord-repo", "general-main", "reviewer-main", "evidence"],
    tags: [],
    depends_on: [],
  },
  {
    filename: "reset-expiry.md",
    id: "task_01J9ZQ4XKM3B6V8N2R5T7W0YA3",
    node: "reset-email.md",
    name: "Add reset token expiry",
    requirement: "A reset token expires after 30 minutes.",
    criterion: "An expired token refuses the reset.",
    verifications: ["pnpm test --filter expiry"],
    bindings: [],
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
    "mirror-repo": {
      kind: "repository",
      config: {
        available: true,
        platform: "github",
        address: "git@github.com:kanthorlabs/hostkey-mirror.git",
        strategy: { base_branch: "main" },
        ssh_credential: "atlas-ssh",
      },
    },
    "alias-repo": {
      kind: "repository",
      config: {
        available: true,
        platform: "github",
        address: "git@github-work:kanthorlabs/kanthord.git",
        strategy: { base_branch: "main" },
        ssh_credential: "legacy-ssh",
      },
    },
    "general-main": {
      kind: "worker",
      config: {
        worker: "coder@1",
        instance_count: 2,
        placement: "server",
        resource_budget: { turns: 200, wall_time_ms: 7200000 },
        entries: [{ agent: "swe@1", reasoning_effort: "high" }],
      },
    },
    "reviewer-main": {
      kind: "worker",
      config: { worker: "reviewer@1", worker_instances: ["review-01"], placement: "worker" },
    },
    "mac-main": {
      kind: "worker",
      config: {
        worker: "coder@1",
        worker_instances: ["mac-studio", "build-01"],
        placement: "worker",
        tags: ["platform.macos"],
      },
    },
    "idle-main": {
      kind: "worker",
      config: { worker: "coder@1", instance_count: 0, placement: "server" },
    },
    "sandbox-main": {
      kind: "worker",
      config: { worker: "coder@1", instance_count: 2, placement: "container" },
    },
    "harness-main": {
      kind: "worker",
      config: { worker: "claude-code@1", instance_count: 1 },
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
  mac: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BW3",
    name: "mac-main",
    kind: "worker",
    resource_identity: "worker:kanthord:mac-main",
    revision: 1,
    created_at: minutes(600),
    removed_at: null,
  },
  idle: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BW4",
    name: "idle-main",
    kind: "worker",
    resource_identity: "worker:kanthord:idle-main",
    revision: 1,
    created_at: minutes(500),
    removed_at: null,
  },
  sandbox: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BW6",
    name: "sandbox-main",
    kind: "worker",
    resource_identity: "worker:kanthord:sandbox-main",
    revision: 1,
    created_at: minutes(450),
    removed_at: null,
  },
  harness: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BW5",
    name: "harness-main",
    kind: "worker",
    resource_identity: "worker:kanthord:harness-main",
    revision: 1,
    created_at: minutes(400),
    removed_at: null,
  },
  mirror: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BR3",
    name: "mirror-repo",
    kind: "repository",
    resource_identity: "repository:github:kanthorlabs/hostkey-mirror",
    revision: 1,
    created_at: minutes(300),
    removed_at: null,
  },
  alias: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BR4",
    name: "alias-repo",
    kind: "repository",
    resource_identity: "repository:github:kanthorlabs/kanthord",
    revision: 1,
    created_at: minutes(200),
    removed_at: null,
  },
};

const REPO = GRAPH_BINDINGS.repository.id;
const REPO_OLD = GRAPH_BINDINGS.repositoryOld.id;
const STORAGE = GRAPH_BINDINGS.storage.id;

const body = (name, bindings, extra = {}) => ({
  name,
  requirement: `${name}: the requirement that the plan file states.`,
  criterion: `${name}: the criterion that a reviewer checks.`,
  verifications: ["pnpm test", "pnpm lint"],
  bindings,
  ...extra,
});

const content = (name, bindings, extra = {}) => ({
  intent: "implement",
  tags: [],
  ...body(name, bindings, extra),
});

const examine = (name, bindings, extra = {}) => ({
  ...content(name, bindings, extra),
  intent: "examine",
});

const task = (suffix, filename, name) => ({
  id: `task_01J9ZQ4XKM3B6V8N2R5T7W0${suffix}`,
  filename,
  content: body(name, []),
});

const graphNode = (suffix, filename, nodeContent, runtime, tasks = []) => ({
  id: graphId(suffix),
  filename,
  mission_id: "mission_01J9ZQ4XKM3B6V8N2R5T7W0YM1",
  intent: nodeContent.intent,
  tags: nodeContent.tags,
  tasks,
  visible_revision: runtime.visible_revision ?? 1,
  content: nodeContent,
  retired_at: null,
  pinned_by_attempts: runtime.pinned_by_attempts ?? [],
  state: runtime.state,
  attempt: runtime.attempt,
  priority: runtime.priority ?? 0,
});

export const GRAPH_IDS = {
  onboarding: graphId("YA1"),
  reset: graphId("YA2"),
  recovery: graphId("YB1"),
  billing: graphId("YC1"),
  signup: graphId("YA4"),
  verify: graphId("YA5"),
  codes: graphId("YB2"),
  audit: graphId("YB3"),
  webhook: graphId("YC2"),
  invoices: graphId("YC3"),
  metering: graphId("YC4"),
  team: graphId("YD1"),
  invite: graphId("YD2"),
  inviteFix: graphId("YD3"),
  changelog: graphId("YE1"),
  macBuild: graphId("YE2"),
};

const ids = GRAPH_IDS;

export const GRAPH_NODES = [
  graphNode("YA1", "onboarding.md", examine("Onboarding", [REPO, STORAGE]), {
    state: "Completed",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  graphNode("YB1", "account-recovery.md", examine("Account recovery", [REPO]), {
    state: "Pending",
    attempt: 0,
  }),
  graphNode("YC1", "billing.md", examine("Billing", [REPO]), {
    state: "Pending",
    attempt: 0,
    priority: 5,
  }),
  graphNode("YA4", "signup-form.md", content("Sign-up form", [REPO]), {
    state: "Completed",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  graphNode("YA5", "email-verification.md", content("Email verification", [REPO]), {
    state: "Completed",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  graphNode("YB2", "recovery-codes.md", content("Add recovery codes", [REPO]), {
    state: "Executing",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  graphNode(
    "YA2",
    "reset-email.md",
    content("Add password reset", [REPO, STORAGE]),
    { state: "Pending", attempt: 0, priority: 2 },
    [
      task("YA3", "reset-expiry.md", "Add reset token expiry"),
      task("YB4", "reset-mail.md", "Send the reset email"),
      task("YB5", "reset-rate-limit.md", "Rate-limit the reset form"),
    ],
  ),
  graphNode(
    "YB3",
    "audit-log.md",
    content("Audit log for account changes", [REPO], {
      criterion: "Every account change writes one audit entry with the actor and the time.",
    }),
    { state: "Blocked", attempt: 1, pinned_by_attempts: [1], visible_revision: 2 },
  ),
  graphNode("YC2", "stripe-webhook.md", content("Stripe webhook", [REPO]), {
    state: "External.Requested",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  graphNode("YC3", "invoices-page.md", content("Invoices page", [REPO]), {
    state: "Waiting",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  graphNode(
    "YC4",
    "usage-metering.md",
    content("Meter the usage of every workspace and report it to the billing provider each night", [
      REPO,
    ]),
    { state: "Pending", attempt: 0 },
  ),
  graphNode("YD1", "team-workspaces.md", examine("Team workspaces", [REPO]), {
    state: "Blocked",
    attempt: 2,
    pinned_by_attempts: [2],
  }),
  graphNode("YD2", "invite-members.md", content("Invite members", [REPO]), {
    state: "Completed",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  graphNode(
    "YD3",
    "proposal-01j9zq4xkm3b6v8n2r5t7w0pd1.md",
    content("Expire an invite link after its first use", [REPO]),
    { state: "Completed", attempt: 1, pinned_by_attempts: [1] },
    [task("YD4", "proposal-01j9zq4xkm3b6v8n2r5t7w0pd1-task.md", "Mark the invite link used")],
  ),
  graphNode("YE1", "api-changelog.md", content("Publish the API changelog", [REPO]), {
    state: "Paused",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  graphNode(
    "YE2",
    "macos-build.md",
    content("Sign the macOS build of the desktop client", [REPO], {
      tags: ["platform.macos"],
    }),
    { state: "Available", attempt: 0 },
  ),
];

const dependency = (dependentId, dependsOnId) => ({
  dependent_id: dependentId,
  depends_on_id: dependsOnId,
});

export const GRAPH_EDGES = [
  dependency(ids.recovery, ids.onboarding),
  dependency(ids.verify, ids.signup),
  dependency(ids.reset, ids.codes),
  dependency(ids.audit, ids.signup),
  dependency(ids.metering, ids.webhook),
  dependency(ids.onboarding, ids.signup),
  dependency(ids.onboarding, ids.verify),
  dependency(ids.recovery, ids.codes),
  dependency(ids.recovery, ids.reset),
  dependency(ids.recovery, ids.audit),
  dependency(ids.billing, ids.webhook),
  dependency(ids.billing, ids.invoices),
  dependency(ids.billing, ids.metering),
  dependency(ids.billing, ids.changelog),
  dependency(ids.billing, ids.macBuild),
  dependency(ids.team, ids.invite),
  dependency(ids.team, ids.inviteFix),
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
  configuration: { base_branch: "main", landing: "human" },
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
  [graphId("YE1")]: [
    {
      node_id: graphId("YE1"),
      attempt: 1,
      node_revision: 1,
      start_point: "base_branch",
      required_external_actions: [pullRequest("kanthord-repo.pull_request", REPO)],
      opened_at: minutes(150),
      closed_at: null,
      outcome_ids: [],
      opened_by: human,
    },
  ],
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

GRAPH_EVIDENCE.push({
  id: "evidence_01J9ZQ4XKM3B6V8N2R5T7W0RE1",
  node_id: graphId("YE1"),
  attempt: 1,
  subject: "Pull request for the API changelog",
  assets: [
    {
      id: "evidence_asset_01J9ZQ4XKM3B6V8N2R5T7W0PE1",
      kind: "platform",
      address: {
        kind: "pull_request",
        resource_identity: "repository:github:kanthorlabs/kanthord",
        number: 151,
      },
      published_at: minutes(140),
      expired_at: null,
    },
  ],
  provenance: execution("EE1", "reviewer-main #1"),
  created_at: minutes(140),
  requirement_key: "kanthord-repo.pull_request",
});

export const GRAPH_ASSESSMENTS = [
  {
    id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SB3",
    node_id: ids.audit,
    execution_id: "execution_01J9ZQ4XKM3B6V8N2R5T7W0EB9",
    attempt: 1,
    node_revision: 1,
    evidence_ids: ["evidence_01J9ZQ4XKM3B6V8N2R5T7W0VB3"],
    dependency_outcome_ids: [],
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
    dependency_node_ids: [],
    worker_version: "reviewer@1",
  },
  {
    id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SS1",
    node_id: ids.signup,
    execution_id: "execution_01J9ZQ4XKM3B6V8N2R5T7W0ES9",
    attempt: 1,
    node_revision: 1,
    evidence_ids: ["evidence_01J9ZQ4XKM3B6V8N2R5T7W0VS1"],
    dependency_outcome_ids: [],
    result: "success",
    rationale: "Every verification exits 0, and the form meets the criterion.",
    tested_input: { kind: "repository", binding_id: REPO_OLD, commit: commitOf("a4") },
    actor: execution("ES9", "reviewer-main #1"),
    created_at: minutes(5100),
    currency: null,
    dependency_node_ids: [],
    worker_version: "reviewer@1",
  },
  {
    id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SC2",
    node_id: ids.webhook,
    execution_id: "execution_01J9ZQ4XKM3B6V8N2R5T7W0EC9",
    attempt: 1,
    node_revision: 1,
    evidence_ids: ["evidence_01J9ZQ4XKM3B6V8N2R5T7W0VC2"],
    dependency_outcome_ids: [],
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
    dependency_node_ids: [],
    worker_version: "reviewer@1",
  },
  ...[1, 2].map((attempt) => ({
    id: `assessment_01J9ZQ4XKM3B6V8N2R5T7W0SD${attempt}`,
    node_id: ids.team,
    execution_id: "execution_01J9ZQ4XKM3B6V8N2R5T7W0ED9",
    attempt,
    node_revision: 1,
    evidence_ids: [],
    dependency_outcome_ids: [],
    result: "criterion-not-met",
    rationale:
      attempt === 1
        ? "Invite members is Completed, but one invite link admits a second member."
        : "Invite members is Completed, but the invite email uses the language of the sender.",
    tested_input: null,
    actor: execution("ED9", "reviewer-main #1"),
    created_at: minutes(attempt === 1 ? 1600 : 95),
    currency: null,
    dependency_node_ids: [ids.invite],
    worker_version: "reviewer@1",
  })),
  {
    id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SF8",
    node_id: graphId("YF8"),
    execution_id: "execution_01J9ZQ4XKM3B6V8N2R5T7W0EF9",
    attempt: 1,
    node_revision: 1,
    evidence_ids: [],
    dependency_outcome_ids: [],
    result: "undetermined",
    rationale:
      "The criterion names the language of the receiver, and the plan file lists no source for it. The reviewer cannot judge the email text.",
    tested_input: null,
    actor: execution("EF9", "reviewer-main #1"),
    created_at: minutes(42),
    currency: null,
    dependency_node_ids: [],
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
      dependency_id: ids.invite,
      name: "Expire an invite link after its first use",
      requirement: "An invite link admits one member. A second use of the link fails.",
      criterion: "A test uses one invite link twice and the second use answers 410.",
      task: proposalTask(
        "Mark the invite link used",
        "Store the first use of an invite link and refuse every later use.",
        "The invite store holds the use time after the first use.",
      ),
    },
    created_node_id: ids.inviteFix,
    approved_at: minutes(1500),
    created_at: minutes(1600),
  },
  {
    id: "proposal_01J9ZQ4XKM3B6V8N2R5T7W0PD2",
    node_id: ids.team,
    attempt: 2,
    assessment_id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SD2",
    content: {
      dependency_id: ids.invite,
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
    created_node_id: null,
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
    runtime_identity: `worker_registration_01J9ZQ4XKM3B6V8N2R5T7W0I${String(index).padStart(2, "0")}`,
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
  [
    "EC8",
    ids.invoices,
    "finished",
    40,
    20,
    GRAPH_BINDINGS.reviewer,
    {
      reason: "provider_failed",
      code: "bad_request",
      detail: "400 Bad Request: the model does not accept the tool_choice field",
    },
  ],
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
  jobOf(PROJECT.id, ids.macBuild, 0, 600, "J01"),
  jobOf(PROJECT.id, ids.webhook, 0, 180, "J03"),
  jobOf(PROJECT.id, ids.invoices, 0, 95, "J04"),
];

const atlasId = (suffix) => graphId(suffix);
const atlasNode = (suffix, intent, filename, name, runtime) => ({
  ...graphNode(
    suffix,
    filename,
    intent === "examine" ? examine(name, [REPO]) : content(name, [REPO]),
    runtime,
  ),
  mission_id: "mission_01J9ZQ4XKM3B6V8N2R5T7W0YM2",
});

export const ATLAS_MISSION = {
  id: "mission_01J9ZQ4XKM3B6V8N2R5T7W0YM2",
  version: 1,
};

export const ATLAS_NODES = [
  atlasNode("YF1", "examine", "checkout.md", "Checkout", {
    state: "Pending",
    attempt: 0,
  }),
  atlasNode("YF2", "implement", "cart-totals.md", "Add cart totals", {
    state: "Executing",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  atlasNode("YF3", "implement", "receipt-email.md", "Verify the receipt email", {
    state: "Evaluating",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  atlasNode("YF4", "implement", "discount-codes.md", "Apply discount codes", {
    state: "Available",
    attempt: 0,
    priority: 3,
  }),
  atlasNode(
    "YF5",
    "implement",
    "tax-rounding.md",
    "Round the tax of every line item and print the rounding rule on the receipt of the order",
    { state: "Waiting", attempt: 1, pinned_by_attempts: [1] },
  ),
  atlasNode("YF6", "implement", "order-archive.md", "Archive the order history", {
    state: "Available",
    attempt: 0,
  }),
  atlasNode("YF7", "implement", "order-export.md", "Export the orders as CSV", {
    state: "Completed",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  atlasNode("YF8", "implement", "order-email-locale.md", "Localize the order email", {
    state: "Blocked",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  atlasNode("YF9", "implement", "shipping-rates.md", "Compute the shipping rates", {
    state: "Paused",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  atlasNode("YFA", "implement", "packing-slip.md", "Print the packing slip", {
    state: "Paused",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  atlasNode("YFB", "implement", "legacy-checkout.md", "Drop the legacy checkout", {
    state: "Discarded",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
  atlasNode("YFC", "implement", "legacy-links.md", "Redirect the legacy checkout links", {
    state: "Pending",
    attempt: 0,
  }),
  atlasNode("YFD", "implement", "release-notes.md", "Publish the release notes", {
    state: "External.Requested",
    attempt: 1,
    pinned_by_attempts: [1],
  }),
];

export const ATLAS_RELEASE_NOTES_ID = atlasId("YFD");

GRAPH_ATTEMPTS[ATLAS_RELEASE_NOTES_ID] = [
  {
    node_id: ATLAS_RELEASE_NOTES_ID,
    attempt: 1,
    node_revision: 1,
    start_point: "base_branch",
    required_external_actions: [
      {
        key: "kanthord-repo.merge_push",
        binding_id: REPO,
        action: "merge_push",
        expected_end_state: "base_branch_pushed",
        follows: null,
        configuration: { base_branch: "main", landing: "kanthord" },
      },
    ],
    opened_at: minutes(80),
    closed_at: null,
    outcome_ids: [],
    opened_by: human,
  },
];

GRAPH_EVIDENCE.push({
  id: "evidence_01J9ZQ4XKM3B6V8N2R5T7W0RF1",
  node_id: ATLAS_RELEASE_NOTES_ID,
  attempt: 1,
  subject: "Push of the release notes to main",
  assets: [
    {
      id: "evidence_asset_01J9ZQ4XKM3B6V8N2R5T7W0PF1",
      kind: "platform",
      address: {
        kind: "branch_push",
        resource_identity: "repository:github:kanthorlabs/kanthord",
        branch: "main",
        commit: commitOf("f1"),
      },
      published_at: minutes(40),
      expired_at: null,
    },
  ],
  provenance: execution("EF1", "reviewer-main #1"),
  created_at: minutes(40),
  requirement_key: "kanthord-repo.merge_push",
});

export const ATLAS_EDGES = [
  ...ATLAS_NODES.filter((node) => node.id !== atlasId("YF1")).map((node) =>
    dependency(atlasId("YF1"), node.id),
  ),
  dependency(atlasId("YFC"), atlasId("YFB")),
];

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
  ...[
    ["L01", "YF9", "lost", 200, null, -150, null],
    ["L02", "YF9", "lost", 140, null, -100, null],
    ["L03", "YFA", "finished", 90, 70, undefined, { reason: "budget_end", code: "turns" }],
  ].map(([suffix, nodeSuffix, claimState, startedAgo, endedAgo, expiresIn, stop]) => ({
    executionId: `execution_${ulidAt(minutes(startedAgo), suffix)}`,
    traceSeed: suffix.toLowerCase(),
    nodeId: atlasId(nodeSuffix),
    claimState,
    startedAgo,
    endedAgo,
    expiresIn,
    binding: GRAPH_BINDINGS.worker,
    stop,
  })),
  {
    executionId: `execution_${ulidAt(minutes(25), "AG1")}`,
    traceSeed: "ag1",
    nodeId: atlasId("YF6"),
    claimState: "finished",
    startedAgo: 25,
    endedAgo: 5,
    binding: GRAPH_BINDINGS.worker,
    stop: {
      reason: "provider_failed",
      code: "unauthorized",
      detail: "401 Unauthorized: invalid x-api-key",
    },
  },
  {
    executionId: `execution_${ulidAt(minutes(43230), "AG2")}`,
    traceSeed: "ag2",
    nodeId: atlasId("YF8"),
    claimState: "finished",
    startedAgo: 43230,
    endedAgo: 43200,
    binding: GRAPH_BINDINGS.reviewer,
    stop: { reason: "provider_failed", code: "unauthorized" },
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
        {
          public_key:
            "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBF8xPlGLwIShDyePUOlSytgj/CMxCMmWDXWn7BF2cDJ kanthord-atlas-ssh",
          fingerprint: "SHA256:SS5y+4FAdGZpIGkhURFS2VSlcK1tTrWmGk8Az16VdMs",
        },
        Date.UTC(2026, 8, 1, 9, 5),
      ),
    ],
  },
  {
    name: "legacy-ssh",
    platform: "ssh",
    revisions: [
      credentialRevision(
        "0003",
        1,
        { host: "github-work", hostname: "github.com", port: 22, identity_file: "~/.ssh/id_work" },
        Date.UTC(2026, 7, 20, 9, 0),
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

export const HOST_KEYS = {
  "github.com": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl",
  "ssh.github.com":
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl",
  "gitlab.com": "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAfuCHKVTjquxvt6CM6tdG4SLp1Btn/nOeHHE5UOzRdf",
  "altssh.gitlab.com":
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAfuCHKVTjquxvt6CM6tdG4SLp1Btn/nOeHHE5UOzRdf",
  "bitbucket.org":
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIazEu89wgQZ4bqs3d63QSMzYVa0MuJ2e2gKTKqu+UUO",
  "altssh.bitbucket.org":
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIIazEu89wgQZ4bqs3d63QSMzYVa0MuJ2e2gKTKqu+UUO",
};

export const HOST_KEY_PINS = [
  { host: "github.com", created_at: Date.UTC(2026, 8, 1, 9, 4) },
  { host: "gitlab.com", created_at: Date.UTC(2026, 8, 12, 10, 30) },
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
        message: { role: "user", content: "List the open nodes of Account recovery" },
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
        message: textMessage("assistant", "One node is open: Add password reset."),
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
  {
    id: "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB3",
    agent_name: "swe@1",
    created: SESSION_BASE + 2 * 86400000,
    configuration: {
      agent_provider: "atlas-llm",
      model_identifier: "qwen3-coder",
      reasoning_effort: "off",
    },
    approval: {
      tool_call_id: "call_approval_01",
      operation_id: "project.create",
      input: { name: "account-recovery" },
    },
    entries: [
      {
        type: "model_change",
        id: "e0000101",
        parentId: null,
        timestamp: entryAt(2880),
        provider: "openai-compatible",
        modelId: "qwen3-coder",
      },
      {
        type: "message",
        id: "e0000102",
        parentId: "e0000101",
        timestamp: entryAt(2881),
        message: { role: "user", content: "Create the project account-recovery" },
      },
      {
        type: "message",
        id: "e0000103",
        parentId: "e0000102",
        timestamp: entryAt(2882),
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "I create the project now." },
            {
              type: "toolCall",
              id: "call_approval_01",
              name: "project.create",
              arguments: { name: "account-recovery" },
            },
          ],
        },
      },
    ],
  },
];

const INSTANCE_KEY = "Qm9ndXMtaW5zdGFuY2Uta2V5LWZvci10aGUtbW9jay";

export const WORKER_INSTANCES = [
  {
    id: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0I01",
    name: "mac-studio",
    worker: "coder@1",
    revision: 1,
    public_key: `${INSTANCE_KEY}01`,
    fingerprint: "SHA256:4l0bK2qPn8YwVx3JmT7rUe6Hs1Dc9GfZaR5iLoQyWkE",
    created_at: Date.UTC(2026, 9, 18, 9, 0),
    ended_at: null,
    connected: "mac-studio.local",
  },
  {
    id: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0I03",
    name: "build-01",
    worker: "coder@1",
    revision: 2,
    public_key: `${INSTANCE_KEY}03`,
    fingerprint: "SHA256:Zk8vTn3QwYp2Lm6Rb9Xc1Hd5Fg7Js0Ua4Ei8Oo2Pq6",
    created_at: Date.UTC(2026, 9, 19, 9, 0),
    ended_at: null,
    connected: null,
  },
  {
    id: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0I04",
    name: "review-01",
    worker: "reviewer@1",
    revision: 1,
    public_key: `${INSTANCE_KEY}04`,
    fingerprint: "SHA256:Hq2Wm7Kc4Vb9Nz1Xs6Ty3Ru8Ip5Ol0Ka2Jd7Fg4Sh9",
    created_at: Date.UTC(2026, 9, 19, 10, 0),
    ended_at: null,
    connected: "review-01",
  },
  {
    id: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0I05",
    name: "old-laptop",
    worker: "coder@1",
    revision: 1,
    public_key: `${INSTANCE_KEY}05`,
    fingerprint: "SHA256:Pl3Ok8Ij2Uh7Yg1Tf6Rd5Es0Wa9Qz4Xc8Vb3Nm7Lk2",
    created_at: Date.UTC(2026, 9, 1, 9, 0),
    ended_at: Date.UTC(2026, 9, 10, 9, 0),
    connected: null,
  },
];

export const PROJECT_BINDING_SETS = {
  [PROJECT_ATLAS.id]: {
    version: 1,
    bindings: {
      "mac-main": {
        kind: "worker",
        config: { worker: "coder@1", worker_instances: ["mac-studio"], placement: "worker" },
      },
    },
  },
};

export const INSTANCE_CREDENTIAL_COPIES = [
  {
    name: "atlas-router",
    platform: "openai-compatible",
    holder: "mac-studio",
    sealed_to: "SHA256:4l0bK2qPn8YwVx3JmT7rUe6Hs1Dc9GfZaR5iLoQyWkE",
    sealed_current: true,
    revisions: [
      credentialRevision(
        "0081",
        1,
        { base_url: ROUTER_URL, models: [{ id: "qwen3-coder", max_tokens: 8192 }] },
        Date.UTC(2026, 9, 18, 9, 30),
      ),
    ],
  },
  {
    name: "claude-sub",
    platform: "anthropic-subscription",
    holder: "mac-studio",
    sealed_to: "SHA256:4l0bK2qPn8YwVx3JmT7rUe6Hs1Dc9GfZaR5iLoQyWkE",
    sealed_current: true,
    revisions: [credentialRevision("0082", 1, null, Date.UTC(2026, 9, 18, 9, 40))],
  },
  {
    name: "atlas-anthropic",
    platform: "anthropic",
    holder: "mac-studio",
    sealed_to: "SHA256:4l0bK2qPn8YwVx3JmT7rUe6Hs1Dc9GfZaR5iLoQyWkE",
    sealed_current: true,
    revisions: [credentialRevision("0085", 1, null, Date.UTC(2026, 9, 18, 9, 50))],
  },
  {
    name: "atlas-router",
    platform: "openai-compatible",
    holder: "build-01",
    sealed_to: "SHA256:Old0Fingerprint0Of0Revision0One0Ab1Cd2Ef3Gh",
    sealed_current: false,
    revisions: [
      credentialRevision(
        "0083",
        1,
        { base_url: ROUTER_URL, models: [{ id: "qwen3-coder", max_tokens: 8192 }] },
        Date.UTC(2026, 9, 19, 8, 0),
      ),
    ],
  },
  {
    name: "atlas-router",
    platform: "openai-compatible",
    holder: "review-01",
    sealed_to: "SHA256:Hq2Wm7Kc4Vb9Nz1Xs6Ty3Ru8Ip5Ol0Ka2Jd7Fg4Sh9",
    sealed_current: true,
    revisions: [
      credentialRevision(
        "0084",
        1,
        { base_url: ROUTER_URL, models: [{ id: "qwen3-coder", max_tokens: 8192 }] },
        Date.UTC(2026, 9, 19, 10, 30),
      ),
    ],
  },
];

export const INSTANCE_COPY_REPORTS = [
  {
    holder: "mac-studio",
    name: "atlas-router",
    revision: 1,
    status: "healthy",
    capability: "model-list read",
    failure_reason: null,
    models: [
      { id: "qwen3-coder", owned_by: "atlas-router", created: 1760000000 },
      { id: "qwen3-coder-plus", owned_by: "atlas-router", created: 1760500000 },
      { id: "glm-4.6", owned_by: null, created: null },
    ],
    reported_at: Date.UTC(2026, 9, 21, 7, 55),
  },
  {
    holder: "mac-studio",
    name: "claude-sub",
    revision: 1,
    status: "unhealthy",
    capability: "model call",
    failure_reason: "unauthorized",
    models: null,
    reported_at: Date.UTC(2026, 9, 21, 7, 56),
  },
];
