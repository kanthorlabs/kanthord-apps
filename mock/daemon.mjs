/**
 * A development stand-in for the kanthord daemon.
 *
 * It serves the contract that src/api derives from the design set, so the
 * dashboard runs before the daemon exists. It is not part of the application
 * and no module under src/ reaches it.
 */
import { createHash } from "node:crypto";
import { createServer } from "node:http";

import * as fx from "./fixtures.mjs";

const PORT = Number(process.env.KANTHORD_HTTP_PORT ?? 31415);
const ORIGIN = process.env.KANTHORD_HTTP_ALLOWED_ORIGINS ?? "http://localhost:27182";
const USERNAME = "kanthorlabs";
const DEV_TOKEN = process.env.KANTHORD_DEV_TOKEN ?? "dev-human-token";
const UNHEALTHY = process.env.KANTHORD_MOCK_UNHEALTHY === "1";

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
const projects = [structuredClone(fx.PROJECT)];
const mission = { ...structuredClone(fx.MISSION), entries: structuredClone(fx.MISSION_ENTRIES) };
const bindingSet = structuredClone(fx.BINDING_SET);
const agents = structuredClone(fx.AGENT_DECLARATIONS);
let nodeSequence = 10;

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

const refuse = (res, status, code, message, detail = "") =>
  json(res, status, { code, message, detail });

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
    requestId: `req-${Math.random().toString(36).slice(2, 10)}`,
  });
});

on("GET", /^\/api\/auth\/verify$/, (_m, _b, res) =>
  json(res, 200, { kind: "human", sub: USERNAME, name: "Kanthor Labs" }),
);

const PROJECT_NAME = /^[a-z][a-z0-9-]{0,62}$/;

const projectEnvelope = (res, status, code, message) =>
  json(res, status, {
    error: { code, message, details: null },
    requestId: "request_01J00000000000000000000000",
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
  return json(res, 200, { items, nextCursor });
});

