import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import { listProjectExecutionPage } from "./scheduler";

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

describe("listProjectExecutionPage", () => {
  it("reads one page of the project executions at the cursor and the limit", async () => {
    const base = await serve([
      { items: [], next_cursor: "c-1" },
      { items: [], next_cursor: null },
    ]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await listProjectExecutionPage("prj-1", null, 20)).toEqual({
      items: [],
      next_cursor: "c-1",
    });
    expect(await listProjectExecutionPage("prj-1", "c-1", 20)).toEqual({
      items: [],
      next_cursor: null,
    });
    expect(seen.map((req) => req.url)).toEqual([
      "/api/scheduler/project/prj-1/execution?limit=20",
      "/api/scheduler/project/prj-1/execution?limit=20&cursor=c-1",
    ]);
  });
});
