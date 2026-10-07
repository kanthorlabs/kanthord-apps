import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { setConnection } from "../client";
import { ApiError } from "../errors";
import {
  abortWorkbenchRun,
  approveWorkbenchCall,
  configureWorkbenchSession,
  createWorkbenchSession,
  listWorkbenchSessions,
  readWorkbenchEvents,
  readWorkbenchSession,
  sendWorkbenchMessage,
} from "./workbench";

interface Seen {
  readonly method: string;
  readonly url: string;
  readonly body: string;
  readonly idempotencyKey: string | undefined;
}

let server: Server | null = null;
const seen: Seen[] = [];

async function serve(routes: Readonly<Record<string, { status?: number; body: unknown }>>) {
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
      const route = routes[`${method} ${url}`];
      res.writeHead(route === undefined ? 404 : (route.status ?? 200), {
        "content-type": "application/json",
      });
      res.end(JSON.stringify(route?.body ?? { error: { code: "gateway.routing.not_found" } }));
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

const SESSION_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB1";
const PATH = `/api/workbench/session/${SESSION_ID}`;
const CONFIGURATION = {
  agent_provider: "atlas-llm",
  model_identifier: "qwen3-coder",
  reasoning_effort: "off",
} as const;
const SESSION = {
  id: SESSION_ID,
  agent_name: "swe@1",
  configuration: CONFIGURATION,
  entries: [],
  run_active: false,
};

describe("listWorkbenchSessions", () => {
  it("reads the sessions of one agent from the items of the answer", async () => {
    const item = {
      id: SESSION_ID,
      agent_name: "swe@1",
      name: null,
      created: 1,
      modified: 2,
      message_count: 0,
      first_message: "",
    };
    await serve({ "GET /api/workbench/session?agent_name=swe%401": { body: { items: [item] } } });

    expect(await listWorkbenchSessions("swe@1")).toEqual([item]);
  });

  it("reads the sessions of every agent without a query", async () => {
    const item = {
      id: SESSION_ID,
      agent_name: "re@1",
      name: null,
      created: 1,
      modified: 2,
      message_count: 0,
      first_message: "",
    };
    await serve({ "GET /api/workbench/session": { body: { items: [item] } } });

    expect(await listWorkbenchSessions(null)).toEqual([item]);
  });
});

describe("createWorkbenchSession", () => {
  it("posts the agent name and the configuration with an idempotency key", async () => {
    await serve({ "POST /api/workbench/session": { body: SESSION } });

    expect(await createWorkbenchSession({ agent_name: "swe@1", ...CONFIGURATION })).toEqual(
      SESSION,
    );
    expect(JSON.parse(seen[0]!.body)).toEqual({ agent_name: "swe@1", ...CONFIGURATION });
    expect(seen[0]!.idempotencyKey).toBeTruthy();
  });
});

describe("readWorkbenchSession", () => {
  it("gets the session by its identity", async () => {
    await serve({ [`GET ${PATH}`]: { body: SESSION } });

    expect(await readWorkbenchSession(SESSION_ID)).toEqual(SESSION);
  });
});

describe("configureWorkbenchSession", () => {
  it("puts the whole configuration", async () => {
    await serve({ [`PUT ${PATH}/configuration`]: { body: CONFIGURATION } });

    expect(await configureWorkbenchSession(SESSION_ID, CONFIGURATION)).toEqual(CONFIGURATION);
    expect(JSON.parse(seen[0]!.body)).toEqual(CONFIGURATION);
    expect(seen[0]!.idempotencyKey).toBeTruthy();
  });
});

describe("sendWorkbenchMessage", () => {
  it("posts the text", async () => {
    await serve({
      [`POST ${PATH}/message`]: { status: 202, body: { session_id: SESSION_ID, run_active: true } },
    });

    await sendWorkbenchMessage(SESSION_ID, "List the objectives");

    expect(JSON.parse(seen[0]!.body)).toEqual({ text: "List the objectives" });
    expect(seen[0]!.idempotencyKey).toBeTruthy();
  });

  it("rejects an active run with the code of the owning service", async () => {
    await serve({
      [`POST ${PATH}/message`]: {
        status: 409,
        body: {
          error: {
            code: "workbench.session.run_active",
            message: "The workbench session holds an active run.",
          },
        },
      },
    });

    const failure = await sendWorkbenchMessage(SESSION_ID, "again").catch(
      (cause: unknown) => cause,
    );

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).detail).toBe("workbench.session.run_active");
  });
});

describe("abortWorkbenchRun", () => {
  it("posts no body", async () => {
    await serve({
      [`POST ${PATH}/abort`]: { body: { session_id: SESSION_ID, run_active: false } },
    });

    expect((await abortWorkbenchRun(SESSION_ID)).run_active).toBe(false);
    expect(seen[0]!.body).toBe("");
    expect(seen[0]!.idempotencyKey).toBeTruthy();
  });
});

describe("approveWorkbenchCall", () => {
  it("posts the tool call identity and the verdict", async () => {
    await serve({
      [`POST ${PATH}/approve`]: {
        body: { session_id: SESSION_ID, tool_call_id: "call_1", approved: false },
      },
    });

    await approveWorkbenchCall(SESSION_ID, "call_1", false);

    expect(JSON.parse(seen[0]!.body)).toEqual({ tool_call_id: "call_1", approved: false });
  });
});

describe("readWorkbenchEvents", () => {
  const EVENTS = {
    entries: [],
    snapshot: {
      streaming_message: null,
      pending_tool_calls: [],
      pending_approval: null,
      run_active: false,
      error_message: null,
    },
    version: 3,
  };

  it("sends the id of the last entry as after", async () => {
    await serve({ [`GET ${PATH}/events?after=entry-9`]: { body: EVENTS } });

    expect(await readWorkbenchEvents(SESSION_ID, "entry-9", null)).toEqual(EVENTS);
  });

  it("sends the version that the client holds", async () => {
    await serve({ [`GET ${PATH}/events?after=entry-9&version=4`]: { body: EVENTS } });

    expect(await readWorkbenchEvents(SESSION_ID, "entry-9", 4)).toEqual(EVENTS);
  });

  it("sends no after before the first entry", async () => {
    await serve({ [`GET ${PATH}/events`]: { body: EVENTS } });

    expect(await readWorkbenchEvents(SESSION_ID, null, null)).toEqual(EVENTS);
  });

  it("rejects as unreachable once the signal aborts", async () => {
    await serve({ [`GET ${PATH}/events`]: { body: EVENTS } });
    const controller = new AbortController();
    controller.abort();

    const failure = await readWorkbenchEvents(SESSION_ID, null, null, controller.signal).catch(
      (cause: unknown) => cause,
    );

    expect((failure as ApiError).code).toBe("unreachable");
  });
});
