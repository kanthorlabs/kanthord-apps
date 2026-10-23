/**
 * A development stand-in for the kanthord daemon.
 *
 * It serves the contract that src/api derives from the design set, so the
 * dashboard runs before the daemon exists. It is not part of the application
 * and no module under src/ reaches it.
 */
import { createHash, generateKeyPairSync } from "node:crypto";
import { createServer } from "node:http";

import { registerEnvironments } from "./environments.mjs";
import * as fx from "./fixtures.mjs";
import { registerInstances } from "./instances.mjs";
import { registerTracking } from "./tracking.mjs";
import { registerWorkbench } from "./workbench.mjs";

const PORT = Number(process.env.KANTHORD_HTTP_PORT ?? 31415);
const ORIGIN = process.env.KANTHORD_HTTP_ALLOWED_ORIGINS ?? "http://localhost:27182";
const USERNAME = "kanthorlabs";
const DEV_TOKEN = process.env.KANTHORD_DEV_TOKEN ?? "dev-human-token";
const UNHEALTHY = process.env.KANTHORD_MOCK_UNHEALTHY === "1";
const HOST_FILE_LOCKED = process.env.KANTHORD_MOCK_HOST_FILE_LOCKED === "1";
const EMPTY = process.env.KANTHORD_MOCK_EMPTY === "1";
const STABLE_PLACEMENT_REASONS = ["server_in_container", "runtime_absent", "runtime_rootful"];
const CONTAINER_REASON_ENV = process.env.KANTHORD_MOCK_CONTAINER ?? "server_in_container";
let containerReason = CONTAINER_REASON_ENV === "available" ? null : CONTAINER_REASON_ENV;

const HEALTHY_SERVICES = {
  server: { gateway: 200, store: 200, log: 200 },
  gateway: { listener: 200, authentication: 200, idempotency: 200, registry: 200, invocation: 200 },
  custody: { credential: 200 },
  scheduler: { queue: 200 },
  worker: { registrations: 200 },
  repository: { toolchain: 200 },
  project: { bindings: 200 },
  mission: { operations: 200 },
};
const projects = EMPTY
  ? []
  : [
      structuredClone(fx.PROJECT),
      structuredClone(fx.PROJECT_ATLAS),
      structuredClone(fx.PROJECT_ORBIT),
    ];
const bindingSet = structuredClone(EMPTY ? { ...fx.BINDING_SET, bindings: {} } : fx.BINDING_SET);
const otherBindingSets = new Map(
  projects
    .slice(1)
    .map((project) => [
      project.id,
      structuredClone(fx.PROJECT_BINDING_SETS[project.id] ?? { version: 1, bindings: {} }),
    ]),
);
const bindingSetOf = (projectId) => {
  if (projectId === projects[0]?.id) return bindingSet;
  if (!otherBindingSets.has(projectId))
    otherBindingSets.set(projectId, { version: 1, bindings: {} });
  return otherBindingSets.get(projectId);
};
const bindingSets = () => [
  ...(projects[0] === undefined ? [] : [[projects[0].id, bindingSet]]),
  ...otherBindingSets.entries(),
];
const agents = structuredClone(fx.AGENT_DECLARATIONS).map((agent) =>
  EMPTY ? { ...agent, enablement: null } : agent,
);
const workbenchSessions = EMPTY ? [] : structuredClone(fx.WORKBENCH_SESSIONS);
const projectStates = new Map([
  [
    fx.PROJECT.id,
    structuredClone({
      mission: { ...fx.MISSION, entries: fx.MISSION_ENTRIES },
      nodes: fx.GRAPH_NODES,
      edges: fx.GRAPH_EDGES,
      proposals: fx.GRAPH_PROPOSALS,
      outcomes: fx.GRAPH_OUTCOMES,
      queue: fx.GRAPH_QUEUE,
      executions: fx.GRAPH_EXECUTIONS,
    }),
  ],
  [
    fx.PROJECT_ATLAS.id,
    structuredClone({
      mission: { ...fx.ATLAS_MISSION, entries: [] },
      nodes: fx.ATLAS_NODES,
      edges: fx.ATLAS_EDGES,
      proposals: [],
      outcomes: fx.ATLAS_OUTCOMES,
      queue: fx.ATLAS_QUEUE,
      executions: fx.ATLAS_EXECUTIONS,
    }),
  ],
]);
let nodeSequence = 10;

const emptyProjectState = (projectId) => ({
  mission: { id: `mission_${projectId}`, version: 1, entries: [] },
  nodes: [],
  edges: [],
  proposals: [],
  outcomes: [],
  queue: [],
  executions: [],
});

projectStates.set(fx.PROJECT_ORBIT.id, emptyProjectState(fx.PROJECT_ORBIT.id));

const stateOfProject = (projectId) => projectStates.get(projectId);
const stateOfMission = (missionId) =>
  [...projectStates.values()].find((state) => state.mission.id === missionId);
const stateOfNode = (nodeId) =>
  [...projectStates.values()].find((state) => state.nodes.some((node) => node.id === nodeId));
const stateOfProposal = (proposalId) =>
  [...projectStates.values()].find((state) =>
    state.proposals.some((proposal) => proposal.id === proposalId),
  );

const routes = [];
const on = (method, pattern, handler) => routes.push({ method, pattern, handler });

const json = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": ORIGIN,
    vary: "origin",
    "access-control-allow-headers": "authorization,content-type,accept,idempotency-key",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "cache-control": "no-store",
  });
  res.end(body === null ? "" : JSON.stringify(body));
};

const PUBLIC = [{ method: "GET", path: "/api/liveness" }];

on("GET", /^\/api\/liveness$/, (_m, _b, res) => {
  if (!UNHEALTHY) return json(res, 200, { status: "ok", services: HEALTHY_SERVICES });
  const services = structuredClone(HEALTHY_SERVICES);
  services.server.store = 503;
  return json(res, 503, {
    error: {
      code: "gateway.liveness.unhealthy",
      message: "A component is unavailable.",
      details: services,
    },
    request_id: `req-${Math.random().toString(36).slice(2, 10)}`,
  });
});

const MOCK_SERVER_VERSION = "28.0.1";

on("GET", /^\/api\/openapi\.yaml$/, (_m, _b, res) => {
  res.writeHead(200, {
    "content-type": "application/yaml",
    "access-control-allow-origin": ORIGIN,
    vary: "origin",
    "cache-control": "no-store",
  });
  res.end(
    `openapi: 3.1.0\ninfo:\n  title: kanthord\n  version: ${MOCK_SERVER_VERSION}\npaths: {}\n`,
  );
});

on("GET", /^\/api\/auth\/verify$/, (_m, _b, res) =>
  json(res, 200, { kind: "human", sub: USERNAME, name: "Kanthor Labs" }),
);

const PROJECT_NAME = /^[a-z][a-z0-9-]{0,62}$/;

const projectEnvelope = (res, status, code, message, details = null) =>
  json(res, status, {
    error: { code, message, details },
    request_id: "request_01J00000000000000000000000",
  });

const refuseProjectName = (res, name, selfId) => {
  if (typeof name !== "string" || !PROJECT_NAME.test(name)) {
    return projectEnvelope(res, 400, "project.request.invalid", "The project name is invalid.");
  }
  if (projects.some((p) => p.name === name && p.id !== selfId)) {
    return projectEnvelope(
      res,
      409,
      "project.name.conflict",
      "Another project already uses the requested name.",
    );
  }
  return null;
};

on("GET", /^\/api\/project$/, (_m, _b, res, _t, url) => {
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const offset = Number(url.searchParams.get("cursor") ?? 0);
  const ordered = [...projects].sort((a, b) => (a.id < b.id ? 1 : -1));
  const items = ordered.slice(offset, offset + limit);
  const nextCursor = offset + limit < ordered.length ? String(offset + limit) : null;
  return json(res, 200, { items, next_cursor: nextCursor });
});

on("POST", /^\/api\/project$/, (_m, b, res) => {
  const refused = refuseProjectName(res, b?.name, null);
  if (refused !== null) return refused;
  const id = `project_${Date.now().toString(36)}`;
  const project = {
    id,
    name: b.name,
    binding_set_version: 1,
    created_at: Date.now(),
    paused_at: null,
    workspace_directory: `/home/kanthord/.local/state/kanthord/projects/${id}`,
  };
  projects.push(project);
  projectStates.set(id, emptyProjectState(id));
  return json(res, 200, project);
});

on("GET", /^\/api\/project\/([^/]+)$/, (m, _b, res) => {
  const project = projects.find((p) => p.id === decodeURIComponent(m[1]));
  if (project === undefined) {
    return projectEnvelope(
      res,
      404,
      "project.project.not_found",
      "The project identity does not exist.",
    );
  }
  return json(res, 200, project);
});

for (const [action, pausedAt] of [
  ["pause", () => Date.now()],
  ["resume", () => null],
]) {
  on("POST", new RegExp(`^\\/api\\/project\\/([^/]+)\\/${action}$`), (m, _b, res) => {
    const project = projects.find((p) => p.id === decodeURIComponent(m[1]));
    if (project === undefined) {
      return projectEnvelope(
        res,
        404,
        "project.project.not_found",
        "The project identity does not exist.",
      );
    }
    if ((project.paused_at === null) === (action === "pause")) project.paused_at = pausedAt();
    return json(res, 200, project);
  });
}

on("PATCH", /^\/api\/project\/([^/]+)$/, (m, b, res) => {
  const project = projects.find((p) => p.id === decodeURIComponent(m[1]));
  if (project === undefined) {
    return projectEnvelope(
      res,
      404,
      "project.project.not_found",
      "The project identity does not exist.",
    );
  }
  const refused = refuseProjectName(res, b?.name, project.id);
  if (refused !== null) return refused;
  project.name = b.name;
  return json(res, 200, project);
});

on("GET", /^\/api\/worker\/catalog$/, (_m, _b, res) =>
  json(res, 200, page(fx.WORKER_CATALOG.filter((w) => fx.RELEASED_WORKERS.includes(w.name)))),
);
on("GET", /^\/api\/worker\/registration$/, (_m, _b, res, _t, url) => {
  const projectId = url.searchParams.get("project_id");
  const items = fx.WORKER_REGISTRATIONS.filter(
    (registration) => projectId === null || registration.project_id === projectId,
  );
  return json(res, 200, page(items));
});
const placementStatusOf = (placement) => {
  const unavailable = placement === "container" && containerReason !== null;
  return {
    placement,
    available: !unavailable,
    reason: unavailable ? containerReason : null,
    detail:
      unavailable && containerReason === "runtime_failed"
        ? "Cannot connect to Podman. Is the Podman machine running?"
        : null,
    container_runtime:
      placement === "container" &&
      !["server_in_container", "runtime_absent"].includes(containerReason)
        ? "podman"
        : null,
  };
};
on("GET", /^\/api\/worker\/placement$/, (_m, _b, res) =>
  json(res, 200, { items: ["server", "container", "worker"].map(placementStatusOf) }),
);
on("PUT", /^\/api\/mock\/container$/, (_m, b, res) => {
  containerReason = b?.reason ?? null;
  return json(res, 200, placementStatusOf("container"));
});
const WORKER_METHODS = {
  "coder@1": "steps",
  "reviewer@1": "evaluation",
};
on("GET", /^\/api\/worker\/catalog\/([^/]+)$/, (m, _b, res) => {
  const item = fx.WORKER_CATALOG.find((w) => w.name === decodeURIComponent(m[1]));
  const agentNames = agents
    .filter((a) => a.worker_names.includes(item?.name))
    .map((a) => a.agent_name);
  if (item?.host === "external-harness") {
    return json(res, 200, {
      ...item,
      harness: item.name.split("@")[0],
      resource_budget: { wall_time_ms: 3600000 },
    });
  }
  if (item === undefined || agentNames.length === 0) {
    return projectEnvelope(res, 404, "worker.catalog.not_found", "The worker is not supplied.");
  }
  return json(res, 200, {
    ...item,
    method: WORKER_METHODS[item.name],
    agent_names: agentNames,
    resource_budget: { wall_time_ms: 3600000 },
  });
});
on("GET", /^\/api\/agent\/enablement$/, (_m, _b, res) =>
  json(res, 200, page(agents.flatMap((a) => (a.enablement === null ? [] : [a.enablement])))),
);
const enablementTarget = (res, name, expectedRevision) => {
  const agent = agents.find((a) => a.agent_name === decodeURIComponent(name));
  if (agent === undefined) {
    projectEnvelope(res, 404, "agent.catalog.not_found", "The agent is absent from the catalog.");
    return null;
  }
  if ((agent.enablement?.revision ?? undefined) !== expectedRevision) {
    projectEnvelope(
      res,
      409,
      "agent.enablement.revision_conflict",
      "The enablement changed after the read.",
    );
    return null;
  }
  return agent;
};
on("GET", /^\/api\/agent\/enablement\/([^/]+)$/, (m, _b, res) => {
  const agent = agents.find((a) => a.agent_name === decodeURIComponent(m[1]));
  if (agent?.enablement == null) {
    return projectEnvelope(res, 404, "agent.enablement.not_found", "No enablement exists.");
  }
  return json(res, 200, agent.enablement);
});
on("PUT", /^\/api\/agent\/enablement\/([^/]+)$/, (m, b, res) => {
  const agent = enablementTarget(res, m[1], b?.expected_revision);
  if (agent === null) return undefined;
  agent.enablement = {
    agent_name: agent.agent_name,
    state: agent.enablement?.state ?? "enabled",
    agent_providers: b.agent_providers,
    default_configuration: b.default_configuration,
    fallback_configurations: b.fallback_configurations,
    revision: (agent.enablement?.revision ?? 0) + 1,
  };
  return json(res, 200, agent.enablement);
});
on("POST", /^\/api\/agent\/enablement\/([^/]+)\/(enable|disable)$/, (m, b, res) => {
  const agent = enablementTarget(res, m[1], b?.expected_revision);
  if (agent === null) return undefined;
  if (agent.enablement === null) {
    return projectEnvelope(res, 404, "agent.enablement.not_found", "No enablement exists.");
  }
  agent.enablement = {
    ...agent.enablement,
    state: m[2] === "enable" ? "enabled" : "disabled",
    revision: agent.enablement.revision + 1,
  };
  return json(res, 200, agent.enablement);
});
on("GET", /^\/api\/agent\/enablement\/([^/]+)\/provider\/([^/]+)\/model$/, (m, _b, res) => {
  const agent = agents.find((a) => a.agent_name === decodeURIComponent(m[1]));
  if (agent === undefined) {
    return projectEnvelope(
      res,
      404,
      "agent.catalog.not_found",
      "The agent is absent from the catalog.",
    );
  }
  if (agent.enablement === null) {
    return projectEnvelope(res, 404, "agent.enablement.not_found", "No enablement exists.");
  }
  const provider = agent.enablement.agent_providers.find(
    (p) => p.name === decodeURIComponent(m[2]),
  );
  if (provider === undefined) {
    return projectEnvelope(
      res,
      404,
      "agent.enablement.provider.not_found",
      "The agent provider does not exist.",
    );
  }
  return json(res, 200, { items: modelsOfCredential(provider.provider, provider.credential) });
});

