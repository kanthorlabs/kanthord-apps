const now = Date.now();

export const PROJECT = {
  id: "prj-kanthord",
  name: "kanthord",
  bindingSetVersion: 1,
  createdAt: now,
};

const BASE_PROMPT = `You are a senior software engineer.

## Principles

1. **Think before you act.** Investigate the evidence first.`;

const TOOL_INPUT = { type: "object" };

const AGENT_CONFIGURATION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["agentProvider", "provider", "credential", "modelIdentifier", "reasoningEffort"],
};

export const WORKER_CATALOG = [
  {
    name: "general@1",
    host: "kanthord",
    declaredNodeStates: ["Available", "Waiting"],
    requiredNodeFormat: ["objective"],
  },
  {
    name: "reviewer@1",
    host: "kanthord",
    declaredNodeStates: ["Evaluating"],
    requiredNodeFormat: ["objective"],
  },
];

export const WORKER_INSTANCES = [
  {
    runtimeIdentity: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0A01",
    projectId: PROJECT.id,
    resourceIdentity: "worker:kanthord:general-main",
    workerName: "general@1",
    host: "kanthord",
    placement: "server",
    activity: "executing",
    draining: false,
    executionId: "execution_01J9ZQ4XKM3B6V8N2R5T7W0E01",
    registered: true,
  },
  {
    runtimeIdentity: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0A02",
    projectId: PROJECT.id,
    resourceIdentity: "worker:kanthord:reviewer-main",
    workerName: "reviewer@1",
    host: "kanthord",
    placement: "worker",
    activity: "idle",
    draining: true,
    registered: true,
  },
];

export const AGENT_DECLARATIONS = [
  {
    agentName: "re@1",
    workerNames: ["reviewer@1"],
    configurationSchema: AGENT_CONFIGURATION_SCHEMA,
    overridableFields: ["agentProvider", "modelIdentifier", "reasoningEffort"],
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
      inputSchema: TOOL_INPUT,
    })),
  },
  {
    agentName: "swe@1",
    workerNames: ["general@1"],
    configurationSchema: AGENT_CONFIGURATION_SCHEMA,
    overridableFields: ["agentProvider", "modelIdentifier", "reasoningEffort"],
    enablement: {
      agentName: "swe@1",
      state: "enabled",
      agentProviders: [
        { name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" },
        { name: "openai-org", provider: "openai-compatible", credential: "openai-main" },
      ],
      defaultConfiguration: {
        agentProvider: "atlas-llm",
        modelIdentifier: "qwen3-coder",
        reasoningEffort: "off",
      },
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
        inputSchema: TOOL_INPUT,
      })),
      { name: "evidence-upload", source: "host", inputSchema: TOOL_INPUT },
    ],
  },
];

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
          baseBranch: "main",
          action: { name: "pull_request", follows: { type: "assessment_passed" } },
        },
        credential: "github-main",
      },
    },
    "general-main": {
      kind: "worker",
      config: {
        worker: "general@1",
        instanceCount: 2,
        resourceBudget: { turns: 200, wallTimeMs: 7200000 },
        entries: [{ agent: "swe@1", reasoningEffort: "high" }],
      },
    },
    "reviewer-main": {
      kind: "worker",
      config: { worker: "reviewer@1", instanceCount: 1 },
    },
    evidence: {
      kind: "storage",
      config: {
        available: true,
        endpoint: "https://s3.eu-central-1.amazonaws.com",
        bucket: "kanthord-evidence",
        region: "eu-central-1",
        prefix: "kanthord/",
        credential: "aws-evidence",
      },
    },
  },
};

const minutes = (count) => now - count * 60_000;
const graphId = (suffix) => `node_01J9ZQ4XKM3B6V8N2R5T7W0${suffix}`;
const commitOf = (seed) => seed.repeat(40).slice(0, 40);

