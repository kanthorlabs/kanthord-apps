/**
 * A development stand-in for the kanthord daemon.
 *
 * It serves the contract that src/api derives from the design set, so the
 * dashboard runs before the daemon exists. It is not part of the application
 * and no module under src/ reaches it.
 */
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
const nodes = structuredClone(fx.NODES);
const projects = [structuredClone(fx.PROJECT)];
const bindings = structuredClone(fx.BINDINGS);

const byId = (id) => nodes.find((n) => n.id === id);

const TERMINAL = ["Completed", "Discarded"];

const closureHolds = (nodeId) => {
  if (fx.CLOSURES[nodeId]) return fx.CLOSURES[nodeId].holds;
  const node = byId(nodeId);
  return (node?.dependsOn ?? []).every((id) => byId(id)?.state === "Completed");
};

const resumeState = (node) => {
  const openAttempt = (fx.ATTEMPTS[node.id] ?? []).find((a) => a.open) ?? null;
  const externalObjects = openAttempt?.externalObjects ?? [];
  if (externalObjects.some((o) => o.resolved && o.observedState !== o.expectedEndState)) {
    return "External.Failed";
  }
  if (
    externalObjects.length > 0 &&
    externalObjects.every((o) => o.resolved && o.observedState === o.expectedEndState)
  ) {
    return "External.Success";
  }
  if (externalObjects.length > 0) return "External.Requested";
  const hasEndedExecution = fx.EXECUTIONS.some(
    (e) => e.nodeId === node.id && e.attemptId === openAttempt?.id && !e.live,
  );
  if (hasEndedExecution) return "Waiting";
  return closureHolds(node.id) ? "Available" : "Pending";
};

const routes = [];
const on = (method, pattern, handler) => routes.push({ method, pattern, handler });