const refuseValidation = (res) =>
  projectEnvelope(res, 400, "gateway.request.validation_failed", "Request validation failed.");

const modelsOfCredential = (provider, credentialName) => {
  const listed = fx.AGENT_PROVIDER_MODELS[credentialName];
  if (listed !== undefined) return listed;
  if (provider !== "openai-compatible") return fx.AGENT_KIND_MODELS[provider] ?? [];
  const live = credentials
    .find((item) => item.name === credentialName)
    ?.revisions.find((revision) => revision.ended_at === null);
  return (live?.metadata?.models ?? []).map((model) => ({
    model_identifier: model.id,
    reasoning_efforts: model.reasoning_levels ?? ["off"],
  }));
};

const credentialSuitsProvider = (provider, credentialName) =>
  credentials.some(
    (item) => item.name === credentialName && item.platform === provider && !isArchived(item),
  );

const isLlmPlatform = (platform) =>
  CREDENTIAL_PLATFORM_LISTS.llm.items.some((entry) => entry.platform === platform);

on("GET", /^\/api\/agent\/model$/, (_m, _b, res, _t, url) => {
  const provider = url.searchParams.get("provider");
  const credential = url.searchParams.get("credential");
  if (!isLlmPlatform(provider) || !isNonblank(credential)) return refuseValidation(res);
  if (!credentialSuitsProvider(provider, credential)) {
    return projectEnvelope(
      res,
      400,
      "agent.configuration.credential_unsuitable",
      "The credential does not suit the agent provider kind.",
      { provider, credential },
    );
  }
  return json(res, 200, { items: modelsOfCredential(provider, credential) });
});

const enablementOf = (res, name, expectedRevision) => {
  const agent = agents.find((a) => a.agent_name === decodeURIComponent(name));
  if (agent === undefined) {
    projectEnvelope(res, 404, "agent.catalog.not_found", "The agent is absent from the catalog.");
    return null;
  }
  if (agent.enablement === null) {
    projectEnvelope(res, 404, "agent.enablement.not_found", "No enablement exists.");
    return null;
  }
  if (agent.enablement.revision !== expectedRevision) {
    projectEnvelope(
      res,
      409,
      "agent.enablement.revision_conflict",
      "The enablement changed after the read.",
      { agent_name: agent.agent_name, revision: agent.enablement.revision },
    );
    return null;
  }
  return agent;
};

const refuseEnablementChange = (res, agent, code, details = {}) =>
  projectEnvelope(res, 409, code, "Agent enablement change refused.", {
    agent_name: agent.agent_name,
    ...details,
  });

const isRevision = (value) => Number.isInteger(value) && value > 0;

on("POST", /^\/api\/agent\/enablement\/([^/]+)\/provider$/, (m, b, res) => {
  const valid =
    isRevision(b?.expected_revision) &&
    isNonblank(b.name) &&
    isLlmPlatform(b.provider) &&
    isNonblank(b.credential);
  if (!valid) return refuseValidation(res);
  const agent = enablementOf(res, m[1], b.expected_revision);
  if (agent === null) return undefined;
  const providers = agent.enablement.agent_providers;
  if (providers.some((item) => item.name === b.name)) {
    return refuseEnablementChange(res, agent, "agent.enablement.provider.name_conflict");
  }
  const holder = providers.find((item) => item.credential === b.credential);
  if (holder !== undefined) {
    return refuseEnablementChange(res, agent, "agent.enablement.provider.credential_conflict", {
      credential: b.credential,
      agent_provider: holder.name,
    });
  }
  if (!credentialSuitsProvider(b.provider, b.credential)) {
    return projectEnvelope(
      res,
      400,
      "agent.configuration.credential_unsuitable",
      "The credential does not suit the agent provider kind.",
      { provider: b.provider, credential: b.credential },
    );
  }
  agent.enablement = {
    ...agent.enablement,
    agent_providers: [
      ...providers,
      { name: b.name, provider: b.provider, credential: b.credential },
    ],
    revision: agent.enablement.revision + 1,
  };
  return json(res, 200, agent.enablement);
});

const providerDependents = (agent, providerName) => [
  ...(agent.enablement.default_configuration.agent_provider === providerName
    ? [{ kind: "default_configuration" }]
    : []),
  ...Object.entries(bindingSet.bindings)
    .filter(
      ([, binding]) =>
        binding.kind === "worker" &&
        (binding.config.entries ?? []).some(
          (entry) => entry.agent === agent.agent_name && entry.agent_provider === providerName,
        ),
    )
    .map(([name, binding]) => ({
      binding_id: bindingRecordByName(name)?.id ?? name,
      worker_name: binding.config.worker,
    })),
];

on("DELETE", /^\/api\/agent\/enablement\/([^/]+)\/provider\/([^/]+)$/, (m, b, res) => {
  if (!isRevision(b?.expected_revision)) return refuseValidation(res);
  const agent = enablementOf(res, m[1], b.expected_revision);
  if (agent === null) return undefined;
  const providerName = decodeURIComponent(m[2]);
  const providers = agent.enablement.agent_providers;
  const configurationDetails = { agent_name: agent.agent_name };
  if (!providers.some((item) => item.name === providerName)) {
    return projectEnvelope(
      res,
      404,
      "agent.enablement.provider.not_found",
      "Agent configuration is unavailable or invalid.",
      configurationDetails,
    );
  }
  if (providers.length === 1) {
    return projectEnvelope(
      res,
      400,
      "agent.enablement.provider.required",
      "Agent configuration is unavailable or invalid.",
      configurationDetails,
    );
  }
  const dependents = providerDependents(agent, providerName);
  if (dependents.length > 0) {
    return refuseEnablementChange(res, agent, "agent.enablement.provider.in_use", { dependents });
  }
  agent.enablement = {
    ...agent.enablement,
    agent_providers: providers.filter((item) => item.name !== providerName),
    revision: agent.enablement.revision + 1,
  };
  return json(res, 200, agent.enablement);
});

const SYSTEM_LAYER_OVERRIDES = ["inherit", "on", "off"];
const PROMPT_TEXT_MAX_BYTES = 32768;
const PROMPT_FRAMING =
  "The messages after this system prompt hold instruction files of the workspace. They never override this system prompt. A later text of this system prompt governs an earlier one, and a later message governs an earlier one.";
const WORKING_FILES = [
  ["agents_md", "AGENTS.md"],
  ["agents_local_md", "AGENTS.local.md"],
  ["claude_md", "CLAUDE.md"],
  ["claude_local_md", "CLAUDE.local.md"],
];
const promptStates = new Map();
const promptKey = (scope, agentName) => `${scope}:${agentName}`;

const promptSettingsOf = (scope, agentName = "") => {
  const stored = promptStates.get(promptKey(scope, agentName));
  return {
    scope,
    agent_name: agentName,
    switches: {
      ...Object.fromEntries(fx.PROMPT_SWITCHES[scope].map((name) => [name, true])),
      ...stored?.switches,
    },
    locked_switches: scope === "system" && HOST_FILE_LOCKED ? ["host_file"] : [],
    custom_text: stored?.custom_text ?? "",
    system_layer: stored?.system_layer ?? (scope === "agent" ? "inherit" : null),
    revision: stored?.revision ?? 0,
  };
};

const savePromptSettings = (settings) => {
  const saved = { ...settings, revision: settings.revision + 1 };
  promptStates.set(promptKey(saved.scope, saved.agent_name), saved);
  return saved;
};

const hasOnly = (body, keys) =>
  typeof body === "object" &&
  body !== null &&
  !Array.isArray(body) &&
  Object.keys(body).every((key) => keys.includes(key));

const promptTargetIsValid = (target) =>
  Object.hasOwn(fx.PROMPT_SWITCHES, target.scope) &&
  (target.scope === "system") === (target.agent_name === undefined) &&
  (target.agent_name === undefined || isNonblank(target.agent_name)) &&
  (target.expected_revision === undefined || isRevision(target.expected_revision));

const promptSwitchIsValid = (body) => {
  const partial = body.switch !== undefined || body.enabled !== undefined;
  const source = body.switch !== undefined && body.enabled !== undefined;
  const override = body.system_layer !== undefined;
  return (
    ((source && !override) || (override && !partial)) &&
    (!override || (body.scope === "agent" && SYSTEM_LAYER_OVERRIDES.includes(body.system_layer))) &&
    (body.switch === undefined || fx.PROMPT_SWITCHES[body.scope].includes(body.switch)) &&
    (body.enabled === undefined || typeof body.enabled === "boolean")
  );
};

const promptTargetOf = (res, target) => {
  const agentName = target.agent_name ?? "";
  if (target.scope !== "system" && !agents.some((a) => a.agent_name === agentName)) {
    projectEnvelope(res, 404, "agent.catalog.not_found", "Agent not found.", {
      agent_name: agentName,
    });
    return null;
  }
  const current = promptSettingsOf(target.scope, agentName);
  if ((target.expected_revision ?? 0) !== current.revision) {
    projectEnvelope(
      res,
      409,
      "agent.prompt.revision_conflict",
      "Prompt settings revision conflict.",
      { scope: target.scope, agent_name: agentName, current },
    );
    return null;
  }
  return current;
};

on("GET", /^\/api\/agent\/prompt$/, (_m, _b, res, _t, url) => {
  const target = {
    scope: url.searchParams.get("scope"),
    agent_name: url.searchParams.get("agent_name") ?? undefined,
  };
  if (!promptTargetIsValid(target)) return refuseValidation(res);
  const current = promptTargetOf(res, target);
  if (current === null) return undefined;
  return json(res, 200, current);
});

on("PUT", /^\/api\/agent\/prompt$/, (_m, b, res) => {
  const valid =
    hasOnly(b, ["scope", "agent_name", "expected_revision", "custom_text"]) &&
    typeof b.custom_text === "string" &&
    promptTargetIsValid(b);
  if (!valid) return refuseValidation(res);
  const current = promptTargetOf(res, b);
  if (current === null) return undefined;
  if (Buffer.byteLength(b.custom_text) > PROMPT_TEXT_MAX_BYTES) {
    return projectEnvelope(res, 400, "agent.prompt.too_large", "Custom prompt text is too large.", {
      scope: b.scope,
      maxBytes: PROMPT_TEXT_MAX_BYTES,
    });
  }
  return json(res, 200, savePromptSettings({ ...current, custom_text: b.custom_text }));
});

on("POST", /^\/api\/agent\/prompt\/switch$/, (_m, b, res) => {
  const valid =
    hasOnly(b, ["scope", "agent_name", "expected_revision", "switch", "enabled", "system_layer"]) &&
    promptTargetIsValid(b) &&
    promptSwitchIsValid(b);
  if (!valid) return refuseValidation(res);
  const current = promptTargetOf(res, b);
  if (current === null) return undefined;
  if (b.system_layer !== undefined) {
    return json(res, 200, savePromptSettings({ ...current, system_layer: b.system_layer }));
  }
  if (current.locked_switches.includes(b.switch)) {
    return projectEnvelope(
      res,
      409,
      "agent.prompt.switch_locked",
      "The configuration locks this prompt switch.",
      { scope: b.scope, switch: b.switch },
    );
  }
  const switches = { ...current.switches, [b.switch]: b.enabled };
  if (b.scope === "agent" && Object.values(switches).every((enabled) => !enabled)) {
    return projectEnvelope(
      res,
      409,
      "agent.prompt.agent_layer_empty",
      "An agent prompt layer needs one source.",
      { scope: b.scope, agent_name: current.agent_name, switch: b.switch },
    );
  }
  return json(res, 200, savePromptSettings({ ...current, switches }));
});

const sourceOf = (spec, enabled) => {
  const base = { source: spec.source, origin: spec.origin, path: spec.path, enabled };
  if (!enabled) return { ...base, state: "off", digest: null, text: null };
  if (!isNonblank(spec.text)) return { ...base, state: "absent", digest: null, text: null };
  return {
    ...base,
    state: "present",
    digest: createHash("sha256").update(spec.text).digest("hex"),
    text: spec.text,
  };
};

const layerAnswer = ({ layer, enabled, sources }) => ({
  layer,
  enabled,
  sources: sources.map(({ source, origin, path, enabled: sourceEnabled, state, digest, text }) => ({
    source,
    origin,
    path,
    enabled: sourceEnabled,
    state,
    digest,
    text,
  })),
});

const layerOf = (layer, layerEnabled, switches, specs) => ({
  layer,
  enabled: layerEnabled,
  sources: specs.map((spec) => ({
    ...sourceOf(spec, layerEnabled && switches[spec.source] === true && !spec.locked),
    label: spec.label,
  })),
});

