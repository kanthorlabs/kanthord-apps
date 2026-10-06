import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import {
  disableAgentEnablement,
  enableAgentEnablement,
  listAgents,
  putAgentEnablement,
} from "./workers";

interface Seen {
  readonly method: string;
  readonly url: string;
  readonly body: string;
  readonly idempotencyKey: string | undefined;
}

let server: Server | null = null;
const seen: Seen[] = [];

async function serve(routes: Readonly<Record<string, unknown>>): Promise<void> {
  const instance = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const method = req.method ?? "GET";
      const url = req.url ?? "";
      const header = req.headers["idempotency-key"];
      seen.push({
        method,
        url,
        body,
        idempotencyKey: typeof header === "string" ? header : undefined,
      });
      const key = `${method} ${url}`;
      if (!(key in routes)) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            error: { code: "gateway.routing.not_found", message: "Route not found." },
          }),
        );
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(routes[key]));
    });
  });
  server = instance;
  await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
  setConnection({
    baseUrl: `http://127.0.0.1:${(instance.address() as AddressInfo).port}`,
    token: "jwt-1",
  });
}

afterEach(async () => {
  seen.length = 0;
  setConnection(null);
  const instance = server;
  server = null;
  if (instance === null) return;
  await new Promise<void>((resolve) => {
    instance.close(() => resolve());
    instance.closeAllConnections();
  });
});

const CATALOG_ITEM = { declaredNodeStates: [], requiredNodeFormat: ["objective"] };
const BUDGET = { resourceBudget: { wallTimeMs: 1000 } };

const SWE_ENABLEMENT = {
  agentName: "swe@1",
  state: "enabled",
  agentProviders: [{ name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" }],
  defaultConfiguration: {
    agentProvider: "atlas-llm",
    modelIdentifier: "qwen3-coder",
    reasoningEffort: "off",
  },
  revision: 2,
};

const CATALOG_ROUTES = {
  "GET /api/worker/catalog?limit=1000": {
    items: [
      { name: "general@1", host: "kanthord", ...CATALOG_ITEM },
      { name: "harness@1", host: "external-harness", ...CATALOG_ITEM },
      { name: "reviewer@1", host: "kanthord", ...CATALOG_ITEM },
    ],
    nextCursor: null,
  },
  "GET /api/worker/catalog/general%401": {
    name: "general@1",
    host: "kanthord",
    method: "steps",
    agentName: "swe@1",
    ...CATALOG_ITEM,
    ...BUDGET,
  },
  "GET /api/worker/catalog/reviewer%401": {
    name: "reviewer@1",
    host: "kanthord",
    method: "evaluation",
    agentName: "re@1",
    ...CATALOG_ITEM,
    ...BUDGET,
  },
  "GET /api/agent/enablement?limit=1000": { items: [SWE_ENABLEMENT], nextCursor: null },
};

describe("listAgents", () => {
  it("joins the catalog agents with the enablement list through declared routes only", async () => {
    await serve(CATALOG_ROUTES);

    expect(await listAgents()).toEqual([
      { agentName: "re@1", workerNames: ["reviewer@1"], enablement: null },
      { agentName: "swe@1", workerNames: ["general@1"], enablement: SWE_ENABLEMENT },
    ]);
    expect(seen.map((call) => call.url).sort()).toEqual(
      Object.keys(CATALOG_ROUTES)
        .map((key) => key.slice(4))
        .sort(),
    );
  });
});

const PUT_BODY = {
  agentProviders: [{ name: "router", provider: "openrouter", credential: "router-main" }],
  defaultConfiguration: {
    agentProvider: "router",
    modelIdentifier: "qwen/qwen3-coder",
    reasoningEffort: "off",
  },
} as const;

describe("putAgentEnablement", () => {
  it("creates an enablement without an expected revision", async () => {
    const created = { ...PUT_BODY, agentName: "re@1", state: "enabled", revision: 1 };
    await serve({ "PUT /api/agent/enablement/re%401": created });

    expect(await putAgentEnablement("re@1", PUT_BODY)).toEqual(created);
    expect(seen).toHaveLength(1);
    expect(JSON.parse(seen[0]!.body)).toEqual(PUT_BODY);
    expect(seen[0]!.idempotencyKey).toBeTruthy();
  });
});

describe("enableAgentEnablement and disableAgentEnablement", () => {
  it("post the expected revision to the enable and disable routes", async () => {
    await serve({
      "POST /api/agent/enablement/swe%401/enable": SWE_ENABLEMENT,
      "POST /api/agent/enablement/swe%401/disable": { ...SWE_ENABLEMENT, state: "disabled" },
    });

    await enableAgentEnablement("swe@1", 2);
    await disableAgentEnablement("swe@1", 3);

    expect(seen.map((call) => [call.method, call.url, JSON.parse(call.body)])).toEqual([
      ["POST", "/api/agent/enablement/swe%401/enable", { expectedRevision: 2 }],
      ["POST", "/api/agent/enablement/swe%401/disable", { expectedRevision: 3 }],
    ]);
  });
});
