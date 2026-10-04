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
on("GET", /^\/api\/worker\/agent$/, (_m, _b, res) =>
  json(res, 200, {
    items: fx.AGENT_DECLARATIONS.map(({ agentName, workerNames, enablement }) => ({
      agentName,
      workerNames,
      enablement,
    })),
    nextCursor: null,
  }),
);
on("GET", /^\/api\/worker\/agent\/([^/]+)$/, (m, _b, res) => {
  const declaration = fx.AGENT_DECLARATIONS.find((a) => a.agentName === decodeURIComponent(m[1]));
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

on("GET", /^\/v1\/projects\/[^/]+\/deliveries$/, (_m, _b, res) => json(res, 200, fx.DELIVERIES));

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

const graphNodeRead = (node) => {
  if (node.state !== "Blocked") return node;
  const outcome = fx.GRAPH_OUTCOMES.filter((item) => item.nodeId === node.id).at(-1);
  return outcome === undefined ? node : { ...node, blockedContext: { outcome, requests: [] } };
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
