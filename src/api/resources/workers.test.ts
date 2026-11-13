import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import {
  addAgentProvider,
  disableAgentEnablement,
  enableAgentEnablement,
  listAgentProviderModels,
  listAgents,
  listCredentialModels,
  putAgentEnablement,
  readAgent,
  readAgentEnablement,
  removeAgentProvider,
  resolveAgentPrompt,
} from "./workers";

const IDEMPOTENCY_KEY = /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

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

const SWE_ENABLEMENT = {
  agent_name: "swe@1",
  state: "enabled",
  agent_providers: [{ name: "atlas-llm", provider: "openai-compatible", credential: "atlas-main" }],
  default_configuration: {
    agent_provider: "atlas-llm",
    model_identifier: "qwen3-coder",
    reasoning_effort: "off",
  },
  revision: 2,
};

const NO_TOOLS = { builtin: 0, "kanthord-mcp": 0, host: 0, operation: 0 };

const OPS_ITEM = {
  agent_name: "ops@1",
  display_name: "Yumi",
  worker_names: [],
  consumers: ["workbench"],
  tool_counts: { ...NO_TOOLS, operation: 3 },
  enablement: null,
};

const RE_ITEM = {
  agent_name: "re@1",
  display_name: "RE",
  worker_names: ["reviewer@1"],
  consumers: ["workbench", "worker"],
  tool_counts: { ...NO_TOOLS, builtin: 4 },
  enablement: null,
};

const SWE_ITEM = {
  agent_name: "swe@1",
  display_name: "SWE",
  worker_names: ["coder@1"],
  consumers: ["workbench", "worker"],
  tool_counts: { ...NO_TOOLS, builtin: 7, host: 1 },
  enablement: SWE_ENABLEMENT,
};

describe("listAgents", () => {
  it("reads one agent list and no worker catalog route", async () => {
    const routes = {
      "GET /api/agent?limit=1000": { items: [OPS_ITEM, RE_ITEM, SWE_ITEM], next_cursor: null },
    };
    await serve(routes);

    await listAgents();

    expect(seen.map((call) => call.url)).toEqual(["/api/agent?limit=1000"]);
  });

  it("maps an agent that no worker names", async () => {
    await serve({
      "GET /api/agent?limit=1000": { items: [OPS_ITEM, RE_ITEM, SWE_ITEM], next_cursor: null },
    });

    const agents = await listAgents();

    expect(agents.map((agent) => agent.agentName)).toEqual(["ops@1", "re@1", "swe@1"]);
    expect(agents[0]).toEqual({
      agentName: "ops@1",
      displayName: "Yumi",
      workerNames: [],
      consumers: ["workbench"],
      toolCounts: { ...NO_TOOLS, operation: 3 },
      enablement: null,
    });
    expect(agents[2]?.enablement).toEqual(SWE_ENABLEMENT);
  });

  it("follows next_cursor across pages", async () => {
    await serve({
      "GET /api/agent?limit=1000": { items: [OPS_ITEM], next_cursor: "ops@1" },
      "GET /api/agent?limit=1000&cursor=ops%401": { items: [RE_ITEM, SWE_ITEM], next_cursor: null },
    });

    const agents = await listAgents();

    expect(agents.map((agent) => agent.agentName)).toEqual(["ops@1", "re@1", "swe@1"]);
    expect(seen).toHaveLength(2);
  });
});

const PUT_BODY = {
  agent_providers: [{ name: "router", provider: "openrouter", credential: "router-main" }],
  default_configuration: {
    agent_provider: "router",
    model_identifier: "qwen/qwen3-coder",
    reasoning_effort: "off",
  },
  fallback_configurations: [
    { agent_provider: "router", model_identifier: "qwen/qwen3-max", reasoning_effort: "off" },
  ],
} as const;

describe("putAgentEnablement", () => {
  it("creates an enablement without an expected revision", async () => {
    const created = { ...PUT_BODY, agent_name: "re@1", state: "enabled", revision: 1 };
    await serve({ "PUT /api/agent/enablement/re%401": created });

    expect(await putAgentEnablement("re@1", PUT_BODY)).toEqual(created);
    expect(seen).toHaveLength(1);
    expect(JSON.parse(seen[0]!.body)).toEqual(PUT_BODY);
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });
});