on("POST", /^\/api\/project$/, (_m, b, res) => {
  const refused = refuseProjectName(res, b?.name, null);
  if (refused !== null) return refused;
  const project = {
    id: `project_${Date.now().toString(36)}`,
    name: b.name,
    bindingSetVersion: 1,
    createdAt: Date.now(),
  };
  projects.push(project);
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

on("GET", /^\/api\/worker\/catalog$/, (_m, _b, res) => json(res, 200, page(fx.WORKER_CATALOG)));
on("GET", /^\/api\/worker\/instance$/, (_m, _b, res, _t, url) => {
  const projectId = url.searchParams.get("projectId");
  const items = fx.WORKER_INSTANCES.filter(
    (instance) => projectId === null || instance.projectId === projectId,
  );
  return json(res, 200, page(items));
});
const WORKER_METHODS = { "general@1": "steps", "reviewer@1": "evaluation" };
on("GET", /^\/api\/worker\/catalog\/([^/]+)$/, (m, _b, res) => {
  const item = fx.WORKER_CATALOG.find((w) => w.name === decodeURIComponent(m[1]));
  const agent = agents.find((a) => a.workerNames.includes(item?.name));
  if (item === undefined || agent === undefined) {
    return projectEnvelope(res, 404, "worker.catalog.not_found", "The worker is not supplied.");
  }
  return json(res, 200, {
    ...item,
    method: WORKER_METHODS[item.name],
    agentName: agent.agentName,
    resourceBudget: { wallTimeMs: 3600000 },
  });
});
on("GET", /^\/api\/worker\/agent\/enablement$/, (_m, _b, res) =>
  json(res, 200, page(agents.flatMap((a) => (a.enablement === null ? [] : [a.enablement])))),
);
const enablementTarget = (res, name, expectedRevision) => {
  const agent = agents.find((a) => a.agentName === decodeURIComponent(name));
  if (agent === undefined) {
    projectEnvelope(res, 404, "worker.agent.not_found", "The agent is absent from the catalog.");
    return null;
  }
  if ((agent.enablement?.revision ?? undefined) !== expectedRevision) {
    projectEnvelope(
      res,
      409,
      "worker.agent.enablement.revision_conflict",
      "The enablement changed after the read.",
    );
    return null;
  }
  return agent;
};
on("PUT", /^\/api\/worker\/agent\/enablement\/([^/]+)$/, (m, b, res) => {
  const agent = enablementTarget(res, m[1], b?.expectedRevision);
  if (agent === null) return undefined;
  agent.enablement = {
    agentName: agent.agentName,
    state: agent.enablement?.state ?? "enabled",
    agentProviders: b.agentProviders,
    defaultConfiguration: b.defaultConfiguration,
    revision: (agent.enablement?.revision ?? 0) + 1,
  };
  return json(res, 200, agent.enablement);
});
on("POST", /^\/api\/worker\/agent\/enablement\/([^/]+)\/(enable|disable)$/, (m, b, res) => {
  const agent = enablementTarget(res, m[1], b?.expectedRevision);
  if (agent === null) return undefined;
  if (agent.enablement === null) {
    return projectEnvelope(res, 404, "worker.agent.enablement.not_found", "No enablement exists.");
  }
  agent.enablement = {
    ...agent.enablement,
    state: m[2] === "enable" ? "enabled" : "disabled",
    revision: agent.enablement.revision + 1,
  };
  return json(res, 200, agent.enablement);
});
on("GET", /^\/api\/worker\/agent\/([^/]+)$/, (m, _b, res) => {
  const declaration = agents.find((a) => a.agentName === decodeURIComponent(m[1]));
  if (declaration === undefined) {
    return refuse(res, 404, "not_found", "The agent name is absent from the worker catalog.");
  }
  const { agentName, configurationSchema, overridableFields, enablement } = declaration;
  const { basePrompt, agentPrompt, tools } = declaration;
  return json(res, 200, {
    agentName,
    configurationSchema,
    overridableFields,
    enablement,
    basePrompt,
    agentPrompt,
    tools,
  });
});

const nodeIdOf = () => `node_01J9ZQ4XKM3B6V8N2R5T7W0Y${String(nodeSequence++).padStart(2, "0")}`;

const planOf = (body) =>
  body.format === "json"
    ? body.entries
    : body.files.map((file) => {
        const known = mission.entries.find((entry) => entry.filename === file.filename);
        const heading = /^#\s+(.+)$/m.exec(file.content);
        return {
          ...(known ?? {
            kind: "task",
            requirement: "-",
            criterion: "-",
            verifications: ["-"],
            bindings: [],
          }),
          filename: file.filename,
          name: heading ? heading[1] : file.filename,
        };
      });

const previewOf = (body) => {
  const plan = planOf(body).map((entry) => {
    const known = mission.entries.find((current) => current.filename === entry.filename);
    return entry.id === undefined && known ? { ...entry, id: known.id } : entry;
  });
  const ids = new Set(plan.filter((entry) => entry.id !== undefined).map((entry) => entry.id));
  const creates = plan.filter((entry) => entry.id === undefined).map((entry) => entry.filename);
  const updates = [];
  const noOps = [];
  for (const entry of plan.filter((candidate) => candidate.id !== undefined)) {
    const current = mission.entries.find((candidate) => candidate.id === entry.id);
    if (JSON.stringify(current) === JSON.stringify(entry)) noOps.push(entry.id);
    else updates.push(entry.id);
  }
  const retirements = mission.entries
    .filter((entry) => !ids.has(entry.id))
    .map((entry) => entry.id);
  const violations =
    plan.length === 0
      ? [
          {
            code: "mission.import.plan_invalid",
            message: "The import holds no plan file.",
            filename: null,
            nodeId: null,
            details: null,
          },
        ]
      : [];
  const previewDigest = createHash("sha256")
    .update(JSON.stringify({ plan, retirements, version: mission.version }))
    .digest("hex");
  return {
    plan,
    preview: {
      missionId: mission.id,
      expectedMissionVersion: mission.version,
      previewDigest,
      creates,
      updates,
      retirements,
      removedEdges: [],
      noOps,
      violations,
    },
  };
};

const refuseMissionVersion = (res, body) => {
  if (body.missionVersion === mission.version) return null;
  return projectEnvelope(
    res,
    409,
    "mission.version.conflict",
    "The expected mission version differs from the current version.",
  );
};

on("GET", /^\/api\/mission\/project\/([^/]+)$/, (m, _b, res) =>
  json(res, 200, { id: mission.id, projectId: decodeURIComponent(m[1]), version: mission.version }),
);

on("GET", /^\/api\/mission\/([^/]+)\/export$/, (_m, _b, res, _t, url) =>
  url.searchParams.get("format") === "json"
    ? json(res, 200, {
        missionId: mission.id,
        missionVersion: mission.version,
        entries: mission.entries,
      })
    : json(res, 200, {
        missionId: mission.id,
        missionVersion: mission.version,
        files: mission.entries.map((entry) => ({
          filename: entry.filename,
          content: `# ${entry.name}\n`,
        })),
      }),
);

on("POST", /^\/api\/mission\/([^/]+)\/import\/preview$/, (_m, b, res) => {
  const refused = refuseMissionVersion(res, b);
  if (refused !== null) return refused;
  return json(res, 200, previewOf(b).preview);
});

on("POST", /^\/api\/mission\/([^/]+)\/import$/, (_m, b, res) => {
  const refused = refuseMissionVersion(res, b);
  if (refused !== null) return refused;
  const { plan, preview } = previewOf(b);
  const confirmed = [...b.confirmedRetirements].sort().join(",");
  if (
    b.previewDigest !== preview.previewDigest ||
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
    assignedIds.push({ filename: entry.filename, nodeId });
    return { ...entry, id: nodeId };
  });
  mission.version += 1;
  return json(res, 200, { missionId: mission.id, missionVersion: mission.version, assignedIds });
});

on("GET", /^\/api\/project\/([^/]+)\/binding-set$/, (_m, _b, res) => json(res, 200, bindingSet));

on("PUT", /^\/api\/project\/([^/]+)\/binding-set$/, (m, b, res) => {
  if (b.version !== bindingSet.version) {
    return projectEnvelope(
      res,
      409,
      "project.binding_set.version_conflict",
      "The submitted binding-set version differs from the current version.",
    );
  }
  bindingSet.bindings = b.bindings;
  bindingSet.version += 1;
  const projectId = decodeURIComponent(m[1]);
  const stored = Object.fromEntries(
    Object.entries(b.bindings).map(([name, entry]) => [
      name,
      {
        id: `binding_${name}`,
        projectId,
        name,
        kind: entry.kind,
        resourceIdentity: `${entry.kind}:${name}`,
        revision: 1,
        config: entry.config,
        createdAt: Date.now(),
        removedAt: null,
      },
    ]),
  );
  return json(res, 200, {
    projectId,
    bindingSetVersion: bindingSet.version,
    bindings: stored,
    changes: [],
  });
});

const page = (items) => ({ items, nextCursor: null });

const dependsOnOf = (nodeId) =>
  fx.GRAPH_EDGES.filter((edge) => edge.kind === "dependency" && edge.dependentId === nodeId)
    .map((edge) => edge.dependsOnId)
    .sort();

const graphNodeRead = (node) => {
  if (node.kind === "task") return node;
  const runnable = { ...node, dependsOn: dependsOnOf(node.id) };
  if (node.state !== "Blocked") return runnable;
  const outcome = fx.GRAPH_OUTCOMES.filter((item) => item.nodeId === node.id).at(-1);
  return outcome === undefined
    ? runnable
    : { ...runnable, blockedContext: { outcome, requests: [] } };
};

const graphNodeById = (id) => fx.GRAPH_NODES.find((node) => node.id === id);

const graphRevisions = (node) => {
  const owner = node.kind === "task" ? graphNodeById(node.parentId) : node;
  const tasks = fx.GRAPH_NODES.filter(
    (child) => child.parentId === owner.id && child.kind === "task",
  );
  const first = {
    nodeId: owner.id,
    filename: owner.filename,
    revision: 1,
    reason: "Import the mission plan.",
    actor: fx.GRAPH_HUMAN,
    createdAt: Date.now() - 9_000 * 60_000,
    content: fx.GRAPH_ORIGINAL_CONTENT[owner.id] ?? owner.content,
    change: { write: "import", previousRevision: null, changedFields: [] },
    pinnedByAttempts: owner.pinnedByAttempts,
  };
  const later = (fx.GRAPH_EXTRA_REVISIONS[owner.id] ?? []).map(({ contentAt, ...revision }) => ({
    nodeId: owner.id,
    filename: owner.filename,
    content: contentAt(owner),
    pinnedByAttempts: [],
    ...revision,
  }));
  const revisions = [first, ...later].map((revision) =>
    owner.kind === "objective"
      ? {
          ...revision,
          tasks: tasks.map((child) => ({
            id: child.id,
            filename: child.filename,
            content: child.content,
          })),
        }
      : revision,
  );
  const selected =
    node.kind === "task"
      ? revisions.map((revision) => ({
          ...revision,
          nodeId: node.id,
          filename: node.filename,
          content: node.content,
        }))
      : revisions;
  return selected.reverse();
};

const byAttempt = (records, nodeId, url) => {
  const attempt = url.searchParams.get("attempt");
  return records.filter(
    (record) =>
      record.nodeId === nodeId && (attempt === null || String(record.attempt) === attempt),
  );
};

on("GET", /^\/api\/mission\/([^/]+)\/node$/, (_m, _b, res) =>
  json(res, 200, page(fx.GRAPH_NODES.map(graphNodeRead))),
);

on("GET", /^\/api\/mission\/([^/]+)\/edge$/, (_m, _b, res, _t, url) => {
  const kind = url.searchParams.get("kind");
  return json(res, 200, page(fx.GRAPH_EDGES.filter((edge) => kind === null || edge.kind === kind)));
});

on("GET", /^\/api\/mission\/node\/([^/]+)$/, (m, _b, res) => {
  const node = graphNodeById(decodeURIComponent(m[1]));
  if (node === undefined)
    return projectEnvelope(res, 404, "mission.record.not_found", "No such node.");
  return json(res, 200, graphNodeRead(node));
});

on("GET", /^\/api\/mission\/node\/([^/]+)\/revision$/, (m, _b, res) => {
  const node = graphNodeById(decodeURIComponent(m[1]));
  if (node === undefined)
    return projectEnvelope(res, 404, "mission.record.not_found", "No such node.");
  return json(res, 200, page(graphRevisions(node)));
});

on("GET", /^\/api\/mission\/node\/([^/]+)\/revision\/(\d+)$/, (m, _b, res) => {
  const node = graphNodeById(decodeURIComponent(m[1]));
  const revision = node && graphRevisions(node).find((item) => item.revision === Number(m[2]));
  if (!revision) return projectEnvelope(res, 404, "mission.record.not_found", "No such revision.");
  return json(res, 200, revision);
});

on("GET", /^\/api\/mission\/node\/([^/]+)\/attempt$/, (m, _b, res) =>
  json(res, 200, page(fx.GRAPH_ATTEMPTS[decodeURIComponent(m[1])] ?? [])),
);

on("GET", /^\/api\/mission\/node\/([^/]+)\/evidence$/, (m, _b, res, _t, url) =>
  json(res, 200, page(byAttempt(fx.GRAPH_EVIDENCE, decodeURIComponent(m[1]), url))),
);

on("GET", /^\/api\/mission\/node\/([^/]+)\/assessment$/, (m, _b, res, _t, url) =>
  json(res, 200, page(byAttempt(fx.GRAPH_ASSESSMENTS, decodeURIComponent(m[1]), url))),
);

on("GET", /^\/api\/mission\/node\/([^/]+)\/outcome$/, (m, _b, res, _t, url) =>
  json(res, 200, page(byAttempt(fx.GRAPH_OUTCOMES, decodeURIComponent(m[1]), url))),
);

on("GET", /^\/api\/mission\/node\/([^/]+)\/external-action$/, (m, _b, res, _t, url) => {
  const nodeId = decodeURIComponent(m[1]);
  const actions = (fx.GRAPH_ATTEMPTS[nodeId] ?? []).flatMap((attempt) =>
    attempt.requiredExternalActions.map((action) => {
      const request = fx.GRAPH_EVIDENCE.find(
        (item) =>
          item.nodeId === nodeId &&
          item.attempt === attempt.attempt &&
          item.requirementKey === action.key,
      );
      return {
        nodeId,
        attempt: attempt.attempt,
        action,
        requested: request !== undefined,
        requestEvidenceId: request?.id ?? null,
        resolution: request === undefined ? "unrequested" : "unresolved",
      };
    }),
  );
  return json(res, 200, page(byAttempt(actions, nodeId, url)));
});

on("GET", /^\/api\/project\/([^/]+)\/binding\/([^/]+)$/, (m, _b, res) => {
  const binding = Object.values(fx.GRAPH_BINDINGS).find(
    (item) => item.id === decodeURIComponent(m[2]),
  );
  if (binding === undefined) {
    return projectEnvelope(res, 404, "project.binding.not_found", "No such binding.");
  }
  return json(res, 200, { ...binding, projectId: decodeURIComponent(m[1]), config: {} });
});

on("GET", /^\/api\/scheduler\/project\/([^/]+)\/queue$/, (_m, _b, res) =>
  json(
    res,
    200,
    page(
      [...fx.GRAPH_QUEUE].sort((a, x) => x.priority - a.priority || a.jobId.localeCompare(x.jobId)),
    ),
  ),
);
on("GET", /^\/api\/scheduler\/project\/([^/]+)\/execution$/, (_m, _b, res, _t, url) => {
  const nodeId = url.searchParams.get("nodeId");
  const attempt = url.searchParams.get("attempt");
  const items = fx.GRAPH_EXECUTIONS.filter(
    (item) =>
      (nodeId === null || item.nodeId === nodeId) &&
      (attempt === null || String(item.attempt) === attempt),
  );
  return json(res, 200, page(items));
});

const platformEntry = (platform, secretShape, loginModes, metadataFields, verifiable) => ({
  platform,
  secretShape,
  loginModes,
  metadataFields,
  verifiable,
});
const CREDENTIAL_PLATFORM_LISTS = {
  llm: {
    items: [
      platformEntry("github-copilot", "oauth", ["device"], [], true),
      platformEntry("openai-codex", "oauth", ["browser", "device"], [], true),
      platformEntry("anthropic", "api_key", [], [], true),
      platformEntry("openai-compatible", "api_key", [], ["baseUrl"], true),
      platformEntry("openrouter", "api_key", [], [], true),
      platformEntry("openai", "api_key", [], [], true),
      platformEntry("amazon-bedrock", "api_key", [], ["region"], false),
      platformEntry("google-vertex", "api_key", [], ["project", "location"], false),
      platformEntry("cloudflare-ai-gateway", "api_key", [], ["account_id", "gateway_id"], false),
      platformEntry("google", "api_key", [], [], false),
      platformEntry("mistral", "api_key", [], [], false),
    ],
  },
  repository: { items: [platformEntry("github", "api_key", [], [], true)] },
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
  anthropic: "model-list read",
  openrouter: "model-list read",
  "openai-compatible": "model-list read",
  s3: "bucket head",
};
const CREDENTIAL_NAME = /^[a-z][a-z0-9-]{0,62}$/;
const BASE_URL = /^https?:\/\/[^?#]+[^?#/]$/;
const LOGIN_EXPIRY_MS = 15 * 60 * 1000;
const LOGIN_DEVICE_COMPLETION_MS = 10000;
const HEALTHCHECK_DELAY_MS = 1500;
const credentials = structuredClone(fx.CREDENTIALS);
const pinnedRevisions = new Set(fx.PINNED_CREDENTIAL_REVISIONS);
const loginSessions = new Map();
let credentialSequence = 100;

const credentialEnvelope = (res, status, code, message, details = null) =>
  json(res, status, {
    error: { code, message, details },
    requestId: "request_01J00000000000000000000000",
  });

const nextCredentialId = () => {
  credentialSequence += 1;
  return `credential_01J9ZQ4XKM3B6V8N2R5T7W${String(credentialSequence).padStart(4, "0")}`;
};

const newestLive = (credential) =>
  credential.revisions.filter((revision) => revision.endedAt === null)[0] ?? null;

const drainOlder = (credential, now) => {
  const newest = newestLive(credential);
  for (const revision of credential.revisions) {
    if (revision === newest || revision.endedAt !== null) continue;
    if (!pinnedRevisions.has(revision.id)) revision.endedAt = now;
  }
};

const isNonblank = (value) => typeof value === "string" && value.trim().length > 0;

const secretIsValid = (shape, secret) => {
  if (typeof secret !== "object" || secret === null) return false;
  if (shape === "api_key") return isNonblank(secret.key);
  if (shape === "s3_access_key") {
    return isNonblank(secret.accessKeyId) && isNonblank(secret.secretAccessKey);
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
      typeof metadata.baseUrl === "string" &&
      BASE_URL.test(metadata.baseUrl) &&
      Array.isArray(metadata.models) &&
      metadata.models.every((model) => isNonblank(model?.id)) &&
      new Set(metadata.models.map((model) => model.id.trim())).size === metadata.models.length
    );
  }
  const fields = CREDENTIAL_PLATFORMS[platform]?.metadataFields ?? [];
  if (fields.length === 0) return metadata === null;
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    Object.keys(metadata).length === fields.length &&
    fields.every((field) => isNonblank(metadata[field])) &&
    (platform !== "s3" || URL.canParse(metadata.endpoint))
  );
};