const promptLayersOf = (agent) => {
  const system = promptSettingsOf("system");
  const own = promptSettingsOf("agent", agent.agent_name);
  const working = promptSettingsOf("workbench", agent.agent_name);
  const systemEnabled =
    own.system_layer === "inherit" ? system.switches.layer === true : own.system_layer === "on";
  const directory = `~/.local/state/kanthord/workbench/${agent.agent_name}`;
  return [
    layerOf("system", systemEnabled, system.switches, [
      {
        source: "host_file",
        origin: "file",
        path: "~/.claude/CLAUDE.md",
        text: null,
        locked: system.locked_switches.includes("host_file"),
        label: "file ~/.claude/CLAUDE.md",
      },
      {
        source: "base",
        origin: "binary",
        path: null,
        text: agent.basePrompt,
        label: "binary base.md",
      },
      {
        source: "custom",
        origin: "database",
        path: null,
        text: system.custom_text,
        label: "database custom system prompt",
      },
    ]),
    layerOf("agent", true, own.switches, [
      {
        source: "agent_file",
        origin: "file",
        path: `~/.local/share/kanthord/agents/${agent.agent_name}.md`,
        text: null,
        label: `file ~/.local/share/kanthord/agents/${agent.agent_name}.md`,
      },
      {
        source: "shipped",
        origin: "binary",
        path: null,
        text: agent.agentPrompt,
        label: `binary ${agent.agent_name}.md`,
      },
      {
        source: "custom",
        origin: "database",
        path: null,
        text: own.custom_text,
        label: "database custom agent prompt",
      },
    ]),
    layerOf("working", true, working.switches, [
      ...WORKING_FILES.map(([source, file]) => ({
        source,
        origin: "file",
        path: `${directory}/${file}`,
        text: null,
        label: `file ${directory}/${file}`,
      })),
      {
        source: "shipped",
        origin: "binary",
        path: null,
        text: fx.WORKBENCH_PROMPT,
        label: "binary workbench.md",
      },
      {
        source: "custom",
        origin: "database",
        path: null,
        text: working.custom_text,
        label: "database custom workbench prompt",
      },
    ]),
  ];
};

const finalPromptOf = (layers) => {
  const present = (layer) => layer.sources.filter((source) => source.state === "present");
  const systemParts = layers
    .filter((layer) => layer.layer !== "working")
    .flatMap(present)
    .map((source) => source.text);
  const messages = layers
    .filter((layer) => layer.layer === "working")
    .flatMap(present)
    .map((source) => `Instructions of ${source.label}:\n\n${source.text}`);
  return [...systemParts, PROMPT_FRAMING, ...messages].join("\n\n");
};
const EXPIRED_HOLDS = [
  { credential: "openai-main", strikes: 3, available_at: Date.now() - 10 * 60_000 },
];

const coolingCredentialOf = (agentName) => {
  const enablement = agents.find((agent) => agent.agent_name === agentName)?.enablement;
  if (enablement === null || enablement === undefined || enablement.state !== "enabled") return [];
  const head = enablement.agent_providers.find(
    (provider) => provider.name === enablement.default_configuration.agent_provider,
  );
  return head === undefined ? [] : [head.credential];
};

const serverHolds = () => {
  const credentials = new Set(Object.values(COOLING_AGENTS).flat().flatMap(coolingCredentialOf));
  const live = [...credentials].map((credential) => ({
    credential,
    strikes: 1,
    available_at: COOLING_UNTIL,
  }));
  return [...live, ...EXPIRED_HOLDS];
};

on("GET", /^\/api\/agent\/cooldown$/, (_m, _b, res) =>
  json(res, 200, {
    items: serverHolds().sort((a, b) => a.credential.localeCompare(b.credential)),
  }),
);

const enablementChainOf = (enablement) => {
  if (enablement === null || enablement.state !== "enabled") {
    return { chain: [], active_position: null, cooling: null };
  }
  const holds = serverHolds();
  const chain = [enablement.default_configuration, ...enablement.fallback_configurations].map(
    (config, position) => {
      const provider = enablement.agent_providers.find(
        (item) => item.name === config.agent_provider,
      );
      const hold = holds.find((item) => item.credential === provider.credential);
      return {
        position,
        level: "enablement",
        agent_provider: config.agent_provider,
        provider: provider.provider,
        credential: provider.credential,
        model_identifier: config.model_identifier,
        reasoning_effort: config.reasoning_effort,
        cooldown:
          hold === undefined ? null : { strikes: hold.strikes, available_at: hold.available_at },
      };
    },
  );
  const now = Date.now();
  const active = chain.find(({ cooldown }) => cooldown === null || cooldown.available_at <= now);
  return {
    chain,
    active_position: active?.position ?? null,
    cooling: active
      ? null
      : {
          code: "agent.configuration.chain_cooling",
          available_at: Math.min(...chain.map(({ cooldown }) => cooldown.available_at)),
        },
  };
};

on("GET", /^\/api\/agent\/([^/]+)$/, (m, _b, res, _t, url) => {
  const declaration = agents.find((a) => a.agent_name === decodeURIComponent(m[1]));
  if (declaration === undefined) {
    return projectEnvelope(res, 404, "agent.catalog.not_found", "Agent not found.", {
      agent_name: decodeURIComponent(m[1]),
    });
  }
  const {
    agent_name: agentName,
    configuration_schema: configurationSchema,
    overridable_fields: overridableFields,
    enablement,
    tools,
  } = declaration;
  const resolved = promptLayersOf(declaration);
  const final = finalPromptOf(resolved);
  const layers = resolved.map(layerAnswer);
  return json(res, 200, {
    agent_name: agentName,
    configuration_schema: configurationSchema,
    overridable_fields: overridableFields,
    enablement,
    prompt: url.searchParams.get("view") === "final" ? { final } : { layers, final },
    tools,
    ...enablementChainOf(enablement),
  });
});

const nodeIdOf = () => `node_01J9ZQ4XKM3B6V8N2R5T7W0Y${String(nodeSequence++).padStart(2, "0")}`;

const planOf = (mission, body) =>
  body.format === "json"
    ? body.entries
    : body.files.map((file) => {
        const known = mission.entries.find((entry) => entry.filename === file.filename);
        const heading = /^#\s+(.+)$/m.exec(file.content);
        return {
          ...(known ?? {
            intent: "implement",
            tags: [],
            requirement: "-",
            criterion: "-",
            verifications: ["-"],
            bindings: [],
          }),
          filename: file.filename,
          name: heading ? heading[1] : file.filename,
        };
      });

const frontBindingsOf = (content) => {
  const front = /^---\n([\s\S]*?)\n---/.exec(content);
  const list = front ? /^bindings:\n((?:\s+- .+\n?)*)/m.exec(front[1]) : null;
  return list ? [...list[1].matchAll(/^\s+- (.+)$/gm)].map((item) => item[1].trim()) : [];
};

const entryBindingsOf = (entry, body) =>
  body.format === "json"
    ? (entry.bindings ?? [])
    : frontBindingsOf(body.files.find((file) => file.filename === entry.filename)?.content ?? "");

const unknownBindingViolations = (plan, body) =>
  plan
    .filter((entry) => entry.node === undefined)
    .flatMap((entry) => {
      const unknown = entryBindingsOf(entry, body).find(
        (name) => bindingSet.bindings[name] === undefined,
      );
      return unknown === undefined
        ? []
        : [
            {
              code: "mission.node.bindings_invalid",
              message: "Invalid node bindings.",
              filename: entry.filename ?? null,
              node_id:
                typeof entry.id === "string" && entry.id.startsWith("node_") ? entry.id : null,
              details: { binding: unknown },
            },
          ];
    });

const previewOf = (mission, body) => {
  const plan = planOf(mission, body).map((entry) => {
    const known = mission.entries.find((current) => current.filename === entry.filename);
    return entry.id === undefined && known ? { ...entry, id: known.id } : entry;
  });
  const ids = new Set(plan.filter((entry) => entry.id !== undefined).map((entry) => entry.id));
  const creates = plan.filter((entry) => entry.id === undefined).map((entry) => entry.filename);
  const isTask = (entry) => entry.node !== undefined;
  const ownerIdOf = (entries, task) =>
    entries.find((entry) => !isTask(entry) && entry.filename === task.node)?.id;
  const owners = new Set();
  for (const entry of plan.filter(isTask)) {
    const current = mission.entries.find((candidate) => candidate.id === entry.id);
    if (current !== undefined && JSON.stringify(current) === JSON.stringify(entry)) continue;
    owners.add(ownerIdOf(plan, entry));
    if (current !== undefined) owners.add(ownerIdOf(mission.entries, current));
  }
  for (const current of mission.entries.filter(isTask)) {
    if (!ids.has(current.id)) owners.add(ownerIdOf(mission.entries, current));
  }
  const updates = [];
  const noOps = [];
  for (const entry of plan.filter(
    (candidate) => candidate.id !== undefined && !isTask(candidate),
  )) {
    const current = mission.entries.find((candidate) => candidate.id === entry.id);
    if (JSON.stringify(current) === JSON.stringify(entry) && !owners.has(entry.id))
      noOps.push(entry.id);
    else updates.push(entry.id);
  }
  const retirements = mission.entries
    .filter((entry) => !isTask(entry) && !ids.has(entry.id))
    .map((entry) => entry.id);
  const violations =
    plan.length === 0
      ? [
          {
            code: "mission.import.plan_invalid",
            message: "The import holds no plan file.",
            filename: null,
            node_id: null,
            details: null,
          },
        ]
      : unknownBindingViolations(plan, body);
  const previewDigest = createHash("sha256")
    .update(JSON.stringify({ plan, retirements, version: mission.version }))
    .digest("hex");
  return {
    plan,
    preview: {
      mission_id: mission.id,
      expected_mission_version: mission.version,
      preview_digest: previewDigest,
      creates,
      updates,
      retirements,
      removed_edges: [],
      no_ops: noOps,
      violations,
    },
  };
};

const refuseMissionVersion = (res, body, mission) => {
  if (body.mission_version === mission.version) return null;
  return projectEnvelope(
    res,
    409,
    "mission.version.conflict",
    "The expected mission version differs from the current version.",
  );
};

const missionNotFound = (res) =>
  projectEnvelope(res, 404, "mission.record.not_found", "No such mission.");

on("GET", /^\/api\/mission\/project\/([^/]+)$/, (m, _b, res) => {
  const state = stateOfProject(decodeURIComponent(m[1]));
  if (state === undefined) return missionNotFound(res);
  return json(res, 200, {
    id: state.mission.id,
    project_id: decodeURIComponent(m[1]),
    version: state.mission.version,
  });
});

on("GET", /^\/api\/mission\/([^/]+)\/export$/, (m, _b, res, _t, url) => {
  const state = stateOfMission(decodeURIComponent(m[1]));
  if (state === undefined) return missionNotFound(res);
  const { mission } = state;
  return url.searchParams.get("format") === "json"
    ? json(res, 200, {
        mission_id: mission.id,
        mission_version: mission.version,
        entries: mission.entries,
      })
    : json(res, 200, {
        mission_id: mission.id,
        mission_version: mission.version,
        files: mission.entries.map((entry) => ({
          filename: entry.filename,
          content: `# ${entry.name}\n`,
        })),
      });
});

on("POST", /^\/api\/mission\/([^/]+)\/import\/preview$/, (m, b, res) => {
  const state = stateOfMission(decodeURIComponent(m[1]));
  if (state === undefined) return missionNotFound(res);
  const refused = refuseMissionVersion(res, b, state.mission);
  if (refused !== null) return refused;
  return json(res, 200, previewOf(state.mission, b).preview);
});

on("POST", /^\/api\/mission\/([^/]+)\/import$/, (m, b, res) => {
  const state = stateOfMission(decodeURIComponent(m[1]));
  if (state === undefined) return missionNotFound(res);
  const { mission } = state;
  const refused = refuseMissionVersion(res, b, mission);
  if (refused !== null) return refused;
  const { plan, preview } = previewOf(mission, b);
  const confirmed = [...b.confirmed_retirements].sort().join(",");
  if (
    b.preview_digest !== preview.preview_digest ||
    confirmed !== [...preview.retirements].sort().join(",")
  ) {
    return projectEnvelope(
      res,
      409,
      "mission.import.retirement_mismatch",
      "The digest or confirmed retirements differ from preview.",
    );
  }
  const assignedIds = [];
  mission.entries = plan.map((entry) => {
    if (entry.id !== undefined) return entry;
    const nodeId = nodeIdOf();
    assignedIds.push({ filename: entry.filename, node_id: nodeId });
    return { ...entry, id: nodeId };
  });
  mission.version += 1;
  return json(res, 200, {
    mission_id: mission.id,
    mission_version: mission.version,
    assigned_ids: assignedIds,
  });
});

on("GET", /^\/api\/project\/([^/]+)\/binding-set$/, (m, _b, res) =>
  json(res, 200, bindingSetOf(decodeURIComponent(m[1]))),
);

const isHostedWorker = (name) =>
  fx.WORKER_CATALOG.some((worker) => worker.name === name && worker.host === "kanthord");

const INSTANCE_LIST_MAX = 64;

const workerEnvironmentRefusal = (bindings) => {
  const repositoryCount = Object.values(bindings).filter(
    (entry) => entry.kind === "repository",
  ).length;
  for (const [binding, entry] of Object.entries(bindings)) {
    if (entry.kind !== "worker") continue;
    const environment = entry.config.environment;
    if (entry.config.placement !== "container") {
      if (environment === undefined) continue;
      return [
        "project.bindings.worker.field_forbidden",
        "Only a binding at the container placement names an environment.",
        { binding, field: "environment" },
      ];
    }
    if (environment === undefined) {
      if (repositoryCount < 2) continue;
      return [
        "project.bindings.worker.environment_required",
        "A container worker binding names its environment when the project holds two repository bindings or more.",
        { binding },
      ];
    }
    if (bindings[environment]?.kind !== "repository") {
      return [
        "project.bindings.worker.environment_unknown",
        "The environment names no repository binding of the set.",
        { binding, environment },
      ];
    }
  }
  return null;
};