export const GRAPH_BINDINGS = {
  repositoryOld: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BR1",
    name: "kanthord-repo",
    kind: "repository",
    resourceIdentity: "repository:github:kanthorlabs/kanthord",
    revision: 1,
    createdAt: minutes(9000),
    removedAt: null,
  },
  repository: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BR2",
    name: "kanthord-repo",
    kind: "repository",
    resourceIdentity: "repository:github:kanthorlabs/kanthord",
    revision: 2,
    createdAt: minutes(3000),
    removedAt: null,
  },
  storage: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BS1",
    name: "evidence",
    kind: "storage",
    resourceIdentity: "storage:s3:s3.eu-central-1.amazonaws.com/kanthord-evidence",
    revision: 1,
    createdAt: minutes(9000),
    removedAt: null,
  },
  worker: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BW1",
    name: "general-main",
    kind: "worker",
    resourceIdentity: "worker:kanthord:general-main",
    revision: 1,
    createdAt: minutes(9000),
    removedAt: null,
  },
  reviewer: {
    id: "binding_01J9ZQ4XKM3B6V8N2R5T7W0BW2",
    name: "reviewer-main",
    kind: "worker",
    resourceIdentity: "worker:kanthord:reviewer-main",
    revision: 1,
    createdAt: minutes(9000),
    removedAt: null,
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
  missionId: "mission_01J9ZQ4XKM3B6V8N2R5T7W0YM1",
  kind,
  parentId,
  visibleRevision: runtime?.visibleRevision ?? 1,
  content: nodeContent,
  retiredAt: null,
  pinnedByAttempts: runtime?.pinnedByAttempts ?? [],
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
};

const ids = GRAPH_IDS;