const findCredential = (res, component, encoded) => {
  const credential = credentials.find(
    (item) =>
      item.name === decodeURIComponent(encoded) &&
      componentEntry(component, item.platform) !== undefined,
  );
  if (credential === undefined) {
    credentialEnvelope(res, 404, "credential.credential.not_found", "Credential not found.");
  }
  return credential;
};

const isArchived = (credential) =>
  credential.revisions.every((revision) => revision.endedAt !== null);

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
    createdAt: now,
    endedAt: null,
  });
  drainOlder(credential, now);
  return json(res, 200, credential);
};

const bindingsNaming = (component, credential) =>
  Object.entries(bindingSet.bindings)
    .filter(([, binding]) => binding.kind === component)
    .filter(([, binding]) => binding.config.credential === credential.name)
    .map(([name]) => ({
      projectId: projects[0].id,
      projectName: projects[0].name,
      bindingId:
        Object.values(fx.GRAPH_BINDINGS).findLast((binding) => binding.name === name)?.id ?? name,
      name,
    }));

const dependentsOf = (component, credential) =>
  component === "llm"
    ? { agentProviders: [] }
    : { bindings: bindingsNaming(component, credential) };

on("GET", credentialRoute("\\/platform"), (m, _b, res) =>
  json(res, 200, CREDENTIAL_PLATFORM_LISTS[m[1]]),
);