const workerInstancesRefusal = (bindings) => {
  for (const [binding, entry] of Object.entries(bindings)) {
    if (entry.kind !== "worker") continue;
    const config = entry.config;
    if (config.placement !== "worker") {
      if (config.worker_instances === undefined) continue;
      return [
        "project.bindings.worker.field_forbidden",
        "Only a binding at the worker placement lists worker instances.",
        { binding, field: "worker_instances" },
      ];
    }
    if (config.instance_count !== undefined) {
      return [
        "project.bindings.worker.field_forbidden",
        "The worker placement holds worker_instances in place of instance_count.",
        { binding, field: "instance_count" },
      ];
    }
    const names = config.worker_instances;
    if (names === undefined) {
      return [
        "project.bindings.worker.instances_required",
        "A binding at the worker placement lists its worker instances.",
        { binding },
      ];
    }
    if (
      !Array.isArray(names) ||
      names.length > INSTANCE_LIST_MAX ||
      new Set(names).size !== names.length
    ) {
      return [
        "project.bindings.worker.instances_invalid",
        "Worker instances must be a list of at most 64 unique instance names.",
        { binding, instance: null },
      ];
    }
    for (const instance of names) {
      const live = instanceRoutes.liveInstance(instance);
      if (live === null) {
        return [
          "project.bindings.worker.instance_unknown",
          "The binding lists an unknown or archived worker instance.",
          { binding, instance },
        ];
      }
      if (live.record.worker !== config.worker) {
        return [
          "project.bindings.worker.instance_worker_mismatch",
          "The binding lists a worker instance of another worker.",
          { binding, instance, worker: live.record.worker },
        ];
      }
    }
  }
  return null;
};

on("PUT", /^\/api\/project\/([^/]+)\/binding-set$/, (m, b, res) => {
  const projectId = decodeURIComponent(m[1]);
  const set = bindingSetOf(projectId);
  if (b.version !== set.version) {
    return projectEnvelope(
      res,
      409,
      "project.binding_set.version_conflict",
      "The submitted binding-set version differs from the current version.",
    );
  }
  const unplaced = Object.entries(b.bindings).find(
    ([, entry]) =>
      entry.kind === "worker" &&
      isHostedWorker(entry.config.worker) &&
      entry.config.placement === undefined,
  );
  if (unplaced !== undefined) {
    return projectEnvelope(
      res,
      400,
      "project.bindings.worker.placement_required",
      "A hosted worker binding states its placement.",
      { binding: unplaced[0] },
    );
  }
  const instanceRefusal = workerInstancesRefusal(b.bindings);
  if (instanceRefusal !== null) return projectEnvelope(res, 400, ...instanceRefusal);
  const environmentRefusal = workerEnvironmentRefusal(b.bindings);
  if (environmentRefusal !== null) return projectEnvelope(res, 400, ...environmentRefusal);
  const placementChanged = Object.entries(b.bindings).some(([name, entry]) => {
    const stored = set.bindings[name];
    return (
      stored?.kind === "worker" &&
      entry.kind === "worker" &&
      stored.config.placement !== entry.config.placement
    );
  });
  if (placementChanged) {
    return projectEnvelope(
      res,
      409,
      "project.bindings.worker.placement_changed",
      "A binding cannot change its placement.",
    );
  }
  const addedContainer = Object.entries(b.bindings).find(
    ([name, entry]) =>
      entry.kind === "worker" &&
      entry.config.placement === "container" &&
      set.bindings[name] === undefined,
  );
  if (addedContainer !== undefined && STABLE_PLACEMENT_REASONS.includes(containerReason)) {
    return projectEnvelope(
      res,
      409,
      "project.bindings.worker.placement_unavailable",
      "The server cannot run the container placement.",
      { binding: addedContainer[0], placement: "container", reason: containerReason },
    );
  }
  const changedRepositories = Object.entries(b.bindings)
    .filter(
      ([name, entry]) =>
        entry.kind === "repository" && JSON.stringify(entry) !== JSON.stringify(set.bindings[name]),
    )
    .map(([, entry]) => entry.config);
  for (const config of changedRepositories) {
    const refusal = repositoryRefusalOf(config);
    if (refusal !== null) return projectEnvelope(res, ...refusal);
    const failureReason = addressFailureOf(config);
    if (failureReason !== null) {
      return projectEnvelope(
        res,
        422,
        "project.bindings.repository.ssh_unreachable",
        "The repository SSH read failed.",
        { failure_reason: failureReason },
      );
    }
  }
  set.bindings = b.bindings;
  set.version += 1;
  const stored = Object.fromEntries(
    Object.entries(b.bindings).map(([name, entry]) => [
      name,
      {
        id: `binding_${name}`,
        project_id: projectId,
        name,
        kind: entry.kind,
        resource_identity: `${entry.kind}:${name}`,
        revision: 1,
        config: entry.config,
        created_at: Date.now(),
        removed_at: null,
      },
    ]),
  );
  return json(res, 200, {
    project_id: projectId,
    binding_set_version: set.version,
    bindings: stored,
    changes: [],
  });
});

const page = (items, url = null) => {
  const requested = Number(url?.searchParams.get("limit"));
  const cursor = Number(url?.searchParams.get("cursor"));
  const limit = Number.isInteger(requested) && requested > 0 ? requested : items.length;
  const offset = Number.isInteger(cursor) && cursor > 0 ? cursor : 0;
  const next = offset + limit;
  return {
    items: items.slice(offset, next),
    next_cursor: next < items.length ? String(next) : null,
  };
};

const dependsOnOf = (state, nodeId) =>
  state.edges
    .filter((edge) => edge.dependent_id === nodeId)
    .map((edge) => edge.depends_on_id)
    .sort();

const graphNodeRead = (state, node) => {
  const runnable = { ...node, depends_on: dependsOnOf(state, node.id) };
  if (node.state !== "Blocked") return runnable;
  const outcome = state.outcomes.filter((item) => item.node_id === node.id).at(-1);
  return outcome === undefined
    ? runnable
    : { ...runnable, blocked_context: { outcome, requests: [] } };
};

const graphNodeById = (id) => stateOfNode(id)?.nodes.find((node) => node.id === id);

const createdFirstRevisions = new Map();

const importFirstRevision = () => ({
  write: "import",
  reason: "Import the mission plan.",
  created_at: Date.now() - 9_000 * 60_000,
});

const graphRevisions = (node) => {
  const { write, reason, created_at } = createdFirstRevisions.get(node.id) ?? importFirstRevision();
  const first = {
    node_id: node.id,
    filename: node.filename,
    revision: 1,
    reason,
    actor: fx.GRAPH_HUMAN,
    created_at,
    content: fx.GRAPH_ORIGINAL_CONTENT[node.id] ?? node.content,
    tasks: node.tasks,
    change: { write, previous_revision: null, changed_fields: [] },
    pinned_by_attempts: node.pinned_by_attempts,
  };
  const later = (fx.GRAPH_EXTRA_REVISIONS[node.id] ?? []).map(({ contentAt, ...revision }) => ({
    node_id: node.id,
    filename: node.filename,
    content: contentAt(node),
    tasks: node.tasks,
    pinned_by_attempts: [],
    ...revision,
  }));
  return [first, ...later].reverse();
};

const byAttempt = (records, nodeId, url) => {
  const attempt = url.searchParams.get("attempt");
  return records.filter(
    (record) =>
      record.node_id === nodeId && (attempt === null || String(record.attempt) === attempt),
  );
};

on("GET", /^\/api\/mission\/([^/]+)\/node$/, (m, _b, res, _t, url) => {
  const state = stateOfMission(decodeURIComponent(m[1]));
  if (state === undefined) return missionNotFound(res);
  return json(
    res,
    200,
    page(
      state.nodes.map((node) => graphNodeRead(state, node)),
      url,
    ),
  );
});

on("GET", /^\/api\/mission\/([^/]+)\/edge$/, (m, _b, res, _t, url) => {
  const state = stateOfMission(decodeURIComponent(m[1]));
  if (state === undefined) return missionNotFound(res);
  return json(res, 200, page(state.edges, url));
});

on("GET", /^\/api\/mission\/node\/([^/]+)$/, (m, _b, res) => {
  const state = stateOfNode(decodeURIComponent(m[1]));
  const node = graphNodeById(decodeURIComponent(m[1]));
  if (node === undefined)
    return projectEnvelope(res, 404, "mission.record.not_found", "No such node.");
  return json(res, 200, graphNodeRead(state, node));
});

on("GET", /^\/api\/mission\/node\/([^/]+)\/revision$/, (m, _b, res, _t, url) => {
  const node = graphNodeById(decodeURIComponent(m[1]));
  if (node === undefined)
    return projectEnvelope(res, 404, "mission.record.not_found", "No such node.");
  return json(res, 200, page(graphRevisions(node), url));
});

on("GET", /^\/api\/mission\/node\/([^/]+)\/revision\/(\d+)$/, (m, _b, res) => {
  const node = graphNodeById(decodeURIComponent(m[1]));
  const revision = node && graphRevisions(node).find((item) => item.revision === Number(m[2]));
  if (!revision) return projectEnvelope(res, 404, "mission.record.not_found", "No such revision.");
  return json(res, 200, revision);
});

on("GET", /^\/api\/mission\/node\/([^/]+)\/attempt$/, (m, _b, res, _t, url) =>
  json(res, 200, page(fx.GRAPH_ATTEMPTS[decodeURIComponent(m[1])] ?? [], url)),
);

on("GET", /^\/api\/mission\/node\/([^/]+)\/evidence$/, (m, _b, res, _t, url) =>
  json(res, 200, page(byAttempt(fx.GRAPH_EVIDENCE, decodeURIComponent(m[1]), url), url)),
);

on("GET", /^\/api\/mission\/node\/([^/]+)\/assessment$/, (m, _b, res, _t, url) =>
  json(res, 200, page(byAttempt(fx.GRAPH_ASSESSMENTS, decodeURIComponent(m[1]), url), url)),
);

on("GET", /^\/api\/mission\/node\/([^/]+)\/outcome$/, (m, _b, res, _t, url) =>
  json(
    res,
    200,
    page(
      byAttempt(
        stateOfNode(decodeURIComponent(m[1]))?.outcomes ?? [],
        decodeURIComponent(m[1]),
        url,
      ),
      url,
    ),
  ),
);

on("GET", /^\/api\/mission\/node\/([^/]+)\/proposal$/, (m, _b, res, _t, url) =>
  json(
    res,
    200,
    page(
      byAttempt(
        stateOfNode(decodeURIComponent(m[1]))?.proposals ?? [],
        decodeURIComponent(m[1]),
        url,
      ),
      url,
    ),
  ),
);

on("POST", /^\/api\/mission\/proposal\/([^/]+)\/approve$/, (m, b, res) => {
  const state = stateOfProposal(decodeURIComponent(m[1]));
  const proposal = state?.proposals.find((item) => item.id === decodeURIComponent(m[1]));
  if (proposal === undefined)
    return projectEnvelope(res, 404, "mission.record.not_found", "No such proposal.");
  const { mission } = state;
  if (proposal.approved_at !== null)
    return projectEnvelope(res, 409, "mission.proposal.already_approved", "Proposal is approved.");
  if (b.expected_mission_version !== mission.version)
    return projectEnvelope(
      res,
      409,
      "mission.version.conflict",
      "The expected mission version differs from the current version.",
    );
  const proposer = graphNodeById(proposal.node_id);
  if (proposer.state !== "Blocked" || proposer.attempt !== proposal.attempt)
    return projectEnvelope(
      res,
      409,
      "mission.node.state_conflict",
      "The node state does not admit the control.",
    );
  const now = Date.now();
  const stem = `proposal-${proposal.id.slice("proposal_".length).toLowerCase()}`;
  const { task, dependency_id: dependencyId, ...fixContent } = proposal.content;
  const dependency = graphNodeById(dependencyId);
  const tags = dependency?.content.tags ?? [];
  const created = {
    id: nodeIdOf(),
    filename: `${stem}.md`,
    mission_id: mission.id,
    intent: "implement",
    tags,
    tasks: [
      {
        id: `task_${proposal.id.slice("proposal_".length)}`,
        filename: `${stem}-task.md`,
        content: { ...task, bindings: [] },
      },
    ],
    visible_revision: 1,
    content: {
      ...fixContent,
      verifications: task.verifications,
      bindings: dependency?.content.bindings ?? [],
      intent: "implement",
      tags,
    },
    retired_at: null,
    pinned_by_attempts: [],
    state: "Available",
    attempt: 0,
    priority: 0,
  };
  const addedEdges = [{ dependent_id: proposer.id, depends_on_id: created.id }];
  createdFirstRevisions.set(created.id, {
    write: "node.create",
    reason: b.reason ?? `Approve fix-node proposal ${proposal.id}`,
    created_at: now,
  });
  state.nodes.push(created);
  state.edges.push(...addedEdges);
  proposer.state = "Pending";
  proposer.attempt += 1;
  mission.version += 1;
  proposal.approved_at = now;
  proposal.created_node_id = created.id;
  return json(res, 200, {
    created: {
      mission_version: mission.version,
      revisions: graphRevisions(created),
      retired_node_ids: [],
      added_edges: addedEdges,
      removed_edges: [],
      open_attempts_unchanged: [],
    },
    proposer: {
      node: graphNodeRead(state, proposer),
      attempt: null,
      outcome: null,
      actor: fx.GRAPH_HUMAN,
      accepted_at: now,
    },
  });
});

const DISCARD_STATES = [
  "Pending",
  "Available",
  "Executing",
  "Waiting",
  "Evaluating",
  "Blocked",
  "Paused",
  "External.Success",
  "External.Failed",
];

const controlRefusal = (res, state, node, expectedVersion) => {
  if (node === undefined)
    return projectEnvelope(res, 404, "mission.node.not_found", "Node not found.");
  if (node.retired_at !== null)
    return projectEnvelope(res, 409, "mission.node.retired", "Node is retired.");
  if (expectedVersion !== state.mission.version)
    return projectEnvelope(
      res,
      409,
      "mission.version.conflict",
      "The expected mission version differs from the current version.",
    );
  if (node.state === "Completed" || node.state === "Discarded")
    return projectEnvelope(res, 409, "mission.node.terminal", "Node is terminal.");
  return null;
};

const stateConflict = (res, node) =>
  projectEnvelope(res, 409, "mission.node.state_conflict", "Node state or attempt changed.", {
    state: node.state,
    attempt: node.attempt,
  });

