import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import { listAgents } from "./workers";

let server: Server | null = null;
const seen: IncomingMessage[] = [];

async function serve(pages: readonly unknown[]): Promise<string> {
  const instance = createServer((req, res) => {
    seen.push(req);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(pages[seen.length - 1]));
  });
  server = instance;
  await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(instance.address() as AddressInfo).port}`;
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

const RE = { agentName: "re@1", workerNames: ["reviewer@1"], enablement: null };
const SWE = { agentName: "swe@1", workerNames: ["general@1"], enablement: null };

describe("listAgents", () => {
  it("reads every page of worker.agent.list", async () => {
    const base = await serve([
      { items: [RE], nextCursor: "c-1" },
      { items: [SWE], nextCursor: null },
    ]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await listAgents()).toEqual([RE, SWE]);
    expect(seen.map((req) => req.url)).toEqual([
      "/api/worker/agent?limit=1000",
      "/api/worker/agent?limit=1000&cursor=c-1",
    ]);
  });
});