describe("addAgentProvider", () => {
  it("posts the named agent provider with the expected revision and an idempotency key", async () => {
    const body = {
      expected_revision: 3,
      name: "codex",
      provider: "openai-codex",
      credential: "openai-codex-elsa",
    } as const;
    const revised = { ...PUT_BODY, agent_name: "re@1", state: "enabled", revision: 4 };
    await serve({ "POST /api/agent/enablement/re%401/provider": revised });

    expect(await addAgentProvider("re@1", body)).toEqual(revised);
    expect(JSON.parse(seen[0]!.body)).toEqual(body);
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });
});

describe("removeAgentProvider", () => {
  it("deletes the named agent provider with the expected revision", async () => {
    const revised = { ...PUT_BODY, agent_name: "re@1", state: "enabled", revision: 5 };
    await serve({ "DELETE /api/agent/enablement/re%401/provider/codex": revised });

    expect(await removeAgentProvider("re@1", "codex", 4)).toEqual(revised);
    expect(JSON.parse(seen[0]!.body)).toEqual({ expected_revision: 4 });
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });
});

describe("listAgentProviderModels", () => {
  it("reads the items of the model list of one agent provider", async () => {
    const items = [
      { model_identifier: "qwen3-coder", reasoning_efforts: ["off", "high"] },
      { model_identifier: "plain", reasoning_efforts: [] },
    ];
    await serve({ "GET /api/agent/enablement/swe%401/provider/atlas%20llm/model": { items } });

    expect(await listAgentProviderModels("swe@1", "atlas llm")).toEqual(items);
    expect(seen.map((call) => [call.method, call.url])).toEqual([
      ["GET", "/api/agent/enablement/swe%401/provider/atlas%20llm/model"],
    ]);
  });
});

describe("listCredentialModels", () => {
  it("reads the items of the model list of one credential", async () => {
    const items = [{ model_identifier: "gpt-5.5", reasoning_efforts: ["low", "high"] }];
    await serve({ "GET /api/agent/model?provider=openai-codex&credential=codex+main": { items } });

    expect(await listCredentialModels("openai-codex", "codex main")).toEqual(items);
    expect(seen.map((call) => [call.method, call.url])).toEqual([
      ["GET", "/api/agent/model?provider=openai-codex&credential=codex+main"],
    ]);
  });
});

describe("readAgentEnablement", () => {
  it("gets the enablement of one agent", async () => {
    await serve({ "GET /api/agent/enablement/swe%401": SWE_ENABLEMENT });

    expect(await readAgentEnablement("swe@1")).toEqual(SWE_ENABLEMENT);
    expect(seen.map((call) => [call.method, call.url])).toEqual([
      ["GET", "/api/agent/enablement/swe%401"],
    ]);
  });
});

describe("readAgent", () => {
  it("reads the stack of one repository binding when a scope is given", async () => {
    const answer = { agent_name: "re@1" };
    await serve({
      "GET /api/agent/re%401": answer,
      "GET /api/agent/re%401?project_id=prj-1&binding_id=binding-7": answer,
    });

    await readAgent("re@1");
    await readAgent("re@1", { projectId: "prj-1", bindingId: "binding-7" });

    expect(seen.map((call) => call.url)).toEqual([
      "/api/agent/re%401",
      "/api/agent/re%401?project_id=prj-1&binding_id=binding-7",
    ]);
  });
});

describe("resolveAgentPrompt", () => {
  it("gets agent.prompt.resolve with the execution and the agent", async () => {
    const answer = { parts: [], final: null, engine_version: "0.1.0" };
    await serve({ "GET /api/agent/prompt/resolve?execution_id=exec-1&agent_name=re%401": answer });

    expect(await resolveAgentPrompt("exec-1", "re@1")).toEqual(answer);
    expect(seen.map((call) => [call.method, call.url])).toEqual([
      ["GET", "/api/agent/prompt/resolve?execution_id=exec-1&agent_name=re%401"],
    ]);
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
      ["POST", "/api/agent/enablement/swe%401/enable", { expected_revision: 2 }],
      ["POST", "/api/agent/enablement/swe%401/disable", { expected_revision: 3 }],
    ]);
  });
});