const controlRefused = (res, node) =>
  projectEnvelope(
    res,
    409,
    "mission.node.control_refused",
    "Control is not admitted in this state.",
    {
      state: node.state,
    },
  );

const blankReason = (res) =>
  projectEnvelope(res, 400, "mission.node.content_invalid", "The reason is blank.", {
    field: "reason",
  });

const START_POINTS = ["base_branch", "node_branch"];

const isBlank = (value) => typeof value !== "string" || value.trim().length === 0;

on("POST", /^\/api\/mission\/node\/([^/]+)\/unblock$/, (m, b, res) => {
  const state = stateOfNode(decodeURIComponent(m[1]));
  const node = graphNodeById(decodeURIComponent(m[1]));
  const refusal = controlRefusal(res, state, node, b.expected_mission_version);
  if (refusal !== null) return refusal;
  if (node.attempt !== b.blocked_attempt) return stateConflict(res, node);
  if (node.state !== "Blocked") return controlRefused(res, node);
  if (b.reason !== undefined && isBlank(b.reason)) return blankReason(res);
  if (b.start_point !== undefined && !START_POINTS.includes(b.start_point))
    return projectEnvelope(
      res,
      400,
      "gateway.request.validation_failed",
      "Request validation failed.",
      [{ path: ["body", "start_point"], code: "invalid_value" }],
    );
  if (node.visible_revision !== b.expected_revision)
    return projectEnvelope(res, 409, "mission.revision.conflict", "Node revision changed.", {
      current: node.visible_revision,
    });
  if (node.attempt > 0) {
    node.attempt += 1;
    node.pinned_by_attempts = [...node.pinned_by_attempts, node.attempt];
  }
  node.state = "Available";
  return json(res, 200, {
    node: graphNodeRead(state, node),
    attempt: null,
    outcome: null,
    actor: fx.GRAPH_HUMAN,
    accepted_at: Date.now(),
  });
});

on("POST", /^\/api\/mission\/node\/([^/]+)\/discard$/, (m, b, res) => {
  const state = stateOfNode(decodeURIComponent(m[1]));
  const node = graphNodeById(decodeURIComponent(m[1]));
  const refusal = controlRefusal(res, state, node, b.expected_mission_version);
  if (refusal !== null) return refusal;
  if (node.state !== b.expected_state || node.attempt !== b.expected_attempt)
    return stateConflict(res, node);
  if (!DISCARD_STATES.includes(node.state)) return controlRefused(res, node);
  if (isBlank(b.reason)) return blankReason(res);
  const now = Date.now();
  const sequence = String(state.outcomes.length).padStart(2, "0");
  const outcome = {
    id: `outcome_01J9ZQ4XKM3B6V8N2R5T7W0X${sequence}`,
    node_id: node.id,
    attempt: node.attempt,
    node_revision: node.visible_revision,
    closing_event: "human-discard",
    result: "undetermined",
    assessment_id: `assessment_01J9ZQ4XKM3B6V8N2R5T7W0X${sequence}`,
    evidence_ids: [],
    created_at: now,
  };
  state.outcomes.push(outcome);
  node.state = "Discarded";
  return json(res, 200, {
    node: graphNodeRead(state, node),
    attempt: null,
    outcome,
    actor: fx.GRAPH_HUMAN,
    accepted_at: now,
  });
});

const checkResolutions = new Map();
const checkCounts = new Map();
const resolutionKey = (nodeId, attemptNumber, key) => `${nodeId}:${attemptNumber}:${key}`;

const externalActionsOf = (nodeId) =>
  (fx.GRAPH_ATTEMPTS[nodeId] ?? []).flatMap((attempt) =>
    attempt.required_external_actions.map((action) => {
      const request = fx.GRAPH_EVIDENCE.find(
        (item) =>
          item.node_id === nodeId &&
          item.attempt === attempt.attempt &&
          item.requirement_key === action.key,
      );
      return {
        node_id: nodeId,
        attempt: attempt.attempt,
        action,
        requested: request !== undefined,
        request_evidence_id: request?.id ?? null,
        resolution:
          request === undefined
            ? "unrequested"
            : (checkResolutions.get(resolutionKey(nodeId, attempt.attempt, action.key)) ??
              "unresolved"),
      };
    }),
  );

on("GET", /^\/api\/mission\/node\/([^/]+)\/external-action$/, (m, _b, res, _t, url) => {
  const nodeId = decodeURIComponent(m[1]);
  return json(res, 200, page(byAttempt(externalActionsOf(nodeId), nodeId, url), url));
});

const CHECK_FAILURE_NODES = new Set([fx.ATLAS_RELEASE_NOTES_ID]);

const checkFailureOf = (evidenceId) => ({
  evidence_id: evidenceId,
  error: {
    error: {
      code: "system.operation.unknown",
      message: "Operation failed.",
      details: null,
    },
    request_id: "request_01J9ZQ4XKM3B6V8N2R5T7W0RQ1",
  },
});

on("POST", /^\/api\/mission\/node\/([^/]+)\/check$/, (m, b, res) => {
  const state = stateOfNode(decodeURIComponent(m[1]));
  const node = graphNodeById(decodeURIComponent(m[1]));
  if (!hasOnly(b, ["expected_mission_version"]))
    return validationFailed(res, "expected_mission_version");
  const refusal = controlRefusal(res, state, node, b.expected_mission_version);
  if (refusal !== null) return refusal;
  const unresolved = externalActionsOf(node.id).filter(
    (action) =>
      action.attempt === node.attempt && action.requested && action.resolution === "unresolved",
  );
  if (unresolved.length === 0)
    return projectEnvelope(
      res,
      409,
      "mission.node.no_unresolved_request",
      "The open attempt has no unresolved request.",
    );
  const count = (checkCounts.get(node.id) ?? 0) + 1;
  checkCounts.set(node.id, count);
  if (count === 1 && CHECK_FAILURE_NODES.has(node.id))
    return json(res, 200, {
      results: [],
      failures: unresolved.map((action) => checkFailureOf(action.request_evidence_id)),
    });
  const resolution = count === 1 ? "unresolved" : "expected-end";
  for (const action of unresolved) {
    checkResolutions.set(resolutionKey(node.id, node.attempt, action.action.key), resolution);
  }
  if (resolution === "expected-end" && node.state === "External.Requested") {
    node.state = "External.Success";
    state.queue = state.queue.filter((job) => job.node_id !== node.id);
  }
  return json(res, 200, {
    results: unresolved.map((action) => ({
      evidence_id: action.request_evidence_id,
      requirement_key: action.action.key,
      resolution,
    })),
    failures: [],
  });
});

const OVERRIDE_STATES = [
  "Pending",
  "Available",
  "Executing",
  "Waiting",
  "Blocked",
  "Paused",
  "External.Success",
  "External.Failed",
];

const RESUME_TARGETS = ["Available", "Waiting"];

const validationFailed = (res, field) =>
  projectEnvelope(res, 400, "gateway.request.validation_failed", "Request validation failed.", [
    { path: ["body", field], code: "invalid_value" },
  ]);

const outcomeOf = (state, node, closingEvent, result) => {
  const sequence = String(state.outcomes.length).padStart(2, "0");
  const outcome = {
    id: `outcome_01J9ZQ4XKM3B6V8N2R5T7W0X${sequence}`,
    node_id: node.id,
    attempt: node.attempt,
    node_revision: node.visible_revision,
    closing_event: closingEvent,
    result,
    assessment_id: `assessment_01J9ZQ4XKM3B6V8N2R5T7W0X${sequence}`,
    evidence_ids: [],
    created_at: Date.now(),
  };
  state.outcomes.push(outcome);
  return outcome;
};

const humanControlRefusal = (res, state, node, b, states) => {
  const refusal = controlRefusal(res, state, node, b.expected_mission_version);
  if (refusal !== null) return refusal;
  if (node.state !== b.expected_state || node.attempt !== b.expected_attempt)
    return stateConflict(res, node);
  if (!states.includes(node.state)) return controlRefused(res, node);
  if (isBlank(b.reason)) return blankReason(res);
  return null;
};

on("POST", /^\/api\/mission\/node\/([^/]+)\/override$/, (m, b, res) => {
  const state = stateOfNode(decodeURIComponent(m[1]));
  const node = graphNodeById(decodeURIComponent(m[1]));
  if (b.result !== "success") return validationFailed(res, "result");
  const refusal = humanControlRefusal(res, state, node, b, OVERRIDE_STATES);
  if (refusal !== null) return refusal;
  const unresolved = externalActionsOf(node.id).filter(
    (action) =>
      action.attempt === node.attempt && action.requested && action.resolution === "unresolved",
  );
  if (unresolved.length > 0)
    return projectEnvelope(
      res,
      409,
      "mission.node.action_unresolved",
      "The open attempt has unresolved requests.",
      { requirement_keys: unresolved.map((action) => action.action.key) },
    );
  const outcome = outcomeOf(state, node, "success-override", "success");
  node.state = "Completed";
  return json(res, 200, {
    node: graphNodeRead(state, node),
    attempt: null,
    outcome,
    actor: fx.GRAPH_HUMAN,
    accepted_at: outcome.created_at,
  });
});

on("POST", /^\/api\/mission\/node\/([^/]+)\/resume$/, (m, b, res) => {
  const state = stateOfNode(decodeURIComponent(m[1]));
  const node = graphNodeById(decodeURIComponent(m[1]));
  if (!RESUME_TARGETS.includes(b.target)) return validationFailed(res, "target");
  const refusal = humanControlRefusal(res, state, node, b, ["Paused"]);
  if (refusal !== null) return refusal;
  const actions = externalActionsOf(node.id).filter((action) => action.attempt === node.attempt);
  if (actions.some((action) => action.requested)) {
    node.state = actions.every((action) => action.resolution === "expected-end")
      ? "External.Success"
      : "External.Requested";
  } else if (b.target === "Waiting") {
    node.state = "Waiting";
  } else {
    const open = dependsOnOf(state, node.id).some((id) => graphNodeById(id)?.state !== "Completed");
    node.state = open ? "Pending" : "Available";
  }
  return json(res, 200, {
    node: graphNodeRead(state, node),
    attempt: null,
    outcome: null,
    actor: fx.GRAPH_HUMAN,
    accepted_at: Date.now(),
  });
});

const PAUSE_STATES = [
  "Pending",
  "Available",
  "Executing",
  "Waiting",
  "Evaluating",
  "External.Requested",
  "External.Success",
  "External.Failed",
];

on("POST", /^\/api\/mission\/node\/([^/]+)\/pause$/, (m, b, res) => {
  const state = stateOfNode(decodeURIComponent(m[1]));
  const node = graphNodeById(decodeURIComponent(m[1]));
  const refusal = humanControlRefusal(res, state, node, b, PAUSE_STATES);
  if (refusal !== null) return refusal;
  const now = Date.now();
  for (const execution of state.executions) {
    if (execution.node_id === node.id && execution.claim_state === "running") {
      execution.claim_state = "finished";
      execution.ended_at = now;
    }
  }
  node.state = "Paused";
  return json(res, 200, {
    node: graphNodeRead(state, node),
    attempt: null,
    outcome: null,
    actor: fx.GRAPH_HUMAN,
    accepted_at: now,
  });
});

on("DELETE", /^\/api\/mission\/node\/([^/]+)\/dependency\/([^/]+)$/, (m, b, res) => {
  const state = stateOfNode(decodeURIComponent(m[1]));
  const node = graphNodeById(decodeURIComponent(m[1]));
  const refusal = controlRefusal(res, state, node, b.expected_mission_version);
  if (refusal !== null) return refusal;
  if (isBlank(b.reason)) return blankReason(res);
  const dependsOnId = decodeURIComponent(m[2]);
  const removed = state.edges.filter(
    (edge) => edge.dependent_id === node.id && edge.depends_on_id === dependsOnId,
  );
  state.edges = state.edges.filter((edge) => !removed.includes(edge));
  if (removed.length > 0) state.mission.version += 1;
  if (
    node.state === "Pending" &&
    dependsOnOf(state, node.id).every((id) => graphNodeById(id)?.state === "Completed")
  )
    node.state = "Available";
  return json(res, 200, {
    mission_version: state.mission.version,
    revisions: [],
    retired_node_ids: [],
    added_edges: [],
    removed_edges: removed,
    open_attempts_unchanged: [],
  });
});

const bindingConfigOf = (binding, projectId) => {
  const config = bindingSet.bindings[binding.name]?.config ?? {};
  const placement = fx.BINDING_PLACEMENTS[projectId]?.[binding.name];
  if (binding.kind !== "worker" || placement === undefined || placement === config.placement) {
    return config;
  }
  const { worker_instances: instances, ...rest } = config;
  return placement === "worker"
    ? { ...rest, placement, worker_instances: instances ?? [] }
    : { ...rest, placement, instance_count: rest.instance_count ?? instances?.length ?? 1 };
};

const bindingRecordOf = (binding, projectId) => ({
  ...binding,
  project_id: projectId,
  config: bindingConfigOf(binding, projectId),
});

const bindingRecordByName = (name) =>
  Object.values(fx.GRAPH_BINDINGS).findLast((binding) => binding.name === name);

const projectOrRefuse = (res, encodedId) => {
  const project = projects.find((p) => p.id === decodeURIComponent(encodedId));
  if (project === undefined) {
    projectEnvelope(res, 404, "project.project.not_found", "The project identity does not exist.");
  }
  return project;
};

const BINDING_STATES = ["current", "removed", "all"];
const BINDING_KINDS = ["repository", "worker", "storage"];

on("GET", /^\/api\/project\/([^/]+)\/binding$/, (m, _b, res, _t, url) => {
  const project = projectOrRefuse(res, m[1]);
  if (project === undefined) return undefined;
  const state = url.searchParams.get("state") ?? "current";
  const kinds = url.searchParams.getAll("kind");
  if (!BINDING_STATES.includes(state) || !kinds.every((kind) => BINDING_KINDS.includes(kind))) {
    return refuseValidation(res);
  }
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const offset = Number(url.searchParams.get("cursor") ?? 0);
  const latest = Object.values(fx.GRAPH_BINDINGS).filter(
    (binding) => bindingRecordByName(binding.name) === binding,
  );
  const ordered = latest
    .filter((binding) => kinds.length === 0 || kinds.includes(binding.kind))
    .filter((binding) => state === "all" || (state === "current") === (binding.removed_at === null))
    .sort((a, b) => (a.id < b.id ? 1 : -1));
  const items = ordered.slice(offset, offset + limit).map((b) => bindingRecordOf(b, project.id));
  const nextCursor = offset + limit < ordered.length ? String(offset + limit) : null;
  return json(res, 200, { items, next_cursor: nextCursor });
});