const json = (res, status, body) => {
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": ORIGIN,
    vary: "origin",
    "access-control-allow-headers": "authorization,content-type,accept,idempotency-key",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,OPTIONS",
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

on("GET", /^\/v1\/workers\/templates$/, (_m, _b, res) => json(res, 200, fx.TEMPLATES));
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

on("GET", /^\/v1\/projects\/([^/]+)\/overview$/, (m, _b, res) => {
  const tallies = {};
  for (const n of nodes) if (n.state) tallies[n.state] = (tallies[n.state] ?? 0) + 1;
  return json(res, 200, {
    projectId: m[1],
    tallies: Object.entries(tallies).map(([state, count]) => ({ state, count })),
    blockedCount: nodes.filter((n) => n.state === "Blocked").length,
    liveExecutionCount: fx.EXECUTIONS.filter((e) => e.live).length,
    instanceCapacity: fx.INSTANCES.length,
    instancesHealthy: fx.INSTANCES.filter((i) => i.healthcheckPasses).length,
    inboxDepth: fx.DELIVERIES.length,
  });
});

on("GET", /^\/v1\/projects\/[^/]+\/mission\/nodes$/, (_m, _b, res) => json(res, 200, nodes));

on("GET", /^\/v1\/projects\/[^/]+\/mission\/blocked$/, (_m, _b, res) =>
  json(
    res,
    200,
    nodes
      .filter((n) => n.state === "Blocked")
      .map((node) => {
        const attempts = fx.ATTEMPTS[node.id] ?? [];
        const closedAttempt = attempts.find((a) => !a.open) ?? attempts[0] ?? null;
        return {
          node,
          closedAttempt,
          condition:
            closedAttempt?.assessments.find((a) => a.id === closedAttempt.outcome?.assessmentId)
              ?.actor.kind === "human"
              ? "human reason on a paused node"
              : closedAttempt?.outcome?.assertedResult === "nothing established"
                ? "an External.Failed observation"
                : "a current assessment that does not pass",
        };
      })
      .filter((b) => b.closedAttempt !== null),
  ),
);

on("GET", /^\/v1\/projects\/[^/]+\/mission\/nodes\/([^/]+)\/revisions$/, (m, _b, res) =>
  json(res, 200, fx.REVISIONS[m[1]] ?? []),
);
on("GET", /^\/v1\/projects\/[^/]+\/mission\/nodes\/([^/]+)\/attempts$/, (m, _b, res) =>
  json(res, 200, fx.ATTEMPTS[m[1]] ?? []),
);
on("GET", /^\/v1\/projects\/[^/]+\/mission\/nodes\/([^/]+)\/closure$/, (m, _b, res) => {
  const node = byId(m[1]);
  return json(
    res,
    200,
    fx.CLOSURES[m[1]] ?? {
      nodeId: m[1],
      members: (node?.dependsOn ?? []).map((id) => ({
        nodeId: id,
        title: byId(id)?.title ?? id,
        state: byId(id)?.state ?? null,
      })),
      holds: (node?.dependsOn ?? []).every((id) => byId(id)?.state === "Completed"),
    },
  );
});
on("GET", /^\/v1\/projects\/[^/]+\/mission\/nodes\/([^/]+)$/, (m, _b, res) => {
  const node = byId(m[1]);
  return node ? json(res, 200, node) : refuse(res, 404, "not_found", "No such node.");
});

const transition = (m, res, next, guard) => {
  const node = byId(m[1]);
  if (!node) return refuse(res, 404, "not_found", "No such node.");
  const problem = guard?.(node);
  if (problem) return refuse(res, 412, "precondition_failed", problem);
  node.state = next;
  return json(res, 200, node);
};

on("POST", /^\/v1\/projects\/[^/]+\/mission\/nodes\/([^/]+)\/pause$/, (m, _b, res) =>
  transition(m, res, "Paused", (n) => {
    if (TERMINAL.includes(n.state)) return "A terminal node holds no further transition.";
    if (n.state === "Blocked") return "A blocked node holds no pause transition.";
    if (n.state === "Paused") return "A paused node is already paused.";
    return null;
  }),
);
on("POST", /^\/v1\/projects\/[^/]+\/mission\/nodes\/([^/]+)\/resume$/, (m, _b, res) => {
  const node = byId(m[1]);
  if (!node) return refuse(res, 404, "not_found", "No such node.");
  if (node.state !== "Paused")
    return refuse(res, 412, "precondition_failed", "Only a paused node resumes.");
  node.state = resumeState(node);
  return json(res, 200, node);
});
on("POST", /^\/v1\/projects\/[^/]+\/mission\/nodes\/([^/]+)\/block$/, (m, b, res) =>
  transition(m, res, "Blocked", (n) => {
    if (n.state !== "Paused")
      return "A human blocks a paused node, and that path is the only human block.";
    if (!b?.reason) return "The block carries a human reason.";
    return null;
  }),
);
on("POST", /^\/v1\/projects\/[^/]+\/mission\/nodes\/([^/]+)\/unblock$/, (m, b, res) => {
  const node = byId(m[1]);
  if (!node) return refuse(res, 404, "not_found", "No such node.");
  if (node.state !== "Blocked")
    return refuse(res, 412, "precondition_failed", "The node is not blocked.");
  if (b?.expectedRevisionId !== node.currentRevisionId) {
    return refuse(
      res,
      409,
      "conflict",
      "The expected revision is superseded.",
      `Current revision ${node.currentRevisionId}.`,
    );
  }
  node.state = closureHolds(node.id) ? "Available" : "Pending";
  node.attemptCounter += 1;
  return json(res, 200, {
    id: `ub-${Math.random().toString(36).slice(2, 8)}`,
    nodeId: node.id,
    clearedAttemptId: b.clearedAttemptId,
    expectedRevisionId: b.expectedRevisionId,
    actor: USERNAME,
    time: new Date().toISOString(),
  });
});
on("POST", /^\/v1\/projects\/[^/]+\/mission\/nodes\/([^/]+)\/override$/, (m, b, res) =>
  transition(m, res, "Completed", (n) => {
    if (TERMINAL.includes(n.state)) return "No human override reaches a terminal node.";
    if (!b?.reason) return "The override carries a human decision.";
    return null;
  }),
);
on("POST", /^\/v1\/projects\/[^/]+\/mission\/nodes\/([^/]+)\/discard$/, (m, b, res) =>
  transition(m, res, "Discarded", (n) => {
    if (TERMINAL.includes(n.state)) return "A terminal state opens no further attempt.";
    if (!b?.stoppingReason) return "The discard carries a stopping reason.";
    return null;
  }),
);
on("PUT", /^\/v1\/projects\/[^/]+\/mission\/nodes\/([^/]+)\/priority$/, (m, b, res) => {
  const node = byId(m[1]);
  if (!node) return refuse(res, 404, "not_found", "No such node.");
  if (TERMINAL.includes(node.state))
    return refuse(res, 412, "precondition_failed", "A terminal node takes no priority.");
  if (node.state === "Executing" || node.state === "Evaluating")
    return refuse(res, 412, "precondition_failed", "A claim holds the node.");
  node.priority = Number(b?.priority ?? 0);
  return json(res, 200, node);
});

on("GET", /^\/v1\/projects\/[^/]+\/scheduler\/queue$/, (_m, _b, res) =>
  json(
    res,
    200,
    [...fx.QUEUE].sort((a, x) => x.priority - a.priority || a.createdAt.localeCompare(x.createdAt)),
  ),
);
const freshen = (execution) =>
  execution.live
    ? {
        ...execution,
        lease: {
          expiresAt: new Date(Date.now() + 95_000).toISOString(),
          renewedAt: new Date(Date.now() - 25_000).toISOString(),
        },
      }
    : execution;

on("GET", /^\/v1\/projects\/[^/]+\/scheduler\/executions$/, (_m, _b, res, _t, url) => {
  const all = fx.EXECUTIONS.map(freshen);
  return json(res, 200, url.searchParams.get("scope") === "live" ? all.filter((e) => e.live) : all);
});
on("GET", /^\/v1\/projects\/[^/]+\/scheduler\/eligibility\/([^/]+)$/, (m, _b, res) =>
  json(res, 200, fx.ELIGIBILITY[m[1]] ?? { nodeId: m[1], checks: [] }),
);

on("GET", /^\/v1\/projects\/[^/]+\/workers\/instances$/, (_m, _b, res) =>
  json(res, 200, fx.INSTANCES),
);
on("GET", /^\/v1\/projects\/[^/]+\/bindings$/, (_m, _b, res) => json(res, 200, bindings));
on("PUT", /^\/v1\/projects\/[^/]+\/bindings\/([^/]+)\/availability$/, (m, b, res) => {
  const binding = bindings.find((x) => x.id === m[1]);
  if (!binding) return refuse(res, 404, "not_found", "No such binding.");
  binding.available = Boolean(b?.available);
  binding.revision += 1;
  return json(res, 200, binding);
});
on("PUT", /^\/v1\/projects\/[^/]+\/bindings\/([^/]+)\/instance-count$/, (m, b, res) => {
  const binding = bindings.find((x) => x.id === m[1]);
  if (!binding) return refuse(res, 404, "not_found", "No such binding.");
  const count = Number(b?.instanceCount);
  if (!Number.isInteger(count) || count < 0)
    return refuse(res, 422, "refused", "The instance count is a whole number.");
  binding.instanceCount = count;
  binding.revision += 1;
  return json(res, 200, binding);
});
on("GET", /^\/v1\/projects\/[^/]+\/client-identities$/, (_m, _b, res) =>
  json(res, 200, fx.CLIENT_IDENTITIES),
);
on("POST", /^\/v1\/projects\/[^/]+\/client-identities\/([^/]+)\/rotate$/, (_m, _b, res) =>
  json(res, 200, {
    clientSecret: `cs-${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`,
  }),
);
on("GET", /^\/v1\/projects\/[^/]+\/deliveries$/, (_m, _b, res) => json(res, 200, fx.DELIVERIES));

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
