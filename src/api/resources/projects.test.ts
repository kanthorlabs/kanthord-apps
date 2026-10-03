import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import { listProjects } from "./projects";

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

const FIRST = { id: "prj-2", name: "second", bindingSetVersion: 1, createdAt: 2 };
const SECOND = { id: "prj-1", name: "first", bindingSetVersion: 3, createdAt: 1 };

describe("listProjects", () => {
  it("reads every page of project.list", async () => {
    const base = await serve([
      { items: [FIRST], nextCursor: "c-1" },
      { items: [SECOND], nextCursor: null },
    ]);
    setConnection({ baseUrl: base, token: "jwt-1" });

    expect(await listProjects()).toEqual([FIRST, SECOND]);
    expect(seen.map((req) => req.url)).toEqual([
      "/api/project?limit=1000",
      "/api/project?limit=1000&cursor=c-1",
    ]);
    expect(seen[0]?.headers.authorization).toBe("Bearer jwt-1");
  });
});