on("GET", /^\/api\/project\/([^/]+)\/binding\/([^/]+)$/, (m, _b, res) => {
  const binding = Object.values(fx.GRAPH_BINDINGS).find(
    (item) => item.id === decodeURIComponent(m[2]),
  );
  if (binding === undefined) {
    return projectEnvelope(res, 404, "project.binding.not_found", "No such binding.");
  }
  return json(res, 200, bindingRecordOf(binding, decodeURIComponent(m[1])));
});

const COOLING_UNTIL = Date.now() + 3 * 60 * 60_000;
const COOLING_AGENTS = { [fx.PROJECT.id]: ["swe@1"] };

const agentViewOf = (agent, binding, projectId) => {
  const base = {
    agent: agent.agent_name,
    worker: bindingConfigOf(binding, projectId).worker,
    worker_binding_id: binding.id,
    binding_set_version: bindingSet.version,
  };
  const enablement = agent.enablement;
  if (enablement === null || enablement.state !== "enabled") {
    return {
      ...base,
      defaults: null,
      entry: null,
      effective: null,
      chain: [],
      active_position: null,
      cooling: null,
      valid: false,
      issues: [{ path: [], code: "agent.enablement.unavailable" }],
    };
  }
  const head = enablement.agent_providers.find(
    (provider) => provider.name === enablement.default_configuration.agent_provider,
  );
  const cooling = COOLING_AGENTS[projectId]?.includes(agent.agent_name) ?? false;
  const effective = {
    agent_provider: head.name,
    provider: head.provider,
    credential: head.credential,
    model_identifier: enablement.default_configuration.model_identifier,
    reasoning_effort: enablement.default_configuration.reasoning_effort,
  };
  return {
    ...base,
    defaults: enablement.default_configuration,
    entry: null,
    effective,
    chain: [
      {
        position: 0,
        level: "enablement",
        ...effective,
        cooldown: cooling ? { strikes: 1, available_at: COOLING_UNTIL } : null,
      },
    ],
    active_position: cooling ? null : 0,
    cooling: cooling
      ? { code: "agent.configuration.chain_cooling", available_at: COOLING_UNTIL }
      : null,
    valid: true,
    issues: [],
  };
};

on("GET", /^\/api\/project\/([^/]+)\/binding\/([^/]+)\/agent$/, (m, _b, res, _t, url) => {
  const project = projectOrRefuse(res, m[1]);
  if (project === undefined) return undefined;
  const binding = Object.values(fx.GRAPH_BINDINGS).find(
    (item) => item.id === decodeURIComponent(m[2]),
  );
  if (binding === undefined || binding.kind !== "worker") {
    return projectEnvelope(res, 404, "project.binding.not_found", "Binding not found.");
  }
  const { worker } = bindingConfigOf(binding, project.id);
  const items = agents
    .filter((agent) => agent.worker_names.includes(worker))
    .map((agent) => agentViewOf(agent, binding, project.id))
    .sort((a, b) => a.agent.localeCompare(b.agent));
  return json(res, 200, page(items, url));
});

const SSH_ADDRESS = /^git@([A-Za-z0-9][A-Za-z0-9.-]*):([^/\s:]+)\/([^/\s:]+)\.git$/;

const healthEntry = (status, capability, failureReason = "unclassified") => ({
  status,
  capability,
  failure_reason: status === "healthy" ? null : failureReason,
});

const SSH_HOST_SETS = {
  github: ["github.com", "ssh.github.com"],
  gitlab: ["gitlab.com", "altssh.gitlab.com"],
  bitbucket: ["bitbucket.org", "altssh.bitbucket.org"],
};

const platformHostOf = (config) => {
  const host = SSH_ADDRESS.exec(config.address)?.[1]?.toLowerCase();
  return host !== undefined && SSH_HOST_SETS[config.platform]?.includes(host) ? host : null;
};

const legacySshOf = (config) => {
  const credential = credentials.find((item) => item.name === config.ssh_credential);
  return credential !== undefined && isLegacySsh(credential);
};

const remoteFailureOf = (address) => {
  if (address.includes("hostkey-")) return "host_key_unknown";
  if (address.includes("denied-")) return "key_refused";
  if (address.includes("bad-")) return "unclassified";
  return null;
};

const repositoryRefusalOf = (config) => {
  const host = platformHostOf(config);
  if (host === null) {
    return [
      400,
      "project.bindings.repository.address_invalid",
      "Repository address must name an SSH host of its platform.",
      null,
    ];
  }
  if (!hostKeyPins.has(host)) {
    return [
      409,
      "repository.host_key.unpinned",
      "The SSH host holds no pinned host key.",
      { host },
    ];
  }
  if (legacySshOf(config)) {
    return [
      409,
      "repository.credential.ssh_key_legacy",
      "The SSH credential holds no generated key. Use Rotate SSH key.",
      { credential: config.ssh_credential },
    ];
  }
  return null;
};

const addressFailureOf = (config) => {
  const host = platformHostOf(config);
  if (host === null) return "address_invalid";
  if (!hostKeyPins.has(host)) return "host_key_unknown";
  if (legacySshOf(config)) return "identity_unavailable";
  return remoteFailureOf(config.address);
};

const credentialHealth = (name) => {
  const credential = credentials.find((item) => item.name === name);
  if (credential === undefined || isArchived(credential)) {
    return healthEntry("unhealthy", HEALTH_CAPABILITIES[credential?.platform ?? "github"]);
  }
  const legacy = isLegacySsh(credential);
  const rejected = secretIsRejected(storedSecrets.get(credential.name)) || legacy;
  return healthEntry(
    rejected ? "unhealthy" : "healthy",
    HEALTH_CAPABILITIES[credential.platform],
    legacy ? "identity_unavailable" : "unauthorized",
  );
};

const bindingHealthOf = (config) => ({
  address: healthEntry(
    addressFailureOf(config) === null ? "healthy" : "unhealthy",
    "network git read",
    addressFailureOf(config),
  ),
  ssh_credential: credentialHealth(config.ssh_credential),
  credential: config.credential === undefined ? null : credentialHealth(config.credential),
});

on("POST", /^\/api\/project\/([^/]+)\/binding\/([^/]+)\/verify$/, (m, _b, res) => {
  const project = projectOrRefuse(res, m[1]);
  if (project === undefined) return undefined;
  const binding = Object.values(fx.GRAPH_BINDINGS).find(
    (item) => item.id === decodeURIComponent(m[2]),
  );
  if (binding === undefined || binding.kind !== "repository" || binding.removed_at !== null) {
    return projectEnvelope(res, 404, "project.binding.not_found", "Binding not found.");
  }
  return json(res, 200, bindingHealthOf(bindingSet.bindings[binding.name].config));
});

const INSTRUCTION_FILES = [
  { source: "agents_md", path: "AGENTS.md" },
  { source: "agents_local_md", path: "AGENTS.local.md" },
  { source: "claude_md", path: "CLAUDE.md" },
  { source: "claude_local_md", path: "CLAUDE.local.md" },
];

const INSTRUCTION_TEXTS = {
  agents_md:
    "# Repository rules\n\n## Toolchain\n\n- Node 24 and pnpm.\n- Run `pnpm verify` before every commit.\n\n## Style\n\n- No code comments.\n- Match the surrounding style.\n",
  claude_md: "@AGENTS.md\n\nRead AGENTS.md first.\n",
};

const instructionFileOf = ({ source, path }) =>
  INSTRUCTION_TEXTS[source] === undefined
    ? { source, path, state: "absent", reason: null, text: null }
    : { source, path, state: "present", reason: null, text: INSTRUCTION_TEXTS[source] };

on("GET", /^\/api\/project\/([^/]+)\/binding\/([^/]+)\/instruction_files$/, (m, _b, res) => {
  const project = projectOrRefuse(res, m[1]);
  if (project === undefined) return undefined;
  const binding = Object.values(fx.GRAPH_BINDINGS).find(
    (item) => item.id === decodeURIComponent(m[2]),
  );
  if (binding === undefined || binding.kind !== "repository" || binding.removed_at !== null) {
    return projectEnvelope(res, 404, "project.binding.not_found", "Binding not found.");
  }
  const { config } = bindingSet.bindings[binding.name];
  const refusal = repositoryRefusalOf(config);
  if (refusal !== null) return projectEnvelope(res, ...refusal);
  const failureReason = addressFailureOf(config);
  if (failureReason !== null) {
    return projectEnvelope(
      res,
      422,
      "project.bindings.repository.ssh_unreachable",
      "The repository SSH read failed.",
      { failure_reason: failureReason },
    );
  }
  if (config.strategy.base_branch.includes("missing")) {
    return projectEnvelope(
      res,
      422,
      "project.bindings.repository.base_branch_absent",
      `The remote holds no branch ${config.strategy.base_branch}.`,
    );
  }
  return json(res, 200, {
    commit: "3f2a9c1d4e5b6a7988776655443322110fedcba9",
    read_at: Date.now() - 120_000,
    files: INSTRUCTION_FILES.map(instructionFileOf),
  });
});

on("POST", /^\/api\/project\/([^/]+)\/binding\/check$/, (m, b, res) => {
  const project = projectOrRefuse(res, m[1]);
  if (project === undefined) return undefined;
  const config = b?.config;
  const valid =
    hasOnly(b, ["kind", "config"]) &&
    b.kind === "repository" &&
    typeof config === "object" &&
    config !== null &&
    isNonblank(config.address) &&
    isNonblank(config.ssh_credential) &&
    (config.credential === undefined || isNonblank(config.credential));
  if (!valid) return refuseValidation(res);
  const sshCredential = credentials.find(
    (item) => item.name === config.ssh_credential && item.platform === "ssh" && !isArchived(item),
  );
  if (sshCredential === undefined) {
    return credentialEnvelope(res, 404, "credential.credential.not_found", "Credential not found.");
  }
  const address = SSH_ADDRESS.exec(config.address);
  if (address === null) {
    return projectEnvelope(
      res,
      400,
      "project.bindings.repository.address_invalid",
      "Repository address must have the form git@<host>:<owner>/<repository>.git.",
    );
  }
  return json(res, 200, bindingHealthOf(config));
});

const projectOrRefuseScheduler = (res, encodedId) => {
  const state = stateOfProject(decodeURIComponent(encodedId));
  if (state === undefined) {
    projectEnvelope(res, 404, "project.project.not_found", "The project identity does not exist.");
  }
  return state;
};

on("GET", /^\/api\/scheduler\/project\/([^/]+)\/queue$/, (m, _b, res, _t, url) => {
  const state = stateOfProject(decodeURIComponent(m[1]));
  if (state === undefined) return json(res, 200, page([], url));
  const ordered = [...state.queue].sort(
    (a, x) => x.priority - a.priority || a.job_id.localeCompare(x.job_id),
  );
  return json(res, 200, page(ordered, url));
});

on("GET", /^\/api\/scheduler\/project\/([^/]+)\/execution$/, (m, _b, res, _t, url) => {
  const state = projectOrRefuseScheduler(res, m[1]);
  if (state === undefined) return undefined;
  const nodeId = url.searchParams.get("node_id");
  const attempt = url.searchParams.get("attempt");
  if (attempt !== null && !(Number.isInteger(Number(attempt)) && Number(attempt) > 0)) {
    return refuseValidation(res);
  }
  const items = state.executions
    .filter(
      (item) =>
        (nodeId === null || item.node_id === nodeId) &&
        (attempt === null || String(item.attempt) === attempt),
    )
    .sort((a, b) => b.execution_id.localeCompare(a.execution_id));
  return json(res, 200, page(items, url));
});

const platformEntry = (platform, secretShape, loginModes, metadataFields, verifiable) => ({
  platform,
  secret_shape: secretShape,
  login_modes: loginModes,
  metadata_fields: metadataFields,
  verifiable,
});
const CREDENTIAL_PLATFORM_LISTS = {
  llm: {
    items: [
      platformEntry("github-copilot", "oauth", ["device"], [], true),
      platformEntry("openai-codex", "oauth", ["browser", "device"], [], true),
      platformEntry("anthropic-subscription", "oauth", ["copy_code"], [], true),
      platformEntry("anthropic", "api_key", [], [], true),
      platformEntry("openai-compatible", "api_key", [], ["base_url"], true),
      platformEntry("openrouter", "api_key", [], [], true),
      platformEntry("openai", "api_key", [], [], true),
      platformEntry("amazon-bedrock", "api_key", [], ["region"], false),
      platformEntry("google-vertex", "api_key", [], ["project", "location"], false),
      platformEntry("cloudflare-ai-gateway", "api_key", [], ["account_id", "gateway_id"], false),
      platformEntry("google", "api_key", [], [], false),
      platformEntry("mistral", "api_key", [], [], false),
    ],
  },
  repository: {
    items: [
      platformEntry("github", "api_key", [], [], true),
      platformEntry("ssh", "ssh_key", [], [], true),
    ],
  },
  storage: {
    items: [platformEntry("s3", "s3_access_key", [], ["endpoint", "bucket", "region"], true)],
  },
};
const CREDENTIAL_PLATFORMS = Object.fromEntries(
  Object.values(CREDENTIAL_PLATFORM_LISTS).flatMap((list) =>
    list.items.map((entry) => [entry.platform, entry]),
  ),
);
const CREDENTIAL_COMPONENT = "(llm|repository|storage)";
const credentialRoute = (suffix) =>
  new RegExp(`^\\/api\\/${CREDENTIAL_COMPONENT}\\/credential${suffix}$`);
