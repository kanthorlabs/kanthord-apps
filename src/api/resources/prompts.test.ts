import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";

import {
  putPromptText,
  readPromptSettings,
  setSystemLayerOverride,
  switchPromptSource,
} from "./prompts";

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

const SETTINGS = {
  scope: "agent",
  agentName: "swe@1",
  switches: { agent_file: true, shipped: true, custom: true },
  customText: "",
  system_layer: "inherit",
  revision: 2,
};

describe("prompt settings resources", () => {
  it("reads the settings of a scope", async () => {
    await serve({ "GET /api/agent/prompt?scope=agent&agentName=swe%401": SETTINGS });

    expect(await readPromptSettings({ scope: "agent", agentName: "swe@1" })).toEqual(SETTINGS);
  });

  it("switches a source at its revision and omits an absent revision", async () => {
    await serve({ "POST /api/agent/prompt/switch": SETTINGS });

    await switchPromptSource({ scope: "agent", agentName: "swe@1" }, 2, "custom", false);
    await switchPromptSource({ scope: "system" }, 0, "layer", false);

    expect(seen.map((call) => JSON.parse(call.body))).toEqual([
      { scope: "agent", agentName: "swe@1", expectedRevision: 2, switch: "custom", enabled: false },
      { scope: "system", switch: "layer", enabled: false },
    ]);
    expect(seen.every((call) => call.idempotencyKey !== undefined)).toBe(true);
  });

  it("sets the system layer override of an agent", async () => {
    await serve({ "POST /api/agent/prompt/switch": SETTINGS });

    await setSystemLayerOverride("swe@1", 2, "off");

    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      scope: "agent",
      agentName: "swe@1",
      expectedRevision: 2,
      system_layer: "off",
    });
  });

  it("replaces the custom text of a scope at its revision", async () => {
    await serve({ "PUT /api/agent/prompt": SETTINGS });

    await putPromptText({ scope: "agent", agentName: "swe@1" }, 2, "# Rules");

    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      scope: "agent",
      agentName: "swe@1",
      expectedRevision: 2,
      customText: "# Rules",
    });
    expect(seen[0]?.idempotencyKey).toBeDefined();
  });
});
