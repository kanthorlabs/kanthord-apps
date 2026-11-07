import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import {
  archiveWorkerMachine,
  createWorkerMachine,
  listWorkerMachines,
  readWorkerMachine,
  rotateWorkerMachineKey,
} from "./worker-machines";

const IDEMPOTENCY_KEY = /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

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

const RECORD = JSON.stringify({ name: "m-01", revision: 1 });

describe("worker machine resources", () => {
  it("lists the machines with the page limit", async () => {
    await serve({
      "GET /api/worker/machine?limit=1000": JSON.stringify({
        items: [{ name: "m-01", instance_count: 2 }],
        next_cursor: null,
      }),
    });
    expect(await listWorkerMachines()).toEqual([{ name: "m-01", instance_count: 2 }]);
  });

  it("reads one machine by its encoded name", async () => {
    await serve({ "GET /api/worker/machine/m-01": RECORD });
    expect(await readWorkerMachine("m-01")).toEqual({ name: "m-01", revision: 1 });
  });

  it("creates a machine with its name and an idempotency key", async () => {
    await serve({ "POST /api/worker/machine": RECORD });
    await createWorkerMachine({ name: "m-01" });
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({ name: "m-01" });
    expect(seen[0]?.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });

  it("rotates the key with the expected revision and an idempotency key", async () => {
    await serve({ "POST /api/worker/machine/m-01/revision": RECORD });
    await rotateWorkerMachineKey("m-01", 1);
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({ expected_revision: 1 });
    expect(seen[0]?.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });

  it("archives with the expected revision and an idempotency key", async () => {
    await serve({ "POST /api/worker/machine/m-01/archive": RECORD });
    await archiveWorkerMachine("m-01", 2);
    expect(JSON.parse(seen[0]?.body ?? "")).toEqual({ expected_revision: 2 });
    expect(seen[0]?.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });
});