const componentEntry = (component, platform) =>
  CREDENTIAL_PLATFORM_LISTS[component].items.find((entry) => entry.platform === platform);
const HEALTH_CAPABILITIES = {
  github: "rate-limit read",
  "github-copilot": "copilot-token read",
  "openai-codex": "model-list read",
  "anthropic-subscription": "model call",
  anthropic: "model-list read",
  openrouter: "model-list read",
  "openai-compatible": "model-list read",
  s3: "bucket head",
  ssh: "ssh identity",
};
const secretIsRejected = (secret) =>
  typeof secret === "object" &&
  secret !== null &&
  Object.values(secret).some((value) => typeof value === "string" && value.startsWith("bad-"));
const CREDENTIAL_NAME = /^[a-z][a-z0-9-]{0,62}$/;
const BASE_URL = /^https?:\/\/[^?#]+[^?#/]$/;
const LOGIN_EXPIRY_MS = 15 * 60 * 1000;
const LOGIN_DEVICE_COMPLETION_MS = 10000;
const HEALTHCHECK_DELAY_MS = 1500;
const SERVER_HOLDER = "server";
const credentials = EMPTY
  ? []
  : [
      ...structuredClone(fx.CREDENTIALS).map((credential) => ({
        name: credential.name,
        platform: credential.platform,
        holder: SERVER_HOLDER,
        sealed_to: null,
        sealed_current: true,
        revisions: credential.revisions,
      })),
      ...structuredClone(fx.INSTANCE_CREDENTIAL_COPIES),
    ];
const pinnedRevisions = new Set(fx.PINNED_CREDENTIAL_REVISIONS);
const loginSessions = new Map();
const storedSecrets = new Map(
  credentials
    .filter((credential) => credential.name.startsWith("bad-"))
    .map((credential) => [credential.name, { key: "bad-seed" }]),
);
let credentialSequence = 100;

const credentialEnvelope = (res, status, code, message, details = null) =>
  json(res, status, {
    error: { code, message, details },
    request_id: "request_01J00000000000000000000000",
  });

const nextCredentialId = () => {
  credentialSequence += 1;
  return `credential_01J9ZQ4XKM3B6V8N2R5T7W${String(credentialSequence).padStart(4, "0")}`;
};

const newestLive = (credential) =>
  credential.revisions.filter((revision) => revision.ended_at === null)[0] ?? null;

const isLegacySsh = (credential) =>
  credential.platform === "ssh" && typeof newestLive(credential)?.metadata?.public_key !== "string";

const drainOlder = (credential, now) => {
  const newest = newestLive(credential);
  for (const revision of credential.revisions) {
    if (revision === newest || revision.ended_at !== null) continue;
    if (!pinnedRevisions.has(revision.id)) revision.ended_at = now;
  }
};

const isNonblank = (value) => typeof value === "string" && value.trim().length > 0;

const secretIsValid = (shape, secret) => {
  if (typeof secret !== "object" || secret === null) return false;
  if (shape === "api_key") return isNonblank(secret.key);
  if (shape === "s3_access_key") {
    return isNonblank(secret.access_key_id) && isNonblank(secret.secret_access_key);
  }
  return (
    isNonblank(secret.refresh) && isNonblank(secret.access) && Number.isInteger(secret.expires)
  );
};

const metadataIsValid = (platform, metadata) => {
  if (platform === "openai-compatible") {
    return (
      typeof metadata === "object" &&
      metadata !== null &&
      typeof metadata.base_url === "string" &&
      BASE_URL.test(metadata.base_url) &&
      Array.isArray(metadata.models) &&
      metadata.models.every((model) => isNonblank(model?.id)) &&
      new Set(metadata.models.map((model) => model.id.trim())).size === metadata.models.length
    );
  }
  const fields = CREDENTIAL_PLATFORMS[platform]?.metadata_fields ?? [];
  if (fields.length === 0) return metadata === null;
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    Object.keys(metadata).length === fields.length &&
    fields.every((field) => isNonblank(metadata[field])) &&
    (platform !== "s3" || URL.canParse(metadata.endpoint))
  );
};

const holderOf = (url) => url?.searchParams.get("holder") ?? SERVER_HOLDER;

const findCredential = (res, component, encoded, holder = SERVER_HOLDER) => {
  const credential = credentials.find(
    (item) =>
      item.name === decodeURIComponent(encoded) &&
      item.holder === holder &&
      componentEntry(component, item.platform) !== undefined,
  );
  if (credential === undefined) {
    credentialEnvelope(res, 404, "credential.credential.not_found", "Credential not found.");
  }
  return credential;
};

const isArchived = (credential) =>
  credential.revisions.every((revision) => revision.ended_at !== null);

const refuseArchived = (res, credential) => {
  if (!isArchived(credential)) return false;
  credentialEnvelope(
    res,
    409,
    "credential.credential.archived",
    "The credential is archived; an archive is final.",
  );
  return true;
};

const refuseStaleRevision = (res, credential, expectedRevision) => {
  if (newestLive(credential)?.revision === expectedRevision) return false;
  credentialEnvelope(
    res,
    409,
    "credential.revision.conflict",
    "The expected revision is not the newest live revision.",
  );
  return true;
};

const refuseInvalidInput = (res) =>
  credentialEnvelope(res, 400, "credential.input.invalid", "Credential input is invalid.");

const addRevision = (credential, metadata, res) => {
  const now = Date.now();
  credential.revisions.unshift({
    id: nextCredentialId(),
    revision: credential.revisions[0].revision + 1,
    metadata,
    created_at: now,
    ended_at: null,
  });
  drainOlder(credential, now);
  return json(res, 200, credential);
};

const bindingsNaming = (component, credential) =>
  Object.entries(bindingSet.bindings)
    .filter(([, binding]) => binding.kind === component)
    .filter(
      ([, binding]) =>
        binding.config.credential === credential.name ||
        binding.config.ssh_credential === credential.name,
    )
    .map(([name]) => ({
      project_id: projects[0].id,
      project_name: projects[0].name,
      binding_id:
        Object.values(fx.GRAPH_BINDINGS).findLast((binding) => binding.name === name)?.id ?? name,
      name,
    }));

const dependentsOf = (component, credential) =>
  component === "llm"
    ? { agent_providers: [] }
    : { bindings: bindingsNaming(component, credential) };

const refuseSshEntry = (res) =>
  credentialEnvelope(
    res,
    400,
    "credential.entry.unsupported",
    "An ssh credential enters only through Create SSH key.",
  );

const sshBlobOf = (rawKey) => {
  const type = Buffer.from("ssh-ed25519");
  const length = (value) => {
    const buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(value);
    return buffer;
  };
  return Buffer.concat([length(type.length), type, length(rawKey.length), rawKey]);
};

const fingerprintOf = (blob) =>
  `SHA256:${createHash("sha256").update(blob).digest("base64").replace(/=+$/, "")}`;

const generatedSshKey = (name) => {
  const { publicKey } = generateKeyPairSync("ed25519");
  const blob = sshBlobOf(publicKey.export({ format: "der", type: "spki" }).subarray(-32));
  return {
    public_key: `ssh-ed25519 ${blob.toString("base64")} kanthord-${name}`,
    fingerprint: fingerprintOf(blob),
  };
};

const hostKeyScanOf = (host) => {
  const publicKey = fx.HOST_KEYS[host];
  return {
    host,
    public_key: publicKey,
    fingerprint: fingerprintOf(Buffer.from(publicKey.split(" ")[1], "base64")),
    source: host === "github.com" || host === "ssh.github.com" ? "github_meta" : "keyscan",
  };
};

const hostKeyPins = new Map(EMPTY ? [] : fx.HOST_KEY_PINS.map((pin) => [pin.host, pin.created_at]));

const refuseUnsupportedHost = (res, host) => {
  if (typeof host === "string" && Object.hasOwn(fx.HOST_KEYS, host)) return false;
  credentialEnvelope(
    res,
    400,
    "repository.host_key.host_unsupported",
    "The host is in no SSH host set.",
  );
  return true;
};

on("POST", /^\/api\/repository\/credential\/ssh\/key$/, (_m, b, res) => {
  if (
    typeof b?.name !== "string" ||
    !CREDENTIAL_NAME.test(b.name) ||
    ["login", "check", "platform", "ssh"].includes(b.name)
  ) {
    return refuseInvalidInput(res);
  }
  const holder = credentials.find((item) => item.name === b.name);
  if (holder !== undefined) {
    return credentialEnvelope(
      res,
      409,
      "credential.name.conflict",
      "Credential name already exists.",
      {
        id: holder.revisions[0].id,
      },
    );
  }
  const credential = {
    name: b.name,
    platform: "ssh",
    revisions: [
      {
        id: nextCredentialId(),
        revision: 1,
        metadata: generatedSshKey(b.name),
        created_at: Date.now(),
        ended_at: null,
      },
    ],
  };
  credentials.push(credential);
  return json(res, 200, credential);
});

on("POST", /^\/api\/repository\/credential\/([^/]+)\/ssh\/key$/, (m, b, res) => {
  const credential = findCredential(res, "repository", m[1]);
  if (credential === undefined) return undefined;
  if (credential.platform !== "ssh") return refuseSshEntry(res);
  if (refuseArchived(res, credential)) return undefined;
  if (refuseStaleRevision(res, credential, b?.expected_revision)) return undefined;
  return addRevision(credential, generatedSshKey(credential.name), res);
});

on("GET", /^\/api\/repository\/host-key$/, (_m, _b, res, _t, url) => {
  const items = [...hostKeyPins.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([host, createdAt]) => ({ ...hostKeyScanOf(host), created_at: createdAt }));
  return json(res, 200, page(items, url));
});

on("POST", /^\/api\/repository\/host-key\/scan$/, (_m, b, res) => {
  if (refuseUnsupportedHost(res, b?.host)) return undefined;
  return json(res, 200, hostKeyScanOf(b.host));
});

on("PUT", /^\/api\/repository\/host-key\/([^/]+)$/, (m, b, res) => {
  const host = decodeURIComponent(m[1]);
  if (refuseUnsupportedHost(res, host)) return undefined;
  const scan = hostKeyScanOf(host);
  if (b?.fingerprint !== scan.fingerprint) {
    return credentialEnvelope(
      res,
      409,
      "repository.host_key.changed",
      "The host presented another key on the second read.",
      { host, fingerprint: scan.fingerprint },
    );
  }
  const createdAt = Date.now();
  hostKeyPins.set(host, createdAt);
  return json(res, 200, { ...scan, created_at: createdAt });
});

on("GET", credentialRoute("\\/platform"), (m, _b, res) =>
  json(res, 200, CREDENTIAL_PLATFORM_LISTS[m[1]]),
);

on("GET", credentialRoute(""), (m, _b, res, _t, url) => {
  const platform = url.searchParams.get("platform");
  const holder = url.searchParams.get("holder");
  const includeArchived = url.searchParams.get("include_archived") === "true";
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const offset = Number(url.searchParams.get("cursor") ?? 0);
  const ordered = credentials
    .filter((credential) => componentEntry(m[1], credential.platform) !== undefined)
    .filter((credential) => holder === null || credential.holder === holder)
    .filter((credential) => platform === null || credential.platform === platform)
    .filter((credential) => includeArchived || !isArchived(credential))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const credential of ordered) drainOlder(credential, Date.now());
  const items = ordered.slice(offset, offset + limit);
  const nextCursor = offset + limit < ordered.length ? String(offset + limit) : null;
  return json(res, 200, { items, next_cursor: nextCursor });
});

on("POST", credentialRoute("\\/check"), (m, b, res) => {
  const entry = componentEntry(m[1], b?.platform);
  if (entry === undefined) {
    return credentialEnvelope(res, 400, "credential.platform.unsupported", "Unsupported platform.");
  }
  if (!entry.verifiable || entry.secret_shape === "oauth" || entry.secret_shape === "ssh_key") {
    return credentialEnvelope(
      res,
      400,
      "credential.check.unsupported",
      "The platform has no check before the save.",
    );
  }
  if (!secretIsValid(entry.secret_shape, b.secret)) return refuseInvalidInput(res);
  if (!metadataIsValid(b.platform, b.metadata)) return refuseInvalidInput(res);
  return json(
    res,
    200,
    healthEntry(
      secretIsRejected(b.secret) ? "unhealthy" : "healthy",
      HEALTH_CAPABILITIES[b.platform],
      "unauthorized",
    ),
  );
});

on("POST", credentialRoute("\\/([^/]+)\\/verify"), (m, _b, res) => {
  const credential = findCredential(res, m[1], m[2]);
  if (credential === undefined) return undefined;
  if (refuseArchived(res, credential)) return undefined;
  const entry = CREDENTIAL_PLATFORMS[credential.platform];
  if (!entry.verifiable || entry.secret_shape === "oauth") {
    return credentialEnvelope(
      res,
      400,
      "credential.check.unsupported",
      "The platform has no check.",
    );
  }
  setTimeout(
    () =>
      json(
        res,
        200,
        healthEntry(
          secretIsRejected(storedSecrets.get(credential.name)) || isLegacySsh(credential)
            ? "unhealthy"
            : "healthy",
          HEALTH_CAPABILITIES[credential.platform],
          isLegacySsh(credential) ? "identity_unavailable" : "unauthorized",
        ),
      ),
    HEALTHCHECK_DELAY_MS,
  );
});

