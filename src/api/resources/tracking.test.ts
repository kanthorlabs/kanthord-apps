import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import { ApiError } from "../errors";
import {
  listSessionEntryPage,
  listTracePage,
  listTimelinePage,
  listTraceSpans,
  readSessionEntry,
  readTrace,
  readTraceFacets,
  readTraceText,
} from "./tracking";

let server: Server | null = null;
const seen: IncomingMessage[] = [];

async function serve(answers: readonly { status?: number; body: unknown }[]): Promise<string> {
  const instance = createServer((req, res) => {
    const answer = answers[seen.length] ?? { body: null };
    seen.push(req);
    res.writeHead(answer.status ?? 200, { "content-type": "application/json" });
    res.end(JSON.stringify(answer.body));
  });
  server = instance;
  await new Promise<void>((resolve) => instance.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(instance.address() as AddressInfo).port}`;
}

async function connect(answers: readonly { status?: number; body: unknown }[]): Promise<void> {
  setConnection({ baseUrl: await serve(answers), token: "jwt-1" });
}

const notFound = (code: string) => ({
  status: 404,
  body: { error: { code, message: "Unknown.", details: null }, request_id: "req-1" },
});

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

describe("listTracePage", () => {
  it("sends the defined query fields, then the limit, then the cursor", async () => {
    await connect([
      { body: { items: [], next_cursor: "c-2" } },
      { body: { items: [], next_cursor: null } },
    ]);

    expect(
      await listTracePage({ project_id: "prj-1", state: "open", model: undefined }, "c-1", 50),
    ).toEqual({ items: [], next_cursor: "c-2" });
    expect(await listTracePage({ min_cost_usd: 0, sort: "cost_usd" }, null, 20)).toEqual({
      items: [],
      next_cursor: null,
    });
    expect(seen.map((req) => req.url)).toEqual([
      "/api/tracking/trace?project_id=prj-1&state=open&limit=50&cursor=c-1",
      "/api/tracking/trace?min_cost_usd=0&sort=cost_usd&limit=20",
    ]);
    expect(seen[0]?.headers.authorization).toBe("Bearer jwt-1");
  });
});

describe("listTimelinePage", () => {
  it("requests a node scope with depth 2, the limit and no cursor", async () => {
    await connect([{ body: { items: [], next_cursor: null } }]);

    expect(await listTimelinePage({ node_id: "node-1" }, null, 4)).toEqual({
      items: [],
      next_cursor: null,
    });
    expect(seen[0]?.url).toBe("/api/tracking/timeline?node_id=node-1&depth=2&limit=4");
    expect(seen[0]?.headers.authorization).toBe("Bearer jwt-1");
  });

  it("appends the encoded cursor after the limit", async () => {
    await connect([{ body: { items: [], next_cursor: "8" } }]);

    expect(await listTimelinePage({ node_id: "node-1" }, "a/b", 4)).toEqual({
      items: [],
      next_cursor: "8",
    });
    expect(seen[0]?.url).toBe("/api/tracking/timeline?node_id=node-1&depth=2&limit=4&cursor=a%2Fb");
  });

  it("sets the parameters of a project scope and of an execution scope", async () => {
    await connect([
      { body: { items: [], next_cursor: null } },
      { body: { items: [], next_cursor: null } },
    ]);

    await listTimelinePage({ project_id: "prj-1" }, null, 500);
    await listTimelinePage({ execution_id: "exec-1" }, null, 500);

    expect(seen.map((req) => req.url)).toEqual([
      "/api/tracking/timeline?project_id=prj-1&depth=2&limit=500",
      "/api/tracking/timeline?execution_id=exec-1&depth=2&limit=500",
    ]);
  });

  it("sets depth 1 and the range as from and to", async () => {
    await connect([{ body: { items: [], next_cursor: null } }]);

    await listTimelinePage({ node_id: "node-1", depth: 1, from: 1000, to: 2000 }, null, 10);

    expect(seen[0]?.url).toBe(
      "/api/tracking/timeline?node_id=node-1&depth=1&from=1000&to=2000&limit=10",
    );
  });
});

describe("readTrace", () => {
  it("reads one trace by its encoded identifier", async () => {
    await connect([{ body: { trace_id: "a/b" } }]);

    expect(await readTrace("a/b")).toEqual({ trace_id: "a/b" });
    expect(seen.map((req) => req.url)).toEqual(["/api/tracking/trace/a%2Fb"]);
  });

  it("rejects an unknown trace with a not_found ApiError", async () => {
    await connect([notFound("tracking.trace.not_found")]);

    const failure = await readTrace("t-1").catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiError);
    expect(failure).toMatchObject({ code: "not_found", status: 404 });
  });
});

describe("readTraceFacets", () => {
  it("reads the facets of one project and of all projects", async () => {
    const facets = { worker_names: [], agent_names: [], models: [], error_types: [] };
    await connect([{ body: facets }, { body: facets }]);

    expect(await readTraceFacets("prj 1")).toEqual(facets);
    expect(await readTraceFacets(null)).toEqual(facets);
    expect(seen.map((req) => req.url)).toEqual([
      "/api/tracking/facet?project_id=prj%201",
      "/api/tracking/facet",
    ]);
  });
});

describe("listTraceSpans", () => {
  it("reads every page of the spans", async () => {
    await connect([
      { body: { items: [{ span_id: "s-1" }], next_cursor: "c-1" } },
      { body: { items: [{ span_id: "s-2" }], next_cursor: null } },
    ]);

    expect((await listTraceSpans("t-1")).map((span) => span.span_id)).toEqual(["s-1", "s-2"]);
    expect(seen.map((req) => req.url)).toEqual([
      "/api/tracking/trace/t-1/span?limit=1000",
      "/api/tracking/trace/t-1/span?limit=1000&cursor=c-1",
    ]);
  });
});

describe("readTraceText", () => {
  it("reads one text of a trace", async () => {
    await connect([{ body: { text_id: "x/1" } }, notFound("tracking.text.not_found")]);

    expect(await readTraceText("t-1", "x/1")).toEqual({ text_id: "x/1" });
    await expect(readTraceText("t-1", "x-2")).rejects.toMatchObject({ code: "not_found" });
    expect(seen.map((req) => req.url)).toEqual([
      "/api/tracking/trace/t-1/text/x%2F1",
      "/api/tracking/trace/t-1/text/x-2",
    ]);
  });
});

describe("listSessionEntryPage", () => {
  it("sends the limit, the cursor and the tool call filter", async () => {
    await connect([
      { body: { items: [], next_cursor: null } },
      { body: { items: [], next_cursor: null } },
    ]);

    await listSessionEntryPage("t-1", "s/1", null, 100);
    await listSessionEntryPage("t-1", "s/1", "c-1", 25, "call 1");
    expect(seen.map((req) => req.url)).toEqual([
      "/api/tracking/trace/t-1/session/s%2F1/entry?limit=100",
      "/api/tracking/trace/t-1/session/s%2F1/entry?limit=25&cursor=c-1&tool_call_id=call+1",
    ]);
  });
});

describe("readSessionEntry", () => {
  it("reads one entry of a session", async () => {
    await connect([{ body: { entry_id: "e/1" } }, notFound("tracking.entry.not_found")]);

    expect(await readSessionEntry("t-1", "s-1", "e/1")).toEqual({ entry_id: "e/1" });
    await expect(readSessionEntry("t-1", "s-1", "e-2")).rejects.toMatchObject({
      code: "not_found",
    });
    expect(seen.map((req) => req.url)).toEqual([
      "/api/tracking/trace/t-1/session/s-1/entry/e%2F1",
      "/api/tracking/trace/t-1/session/s-1/entry/e-2",
    ]);
  });
});