on("GET", credentialRoute(""), (m, _b, res, _t, url) => {
  const platform = url.searchParams.get("platform");
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const limit = Number(url.searchParams.get("limit") ?? 100);
  const offset = Number(url.searchParams.get("cursor") ?? 0);
  const ordered = credentials
    .filter((credential) => componentEntry(m[1], credential.platform) !== undefined)
    .filter((credential) => platform === null || credential.platform === platform)
    .filter((credential) => includeArchived || !isArchived(credential))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const credential of ordered) drainOlder(credential, Date.now());
  const items = ordered.slice(offset, offset + limit);
  const nextCursor = offset + limit < ordered.length ? String(offset + limit) : null;
  return json(res, 200, { items, nextCursor });
});

on("POST", credentialRoute("\\/check"), (m, b, res) => {
  const entry = componentEntry(m[1], b?.platform);
  if (entry === undefined) {
    return credentialEnvelope(res, 400, "credential.platform.unsupported", "Unsupported platform.");
  }
  if (!entry.verifiable || entry.secretShape === "oauth") {
    return credentialEnvelope(
      res,
      400,
      "credential.check.unsupported",
      "The platform has no check before the save.",
    );
  }
  if (!secretIsValid(entry.secretShape, b.secret)) return refuseInvalidInput(res);
  if (!metadataIsValid(b.platform, b.metadata)) return refuseInvalidInput(res);
  const rejected = Object.values(b.secret).some(
    (value) => typeof value === "string" && value.startsWith("bad-"),
  );
  return json(res, 200, {
    status: rejected ? "unhealthy" : "healthy",
    capability: HEALTH_CAPABILITIES[b.platform],
  });
});