on("POST", credentialRoute(""), (m, b, res) => {
  const shape = componentEntry(m[1], b?.platform)?.secret_shape;
  if (shape === undefined) {
    return credentialEnvelope(res, 400, "credential.platform.unsupported", "Unsupported platform.");
  }
  if (shape === "oauth") {
    return credentialEnvelope(
      res,
      400,
      "credential.entry.unsupported",
      "Unsupported credential entry.",
    );
  }
  if (shape === "ssh_key") return refuseSshEntry(res);
  if (
    typeof b.name !== "string" ||
    !CREDENTIAL_NAME.test(b.name) ||
    b.name === "login" ||
    b.name === "check"
  ) {
    return refuseInvalidInput(res);
  }
  const holders = Array.isArray(b.holders) ? b.holders : [SERVER_HOLDER];
  if (holders.length === 0 || new Set(holders).size !== holders.length) {
    return refuseInvalidInput(res);
  }
  if (m[1] !== "llm" && holders.some((holder) => holder !== SERVER_HOLDER)) {
    return credentialEnvelope(res, 400, "credential.sealed.invalid", "Only an LLM copy is sealed.");
  }
  const unknownHolder = holders.find(
    (holder) => holder !== SERVER_HOLDER && instanceRoutes.liveInstance(holder) === null,
  );
  if (unknownHolder !== undefined) {
    return credentialEnvelope(
      res,
      400,
      "llm.credential.instance_unknown",
      "The holder names no live worker instance.",
      { holder: unknownHolder },
    );
  }
  const otherPlatform = credentials.find(
    (item) => item.name === b.name && item.platform !== b.platform,
  );
  if (otherPlatform !== undefined) {
    return credentialEnvelope(
      res,
      409,
      "credential.name.platform_conflict",
      "The credential name holds another platform.",
      { platform: otherPlatform.platform },
    );
  }
  const taken = credentials.find((item) => item.name === b.name && holders.includes(item.holder));
  if (taken !== undefined) {
    return credentialEnvelope(
      res,
      409,
      "credential.name.conflict",
      "Credential name already exists.",
      {
        id: taken.revisions[0].id,
      },
    );
  }
  if (!secretIsValid(shape, b.secret)) return refuseInvalidInput(res);
  if (!metadataIsValid(b.platform, b.metadata)) return refuseInvalidInput(res);
  const copies = holders.map((holder) => {
    const instance = holder === SERVER_HOLDER ? null : instanceRoutes.liveInstance(holder);
    return {
      name: b.name,
      platform: b.platform,
      holder,
      sealed_to: instance === null ? null : instance.record.fingerprint,
      sealed_current: true,
      revisions: [
        {
          id: nextCredentialId(),
          revision: 1,
          metadata: b.metadata,
          created_at: Date.now(),
          ended_at: null,
        },
      ],
    };
  });
  credentials.push(...copies);
  storedSecrets.set(b.name, b.secret);
  return json(res, 200, copies[0]);
});

on("POST", /^\/api\/llm\/credential\/login$/, (_m, b, res) => {
  const shape = componentEntry("llm", b?.platform)?.secret_shape;
  if (shape === undefined) {
    return credentialEnvelope(res, 400, "credential.platform.unsupported", "Unsupported platform.");
  }
  if (shape !== "oauth") {
    return credentialEnvelope(
      res,
      400,
      "credential.entry.unsupported",
      "Unsupported credential entry.",
    );
  }
  if (typeof b.name !== "string" || !CREDENTIAL_NAME.test(b.name) || b.name === "login") {
    return refuseInvalidInput(res);
  }
  if (
    b.mode !== undefined &&
    b.mode !== "browser" &&
    b.mode !== "device" &&
    b.mode !== "copy_code"
  ) {
    return credentialEnvelope(
      res,
      400,
      "credential.login.mode_unsupported",
      "Unsupported login mode.",
    );
  }
  const holder = b.holder ?? SERVER_HOLDER;
  const instance = holder === SERVER_HOLDER ? null : instanceRoutes.liveInstance(holder);
  if (holder !== SERVER_HOLDER && instance === null) {
    return credentialEnvelope(
      res,
      400,
      "llm.credential.instance_unknown",
      "The holder names no live worker instance.",
      { holder },
    );
  }
  if (instance !== null && b.mode === "browser") {
    return credentialEnvelope(
      res,
      400,
      "credential.login.mode_unsupported",
      "A worker instance signs in in copy_code or device mode only.",
    );
  }
  if (instance !== null && instance.connection === null) {
    return credentialEnvelope(
      res,
      409,
      "credential.login.instance_unavailable",
      "The worker instance holds no current connection.",
      { holder },
    );
  }
  const taken = credentials.find((item) => item.name === b.name && item.holder === holder);
  if (taken !== undefined && instance !== null && refuseArchived(res, taken)) return undefined;
  if (taken !== undefined && (instance === null || taken.sealed_current)) {
    return credentialEnvelope(
      res,
      409,
      "credential.name.conflict",
      "Credential name already exists.",
      {
        id: taken.revisions[0].id,
      },
    );
  }
  const now = Date.now();
  const pending = [...loginSessions.values()].some(
    (session) =>
      session.platform === b.platform && session.state === "pending" && session.expires_at > now,
  );
  if (pending) {
    return credentialEnvelope(res, 409, "credential.login.pending", "Another login is pending.");
  }
  const sessionId = `login_session_01J9ZQ4XKM3B6V8N2R5T7W${String(now % 10000).padStart(4, "0")}`;
  const copyCode = b.platform === "anthropic-subscription";
  const device = !copyCode && (b.platform === "github-copilot" || b.mode === "device");
  const session = {
    session_id: sessionId,
    platform: b.platform,
    name: b.name,
    holder,
    sealedTo: instance === null ? null : instance.record.fingerprint,
    state: "pending",
    startedAt: now,
    expires_at: now + LOGIN_EXPIRY_MS,
    device,
    codeReceived: false,
  };
  loginSessions.set(sessionId, session);
  return json(res, 200, {
    session_id: sessionId,
    address: copyCode
      ? "https://claude.ai/oauth/authorize?code=true&client_id=mock"
      : device
        ? "https://github.com/login/device"
        : "https://auth.example.test/authorize",
    code: device ? "MOCK-1234" : null,
    expires_at: session.expires_at,
  });
});

const settleLogin = (session) => {
  const now = Date.now();
  if (session.state !== "pending") return;
  if (now >= session.expires_at) {
    session.state = "expired";
    return;
  }
  const done =
    session.codeReceived ||
    (session.device && now - session.startedAt >= LOGIN_DEVICE_COMPLETION_MS);
  if (!done) return;
  const stale = credentials.find(
    (item) => item.name === session.name && item.holder === session.holder,
  );
  const keyChanged =
    session.holder !== SERVER_HOLDER &&
    instanceRoutes.liveInstance(session.holder)?.record.fingerprint !== session.sealedTo;
  const refusal = keyChanged
    ? "credential.sealed.invalid"
    : stale === undefined
      ? null
      : isArchived(stale)
        ? "credential.credential.archived"
        : stale.sealed_current
          ? "credential.name.conflict"
          : null;
  if (refusal !== null) {
    session.state = "failed";
    session.failureReason = refusal;
    return;
  }
  session.state = "completed";
  if (stale !== undefined) {
    stale.sealed_to = session.sealedTo;
    stale.sealed_current = true;
    stale.revisions.unshift({
      id: nextCredentialId(),
      revision: stale.revisions[0].revision + 1,
      metadata: newestLive(stale)?.metadata ?? null,
      created_at: now,
      ended_at: null,
    });
    drainOlder(stale, now);
    return;
  }
  credentials.push({
    name: session.name,
    platform: session.platform,
    holder: session.holder,
    sealed_to: session.sealedTo,
    sealed_current: true,
    revisions: [
      { id: nextCredentialId(), revision: 1, metadata: null, created_at: now, ended_at: null },
    ],
  });
};

on("POST", /^\/api\/llm\/credential\/login\/([^/]+)\/code$/, (m, b, res) => {
  const session = loginSessions.get(decodeURIComponent(m[1]));
  if (session === undefined) {
    return credentialEnvelope(res, 404, "credential.login.not_found", "Login session not found.");
  }
  settleLogin(session);
  if (session.state !== "pending") {
    return credentialEnvelope(
      res,
      409,
      "credential.login.value_not_awaited",
      "No login value is awaited.",
    );
  }
  if (!isNonblank(b?.value)) return refuseInvalidInput(res);
  session.codeReceived = true;
  return json(res, 200, { session_id: session.session_id });
});

on("GET", /^\/api\/llm\/credential\/login\/([^/]+)$/, (m, _b, res) => {
  const session = loginSessions.get(decodeURIComponent(m[1]));
  if (session === undefined) {
    return credentialEnvelope(res, 404, "credential.login.not_found", "Login session not found.");
  }
  settleLogin(session);
  return json(res, 200, {
    session_id: session.session_id,
    state: session.state,
    last_message: session.state === "pending" ? "Waiting for the platform interaction." : null,
    failure_reason: session.failureReason ?? null,
  });
});

on("GET", credentialRoute("\\/([^/]+)"), (m, _b, res, _t, url) => {
  const credential = findCredential(res, m[1], m[2], holderOf(url));
  if (credential === undefined) return undefined;
  drainOlder(credential, Date.now());
  return json(res, 200, { ...credential, ...dependentsOf(m[1], credential) });
});

on("POST", credentialRoute("\\/([^/]+)\\/revision"), (m, b, res, _t, url) => {
  const credential = findCredential(res, m[1], m[2], holderOf(url));
  if (credential === undefined) return undefined;
  if (refuseArchived(res, credential)) return undefined;
  if (refuseStaleRevision(res, credential, b?.expected_revision)) return undefined;
  if (credential.platform === "ssh") return refuseSshEntry(res);
  if (!secretIsValid(CREDENTIAL_PLATFORMS[credential.platform].secret_shape, b.secret)) {
    return refuseInvalidInput(res);
  }
  const metadata = b.metadata === undefined ? newestLive(credential).metadata : b.metadata;
  if (!metadataIsValid(credential.platform, metadata)) return refuseInvalidInput(res);
  storedSecrets.set(credential.name, b.secret);
  if (credential.holder !== SERVER_HOLDER) {
    credential.sealed_to =
      instanceRoutes.liveInstance(credential.holder)?.record.fingerprint ?? null;
    credential.sealed_current = credential.sealed_to !== null;
  }
  return addRevision(credential, metadata, res);
});

on("PUT", credentialRoute("\\/([^/]+)\\/metadata"), (m, b, res, _t, url) => {
  const credential = findCredential(res, m[1], m[2], holderOf(url));
  if (credential === undefined) return undefined;
  if (refuseArchived(res, credential)) return undefined;
  if (refuseStaleRevision(res, credential, b?.expected_revision)) return undefined;
  if (credential.platform === "ssh") return refuseSshEntry(res);
  if (!metadataIsValid(credential.platform, b.metadata)) return refuseInvalidInput(res);
  const current = newestLive(credential).metadata;
  if (credential.platform === "openai-compatible" && current.base_url !== b.metadata.base_url) {
    return credentialEnvelope(
      res,
      409,
      "llm.metadata.base_url_fixed",
      "Credential base URL cannot be changed by metadata update.",
    );
  }
  return addRevision(credential, b.metadata, res);
});

on("POST", credentialRoute("\\/([^/]+)\\/revision\\/(\\d+)\\/revoke"), (m, _b, res) => {
  const credential = findCredential(res, m[1], m[2]);
  if (credential === undefined) return undefined;
  const target = credential.revisions.find((revision) => revision.revision === Number(m[3]));
  if (target === undefined) {
    return credentialEnvelope(res, 404, "credential.revision.not_found", "Revision not found.");
  }
  if (target.ended_at !== null) {
    return credentialEnvelope(res, 409, "credential.revision.ended", "Revision already ended.");
  }
  if (target === newestLive(credential)) {
    return credentialEnvelope(
      res,
      409,
      "credential.revision.newest_live",
      "The newest live revision cannot be revoked.",
    );
  }
  const now = Date.now();
  target.ended_at = now;
  pinnedRevisions.delete(target.id);
  drainOlder(credential, now);
  return json(res, 200, credential);
});

on("POST", credentialRoute("\\/([^/]+)\\/archive"), (m, _b, res) => {
  const credential = findCredential(res, m[1], m[2]);
  if (credential === undefined) return undefined;
  if (refuseArchived(res, credential)) return undefined;
  const dependents = fx.CREDENTIAL_DEPENDENTS[credential.name];
  if (dependents !== undefined) {
    return credentialEnvelope(
      res,
      409,
      "credential.credential.in_use",
      "A dependent uses the credential.",
      dependents,
    );
  }
  const now = Date.now();
  for (const revision of credential.revisions) {
    if (revision.ended_at === null) revision.ended_at = now;
    pinnedRevisions.delete(revision.id);
  }
  return json(res, 200, credential);
});

const instanceRoutes = registerInstances({
  on,
  json,
  envelope: projectEnvelope,
  page,
  bindingSets,
  credentials,
  agents,
});

registerWorkbench({
  on,
  json,
  envelope: projectEnvelope,
  agents,
  sessions: workbenchSessions,
});

registerTracking({
  on,
  json,
  envelope: projectEnvelope,
  page,
  executions: () => [...projectStates.values()].flatMap((state) => state.executions),
});

registerEnvironments({
  on,
  json,
  envelope: projectEnvelope,
  projectOrRefuse,
  bindingSetOf,
  bindingIdOf: (name) => bindingRecordByName(name)?.id ?? name,
});

const IDEMPOTENCY_KEY = /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

createServer((req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, null);

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");

  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw.length === 0 ? null : JSON.parse(raw);
    const route = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
    if (!route) return projectEnvelope(res, 404, "gateway.routing.not_found", "Route not found.");

    const open = PUBLIC.some((p) => p.method === req.method && p.path === url.pathname);
    if (!open && token !== DEV_TOKEN) {
      return projectEnvelope(
        res,
        401,
        "gateway.authentication.unauthorized",
        "The request carries no valid human token.",
      );
    }
    const idempotencyKey = req.headers["idempotency-key"];
    if (idempotencyKey !== undefined && !IDEMPOTENCY_KEY.test(idempotencyKey)) {
      return projectEnvelope(
        res,
        400,
        "gateway.idempotency.invalid_key",
        "Idempotency-Key must be idempotency_key_ followed by a canonical ULID.",
      );
    }
    try {
      route.handler(route.pattern.exec(url.pathname), body, res, token, url);
    } catch {
      projectEnvelope(res, 500, "gateway.http.failed", "HTTP request failed.");
    }
  });
}).listen(PORT, () => {
  process.stdout.write(
    `mock daemon on http://localhost:${PORT} (origin ${ORIGIN}, account ${USERNAME})\ndev token: ${DEV_TOKEN}\n`,
  );
});
