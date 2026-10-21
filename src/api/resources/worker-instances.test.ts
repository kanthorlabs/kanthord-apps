import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import { readServerVersion } from "./gateway";
import {
  archiveWorkerInstance,
  createWorkerInstance,
  listWorkerInstances,
  readWorkerInstance,
  resetWorkerInstanceKey,
} from "./worker-instances";

interface Seen {
  readonly method: string;
  readonly url: string;
  readonly body: string;
  readonly idempotencyKey: string | undefined;
}

let server: Server | null = null;
const seen: Seen[] = [];

async function serve(routes: Readonly<Record<string, string>>): Promise<void> {
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
      const answer = routes[`${method} ${url}`];
      res.writeHead(answer === undefined ? 404 : 200, { "content-type": "application/json" });
      res.end(
        answer ?? JSON.stringify({ error: { code: "gateway.routing.not_found", message: "No." } }),
      );
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

const RECORD = JSON.stringify({ name: "lan-01", revision: 1 });

describe("worker instance resources", () => {
  it("lists the instances of one worker", async () => {
    await serve({
      "GET /api/worker/instance?worker=coder%401&limit=1000": JSON.stringify({
        items: [{ name: "lan-01" }],
        next_cursor: null,
      }),
    });
    expect(await listWorkerInstances("coder@1")).toEqual([{ name: "lan-01" }]);
  });

  it("reads one instance by its encoded name", async () => {
    await serve({ "GET /api/worker/instance/lan-01": RECORD });
    expect(await readWorkerInstance("lan-01")).toEqual({ name: "lan-01", revision: 1 });
  });

  it("creates an instance with an endpoint and an idempotency key", async () => {
    await serve({ "POST /api/worker/instance": RECORD });
    await createWorkerInstance({ name: "lan-01", worker: "coder@1", endpoint: "http://h:31415" });
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      name: "lan-01",
      worker: "coder@1",
      endpoint: "http://h:31415",
    });
    expect(seen[0]?.idempotencyKey).toMatch(/^[0-9A-Z]{26}$/);
  });

  it("resets the key with the endpoint and the expected revision", async () => {
    await serve({ "POST /api/worker/instance/lan-01/revision": RECORD });
    await resetWorkerInstanceKey("lan-01", "http://h:31415", 1);
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({
      endpoint: "http://h:31415",
      expected_revision: 1,
    });
  });

  it("archives with the expected revision", async () => {
    await serve({ "POST /api/worker/instance/lan-01/archive": RECORD });
    await archiveWorkerInstance("lan-01", 2);
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({ expected_revision: 2 });
  });
});

describe("readServerVersion", () => {
  it("reads info.version of the OpenAPI index", async () => {
    await serve({
      "GET /api/openapi.yaml":
        "openapi: 3.1.0\ninfo:\n  title: kanthord\n  version: 28.0.1\npaths: {}\n",
    });
    expect(await readServerVersion()).toBe("28.0.1");
  });

  it("refuses an index without a version", async () => {
    await serve({ "GET /api/openapi.yaml": "openapi: 3.1.0\npaths: {}\n" });
    await expect(readServerVersion()).rejects.toThrow("The OpenAPI index holds no version.");
  });
});