on("POST", credentialRoute(""), (m, b, res) => {
  const shape = componentEntry(m[1], b?.platform)?.secretShape;
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
  if (
    typeof b.name !== "string" ||
    !CREDENTIAL_NAME.test(b.name) ||
    b.name === "login" ||
    b.name === "check"
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
  if (!secretIsValid(shape, b.secret)) return refuseInvalidInput(res);
  if (!metadataIsValid(b.platform, b.metadata)) return refuseInvalidInput(res);
  const credential = {
    name: b.name,
    platform: b.platform,
    revisions: [
      {
        id: nextCredentialId(),
        revision: 1,
        metadata: b.metadata,
        createdAt: Date.now(),
        endedAt: null,
      },
    ],
  };
  credentials.push(credential);
  return json(res, 200, credential);
});

on("POST", /^\/api\/llm\/credential\/login$/, (_m, b, res) => {
  const shape = componentEntry("llm", b?.platform)?.secretShape;
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
  if (b.mode !== undefined && b.mode !== "browser" && b.mode !== "device") {
    return credentialEnvelope(
      res,
      400,
      "credential.login.mode_unsupported",
      "Unsupported login mode.",
    );
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
  const now = Date.now();
  const pending = [...loginSessions.values()].some(
    (session) =>
      session.platform === b.platform && session.state === "pending" && session.expiresAt > now,
  );
  if (pending) {
    return credentialEnvelope(res, 409, "credential.login.pending", "Another login is pending.");
  }
  const sessionId = `login_session_01J9ZQ4XKM3B6V8N2R5T7W${String(now % 10000).padStart(4, "0")}`;
  const device = b.platform === "github-copilot" || b.mode === "device";
  const session = {
    sessionId,
    platform: b.platform,
    name: b.name,
    state: "pending",
    startedAt: now,
    expiresAt: now + LOGIN_EXPIRY_MS,
    device,
    codeReceived: false,
  };
  loginSessions.set(sessionId, session);
  return json(res, 200, {
    sessionId,
    address: device ? "https://github.com/login/device" : "https://auth.example.test/authorize",
    code: device ? "MOCK-1234" : null,
    expiresAt: session.expiresAt,
  });
});

const settleLogin = (session) => {
  const now = Date.now();
  if (session.state !== "pending") return;
  if (now >= session.expiresAt) {
    session.state = "expired";
    return;
  }
  const done =
    session.codeReceived ||
    (session.device && now - session.startedAt >= LOGIN_DEVICE_COMPLETION_MS);
  if (!done) return;
  session.state = "completed";
  credentials.push({
    name: session.name,
    platform: session.platform,
    revisions: [
      { id: nextCredentialId(), revision: 1, metadata: null, createdAt: now, endedAt: null },
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
  return json(res, 200, { sessionId: session.sessionId });
});

on("GET", /^\/api\/llm\/credential\/login\/([^/]+)$/, (m, _b, res) => {
  const session = loginSessions.get(decodeURIComponent(m[1]));
  if (session === undefined) {
    return credentialEnvelope(res, 404, "credential.login.not_found", "Login session not found.");
  }
  settleLogin(session);
  return json(res, 200, {
    sessionId: session.sessionId,
    state: session.state,
    lastMessage: session.state === "pending" ? "Waiting for the platform interaction." : null,
    failureReason: null,
  });
});

on("GET", credentialRoute("\\/([^/]+)"), (m, _b, res) => {
  const credential = findCredential(res, m[1], m[2]);
  if (credential === undefined) return undefined;
  drainOlder(credential, Date.now());
  return json(res, 200, { ...credential, ...dependentsOf(m[1], credential) });
});

on("POST", credentialRoute("\\/([^/]+)\\/revision"), (m, b, res) => {
  const credential = findCredential(res, m[1], m[2]);
  if (credential === undefined) return undefined;
  if (refuseArchived(res, credential)) return undefined;
  if (refuseStaleRevision(res, credential, b?.expectedRevision)) return undefined;
  if (!secretIsValid(CREDENTIAL_PLATFORMS[credential.platform].secretShape, b.secret)) {
    return refuseInvalidInput(res);
  }
  const metadata = b.metadata === undefined ? newestLive(credential).metadata : b.metadata;
  if (!metadataIsValid(credential.platform, metadata)) return refuseInvalidInput(res);
  return addRevision(credential, metadata, res);
});

on("PUT", credentialRoute("\\/([^/]+)\\/metadata"), (m, b, res) => {
  const credential = findCredential(res, m[1], m[2]);
  if (credential === undefined) return undefined;
  if (refuseArchived(res, credential)) return undefined;
  if (refuseStaleRevision(res, credential, b?.expectedRevision)) return undefined;
  if (!metadataIsValid(credential.platform, b.metadata)) return refuseInvalidInput(res);
  const current = newestLive(credential).metadata;
  if (credential.platform === "openai-compatible" && current.baseUrl !== b.metadata.baseUrl) {
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
  if (target.endedAt !== null) {
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
  target.endedAt = now;
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
    if (revision.endedAt === null) revision.endedAt = now;
    pinnedRevisions.delete(revision.id);
  }
  return json(res, 200, credential);
});

on("GET", /^\/api\/healthcheck$/, (_m, _b, res) => {
  const owner = { global: {}, projects: {} };
  const globalOf = (component) =>
    Object.fromEntries(
      credentials
        .filter((credential) => componentEntry(component, credential.platform) !== undefined)
        .map((credential) => [
          credential.name,
          {
            status: credential.name.startsWith("bad-") ? "unhealthy" : "healthy",
            capability: HEALTH_CAPABILITIES[credential.platform],
          },
        ]),
    );
  setTimeout(
    () =>
      json(res, 200, {
        services: { project: owner, intake: owner, worker: owner },
        shared: {
          llm: { global: globalOf("llm"), projects: {} },
          repository: { global: globalOf("repository"), projects: {} },
          storage: { global: globalOf("storage"), projects: {} },
        },
      }),
    HEALTHCHECK_DELAY_MS,
  );
});

createServer((req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, null);

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");

  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw.length === 0 ? null : JSON.parse(raw);
    const route = routes.find((r) => r.method === req.method && r.pattern.test(url.pathname));
    if (!route) return refuse(res, 404, "not_found", "No such operation.", url.pathname);

    const open = PUBLIC.some((p) => p.method === req.method && p.path === url.pathname);
    if (!open && token !== DEV_TOKEN) {
      return refuse(res, 401, "unauthorized", "The request carries no valid human token.");
    }
    try {
      route.handler(route.pattern.exec(url.pathname), body, res, token, url);
    } catch (error) {
      refuse(res, 500, "malformed", "The daemon failed to answer.", String(error));
    }
  });
}).listen(PORT, () => {
  process.stdout.write(
    `mock daemon on http://localhost:${PORT} (origin ${ORIGIN}, account ${USERNAME})\ndev token: ${DEV_TOKEN}\n`,
  );
});