export const GRAPH_NODES = [
  graphNode("YA1", "initiative", "onboarding.md", null, content("Onboarding", [STORAGE]), {
    state: "Completed",
    attempt: 1,
    pinnedByAttempts: [1],
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
    pinnedByAttempts: [1],
  }),
  graphNode(
    "YA5",
    "objective",
    "email-verification.md",
    ids.onboarding,
    content("Email verification", [REPO]),
    { state: "Completed", attempt: 1, pinnedByAttempts: [1] },
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
      pinnedByAttempts: [1],
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
    { state: "Blocked", attempt: 1, pinnedByAttempts: [1], visibleRevision: 2 },
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
      pinnedByAttempts: [1],
    },
  ),
  graphNode("YC3", "objective", "invoices-page.md", ids.billing, content("Invoices page", [REPO]), {
    state: "Waiting",
    attempt: 1,
    pinnedByAttempts: [1],
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
];

export const GRAPH_EDGES = [
  { kind: "dependency", dependentId: ids.recovery, dependsOnId: ids.onboarding },
  { kind: "dependency", dependentId: ids.verify, dependsOnId: ids.signup },
  { kind: "dependency", dependentId: ids.reset, dependsOnId: ids.codes },
  { kind: "dependency", dependentId: ids.audit, dependsOnId: ids.signup },
  { kind: "dependency", dependentId: ids.metering, dependsOnId: ids.webhook },
  ...GRAPH_NODES.filter((node) => node.parentId !== null).map((node) => ({
    kind: "containment",
    parentId: node.parentId,
    childId: node.id,
  })),
];

const human = { kind: "human", account: "kanthorlabs", name: "Kanthor Labs" };
const execution = (suffix, name) => ({
  kind: "execution",
  executionId: `execution_01J9ZQ4XKM3B6V8N2R5T7W0${suffix}`,
  clientId: null,
  name,
});

const pullRequest = (key, bindingId) => ({
  key,
  bindingId,
  action: "pull_request",
  expectedEndState: "pull_request_merged",
  follows: null,
  configuration: { baseBranch: "main" },
});

export const GRAPH_ATTEMPTS = {
  [ids.onboarding]: [
    {
      nodeId: ids.onboarding,
      attempt: 1,
      nodeRevision: 1,
      requiredExternalActions: [],
      openedAt: minutes(4000),
      closedAt: minutes(3900),
      outcomeIds: ["outcome_01J9ZQ4XKM3B6V8N2R5T7W0OA1"],
      openedBy: execution("EA1", "reviewer-main #1"),
    },
  ],
  [ids.signup]: [
    {
      nodeId: ids.signup,
      attempt: 1,
      nodeRevision: 1,
      requiredExternalActions: [pullRequest("kanthord-repo.pull_request", REPO_OLD)],
      openedAt: minutes(6000),
      closedAt: minutes(5000),
      outcomeIds: ["outcome_01J9ZQ4XKM3B6V8N2R5T7W0OS1"],
      openedBy: execution("ES1", "general-main #1"),
    },
  ],
  [ids.audit]: [
    {
      nodeId: ids.audit,
      attempt: 1,
      nodeRevision: 1,
      requiredExternalActions: [pullRequest("kanthord-repo.pull_request", REPO_OLD)],
      openedAt: minutes(400),
      closedAt: minutes(120),
      outcomeIds: ["outcome_01J9ZQ4XKM3B6V8N2R5T7W0OB3"],
      openedBy: execution("EB3", "general-main #2"),
    },
  ],
  [ids.codes]: [
    {
      nodeId: ids.codes,
      attempt: 1,
      nodeRevision: 1,
      requiredExternalActions: [pullRequest("kanthord-repo.pull_request", REPO)],
      openedAt: minutes(30),
      closedAt: null,
      outcomeIds: [],
      openedBy: execution("EB2", "general-main #1"),
    },
  ],
  [ids.webhook]: [
    {
      nodeId: ids.webhook,
      attempt: 1,
      nodeRevision: 1,
      requiredExternalActions: [pullRequest("kanthord-repo.pull_request", REPO)],
      openedAt: minutes(300),
      closedAt: null,
      outcomeIds: [],
      openedBy: human,
    },
  ],
  [ids.invoices]: [
    {
      nodeId: ids.invoices,
      attempt: 1,
      nodeRevision: 1,
      requiredExternalActions: [pullRequest("kanthord-repo.pull_request", REPO)],
      openedAt: minutes(200),
      closedAt: null,
      outcomeIds: [],
      openedBy: execution("EC3", "general-main #2"),
    },
  ],
  [ids.verify]: [
    {
      nodeId: ids.verify,
      attempt: 1,
      nodeRevision: 1,
      requiredExternalActions: [],
      openedAt: minutes(4800),
      closedAt: minutes(4200),
      outcomeIds: [],
      openedBy: execution("EA5", "general-main #1"),
    },
  ],
};

const verification = (bindingId, seed, exitCodes) => ({
  testedInput: { kind: "repository", bindingId, commit: commitOf(seed) },
  results: ["pnpm test", "pnpm lint"].map((command, index) => ({
    command,
    exitCode: exitCodes[index] ?? null,
    signal: null,
    timedOut: false,
  })),
});

const repositoryAsset = (suffix, bindingId, seed) => ({
  id: `evidence_asset_01J9ZQ4XKM3B6V8N2R5T7W0${suffix}`,
  kind: "repository",
  address: { kind: "repository", bindingId, commit: commitOf(seed) },
  publishedAt: minutes(100),
  expiredAt: null,
});

export const GRAPH_EVIDENCE = [
  {
    id: "evidence_01J9ZQ4XKM3B6V8N2R5T7W0VB3",
    nodeId: ids.audit,
    attempt: 1,
    subject: "Audit log writer and its migration",
    assets: [repositoryAsset("AB3", REPO_OLD, "b3")],
    provenance: execution("EB3", "general-main #2"),
    createdAt: minutes(200),
    verification: verification(REPO_OLD, "b3", [0, 1]),
  },
  {
    id: "evidence_01J9ZQ4XKM3B6V8N2R5T7W0VS1",
    nodeId: ids.signup,
    attempt: 1,
    subject: "Sign-up form with validation",
    assets: [repositoryAsset("AS1", REPO_OLD, "a4")],
    provenance: execution("ES1", "general-main #1"),
    createdAt: minutes(5500),
    verification: verification(REPO_OLD, "a4", [0, 0]),
  },
  {
    id: "evidence_01J9ZQ4XKM3B6V8N2R5T7W0VC2",
    nodeId: ids.webhook,
    attempt: 1,
    subject: "Webhook handler for invoice events",
    assets: [repositoryAsset("AC2", REPO, "c2")],
    provenance: execution("EC2", "general-main #1"),
    createdAt: minutes(260),
    verification: verification(REPO, "c2", [0, 0]),
  },
  {
    id: "evidence_01J9ZQ4XKM3B6V8N2R5T7W0RC2",
    nodeId: ids.webhook,
    attempt: 1,
    subject: "Pull request for the webhook handler",
    assets: [
      {
        id: "evidence_asset_01J9ZQ4XKM3B6V8N2R5T7W0PC2",
        kind: "platform",
        address: {
          kind: "pull_request",
          resourceIdentity: "repository:github:kanthorlabs/kanthord",
          number: 142,
        },
        publishedAt: minutes(240),
        expiredAt: null,
      },
    ],
    provenance: execution("EC9", "reviewer-main #1"),
    createdAt: minutes(240),
    requirementKey: "kanthord-repo.pull_request",
  },
];

export const GRAPH_ASSESSMENTS = [
  {
    id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SB3",
    nodeId: ids.audit,
    executionId: "execution_01J9ZQ4XKM3B6V8N2R5T7W0EB9",
    attempt: 1,
    nodeRevision: 1,
    evidenceIds: ["evidence_01J9ZQ4XKM3B6V8N2R5T7W0VB3"],
    childOutcomeIds: [],
    result: "criterion-not-met",
    rationale: "The verification pnpm lint exits 1. The audit entry holds no actor.",
    testedInput: { kind: "repository", bindingId: REPO_OLD, commit: commitOf("b3") },
    actor: execution("EB9", "reviewer-main #1"),
    createdAt: minutes(125),
    currency: {
      current: true,
      contextMatches: true,
      authorityAdmits: true,
      orderSelected: true,
      reasons: [],
    },
    childNodeIds: [],
    workerVersion: "reviewer@1",
  },
  {
    id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SS1",
    nodeId: ids.signup,
    executionId: "execution_01J9ZQ4XKM3B6V8N2R5T7W0ES9",
    attempt: 1,
    nodeRevision: 1,
    evidenceIds: ["evidence_01J9ZQ4XKM3B6V8N2R5T7W0VS1"],
    childOutcomeIds: [],
    result: "success",
    rationale: "Every verification exits 0, and the form meets the criterion.",
    testedInput: { kind: "repository", bindingId: REPO_OLD, commit: commitOf("a4") },
    actor: execution("ES9", "reviewer-main #1"),
    createdAt: minutes(5100),
    currency: null,
    childNodeIds: [],
    workerVersion: "reviewer@1",
  },
  {
    id: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SC2",
    nodeId: ids.webhook,
    executionId: "execution_01J9ZQ4XKM3B6V8N2R5T7W0EC9",
    attempt: 1,
    nodeRevision: 1,
    evidenceIds: ["evidence_01J9ZQ4XKM3B6V8N2R5T7W0VC2"],
    childOutcomeIds: [],
    result: "success",
    rationale: "Every verification exits 0. The pull request waits for its merge.",
    testedInput: { kind: "repository", bindingId: REPO, commit: commitOf("c2") },
    actor: execution("EC9", "reviewer-main #1"),
    createdAt: minutes(245),
    currency: {
      current: true,
      contextMatches: true,
      authorityAdmits: true,
      orderSelected: true,
      reasons: [],
    },
    childNodeIds: [],
    workerVersion: "reviewer@1",
  },
];

export const GRAPH_OUTCOMES = [
  {
    id: "outcome_01J9ZQ4XKM3B6V8N2R5T7W0OB3",
    nodeId: ids.audit,
    attempt: 1,
    nodeRevision: 1,
    closingEvent: "assessment-not-passed",
    result: "criterion-not-met",
    assessmentId: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SB3",
    evidenceIds: ["evidence_01J9ZQ4XKM3B6V8N2R5T7W0VB3"],
    createdAt: minutes(120),
  },
  {
    id: "outcome_01J9ZQ4XKM3B6V8N2R5T7W0OS1",
    nodeId: ids.signup,
    attempt: 1,
    nodeRevision: 1,
    closingEvent: "assessment-passed",
    result: "success",
    assessmentId: "assessment_01J9ZQ4XKM3B6V8N2R5T7W0SS1",
    evidenceIds: ["evidence_01J9ZQ4XKM3B6V8N2R5T7W0VS1"],
    createdAt: minutes(5000),
  },
];

export const GRAPH_EXECUTIONS = [
  ["EB2", ids.codes, "running", 30, null, GRAPH_BINDINGS.worker],
  ["EB3", ids.audit, "finished", 400, 210, GRAPH_BINDINGS.worker],
  ["EB9", ids.audit, "finished", 180, 120, GRAPH_BINDINGS.reviewer],
  ["EC2", ids.webhook, "finished", 290, 255, GRAPH_BINDINGS.worker],
  ["EC9", ids.webhook, "finished", 250, 235, GRAPH_BINDINGS.reviewer],
  ["EC3", ids.invoices, "finished", 200, 150, GRAPH_BINDINGS.worker],
  ["EC5", ids.invoices, "lost", 300, 20, GRAPH_BINDINGS.reviewer],
].map(([suffix, nodeId, claimState, startedAgo, endedAgo, binding], index) => ({
  executionId: `execution_01J9ZQ4XKM3B6V8N2R5T7W0${suffix}`,
  projectId: PROJECT.id,
  nodeId,
  claimant: {
    workerBindingId: binding.id,
    resourceIdentity: binding.resourceIdentity,
    runtimeIdentity: `worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0I${index}`,
    name: `${binding.name} #${(index % 2) + 1}`,
  },
  attempt: 1,
  pinnedRevision: 1,
  credentials: ["credential_01J9ZQ4XKM3B6V8N2R5T7W0CR1"],
  claimState,
  expiredAt: minutes(startedAgo - 240),
  createdAt: minutes(startedAgo),
  endedAt: endedAgo === null ? null : minutes(endedAgo),
  traceId: `${suffix.toLowerCase()}${"0".repeat(30)}`,
  rootSpanId: `${suffix.toLowerCase()}${"0".repeat(14)}`,
}));

export const GRAPH_QUEUE = [
  { jobId: "job_01J9ZQ4XKM3B6V8N2R5T7W0J01", nodeId: ids.billing, priority: 5 },
  { jobId: "job_01J9ZQ4XKM3B6V8N2R5T7W0J02", nodeId: ids.recovery, priority: 0 },
  { jobId: "job_01J9ZQ4XKM3B6V8N2R5T7W0J03", nodeId: ids.webhook, priority: 0 },
  { jobId: "job_01J9ZQ4XKM3B6V8N2R5T7W0J04", nodeId: ids.invoices, priority: 0 },
].map((job) => ({ ...job, projectId: PROJECT.id }));

export const GRAPH_EXTRA_REVISIONS = {
  [ids.audit]: [
    {
      revision: 2,
      reason: "Name the actor and the time in the criterion. Move to the new repository binding.",
      actor: human,
      createdAt: minutes(60),
      change: {
        write: "node.update",
        previousRevision: 1,
        changedFields: ["criterion", "bindings"],
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
  createdAt,
  endedAt,
});
const ROUTER_URL = "https://openrouter.ai/api/v1";

export const CREDENTIALS = [
  {
    name: "atlas-github",
    platform: "github",
    revisions: [credentialRevision("0001", 1, null, Date.UTC(2026, 8, 1, 9, 0))],
  },
  {
    name: "atlas-router",
    platform: "openai-compatible",
    revisions: [
      credentialRevision(
        "0013",
        3,
        { baseUrl: ROUTER_URL, models: [{ id: "qwen3-coder", maxTokens: 8192 }] },
        Date.UTC(2026, 8, 20, 9, 0),
      ),
      credentialRevision(
        "0012",
        2,
        { baseUrl: ROUTER_URL, models: [] },
        Date.UTC(2026, 8, 10, 9, 0),
      ),
      credentialRevision(
        "0011",
        1,
        { baseUrl: ROUTER_URL, models: [] },
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
];

export const PINNED_CREDENTIAL_REVISIONS = ["credential_01J9ZQ4XKM3B6V8N2R5T7W0012"];
