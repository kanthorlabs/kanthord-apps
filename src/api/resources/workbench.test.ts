import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import { connectionBaseUrl, setConnection } from "../client";
import { ApiError } from "../errors";
import {
  abortWorkbenchRun,
  approveWorkbenchCall,
  configureWorkbenchSession,
  createInvite,
  createWorkbenchSession,
  forkWorkbenchSession,
  joinInvite,
  listInvites,
  listWorkbenchSessions,
  readGuestSession,
  readWorkbenchEvents,
  readWorkbenchSession,
  removeQueuedWorkbenchMessage,
  reportWorkbenchAction,
  revokeInvite,
  sendGuestMessage,
  sendWorkbenchMessage,
  setWorkbenchAutoMode,
} from "./workbench";

const IDEMPOTENCY_KEY = /^idempotency_key_[0-7][0-9A-HJKMNP-TV-Z]{25}$/;

interface Seen {
  readonly method: string;
  readonly url: string;
  readonly body: string;
  readonly idempotencyKey: string | undefined;
  readonly authorization: string | undefined;
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
        authorization: req.headers.authorization,
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

function connectionBase(): string {
  return connectionBaseUrl() ?? "";
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
      run_active: false,
      pending_approval: null,
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
      run_active: false,
      pending_approval: null,
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
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
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
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });
});

describe("sendWorkbenchMessage", () => {
  const ACCEPTED = {
    session_id: SESSION_ID,
    run_active: true,
    queued_message_id: null,
    cleared: [],
  };

  it("posts the text with the queue delivery by default", async () => {
    await serve({ [`POST ${PATH}/message`]: { status: 202, body: ACCEPTED } });

    await sendWorkbenchMessage(SESSION_ID, "List the nodes");

    expect(JSON.parse(seen[0]!.body)).toEqual({ text: "List the nodes", delivery: "queue" });
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });

  it("posts the replace delivery on request", async () => {
    await serve({ [`POST ${PATH}/message`]: { status: 202, body: ACCEPTED } });

    await sendWorkbenchMessage(SESSION_ID, "Instead", "replace");

    expect(JSON.parse(seen[0]!.body)).toEqual({ text: "Instead", delivery: "replace" });
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

describe("forkWorkbenchSession", () => {
  const FORKED = { session_id: "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB2", run_active: true };

  it("posts the text to the fork path with an idempotency key", async () => {
    await serve({ [`POST ${PATH}/fork`]: { status: 202, body: FORKED } });

    const answer = await forkWorkbenchSession(SESSION_ID, { text: "Next topic" });

    expect(answer).toEqual(FORKED);
    expect(seen[0]!.method).toBe("POST");
    expect(JSON.parse(seen[0]!.body)).toEqual({ text: "Next topic" });
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });

  it("rejects once the signal aborts", async () => {
    await serve({ [`POST ${PATH}/fork`]: { status: 202, body: FORKED } });
    const controller = new AbortController();
    controller.abort();

    const failure = await forkWorkbenchSession(SESSION_ID, {
      text: "Next topic",
      signal: controller.signal,
    }).catch((cause: unknown) => cause);

    expect(failure).toBeInstanceOf(ApiError);
  });

  it("rejects a refused summary with the code and the cause", async () => {
    await serve({
      [`POST ${PATH}/fork`]: {
        status: 409,
        body: {
          error: {
            code: "workbench.fork.summary_refused",
            message: "The guard refused the summary.",
            details: { cause: "refused", reason: "The summary holds an order." },
          },
        },
      },
    });

    const failure = await forkWorkbenchSession(SESSION_ID, { text: "x" }).catch(
      (cause: unknown) => cause,
    );

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).detail).toBe("workbench.fork.summary_refused");
    expect(((failure as ApiError).details as { cause: string }).cause).toBe("refused");
  });

  it("rejects a failed summary with the code", async () => {
    await serve({
      [`POST ${PATH}/fork`]: {
        status: 502,
        body: {
          error: {
            code: "workbench.fork.summary_failed",
            message: "The summary failed.",
          },
        },
      },
    });

    const failure = await forkWorkbenchSession(SESSION_ID, { text: "x" }).catch(
      (cause: unknown) => cause,
    );

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).detail).toBe("workbench.fork.summary_failed");
  });
});

describe("removeQueuedWorkbenchMessage", () => {
  it("sends DELETE to the queue path with an idempotency key", async () => {
    await serve({
      [`DELETE ${PATH}/queue/queued_1`]: {
        body: { session_id: SESSION_ID, queued_message_id: "queued_1" },
      },
    });

    const answer = await removeQueuedWorkbenchMessage(SESSION_ID, "queued_1");

    expect(answer.queued_message_id).toBe("queued_1");
    expect(seen[0]!.method).toBe("DELETE");
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });
});

describe("abortWorkbenchRun", () => {
  it("posts no body", async () => {
    await serve({
      [`POST ${PATH}/abort`]: { body: { session_id: SESSION_ID, run_active: false, cleared: [] } },
    });

    expect((await abortWorkbenchRun(SESSION_ID)).run_active).toBe(false);
    expect(seen[0]!.body).toBe("");
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
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

  it("sends the node name when given", async () => {
    await serve({
      [`POST ${PATH}/approve`]: {
        body: { session_id: SESSION_ID, tool_call_id: "call_1", approved: true },
      },
    });

    await approveWorkbenchCall(SESSION_ID, "call_1", true, "api-node");

    expect(JSON.parse(seen[0]!.body)).toEqual({
      tool_call_id: "call_1",
      approved: true,
      node_name: "api-node",
    });
  });
});

describe("setWorkbenchAutoMode", () => {
  it("posts the switch to the auto-mode route with an idempotency key", async () => {
    const answer = { session_id: SESSION_ID, enabled: false };
    await serve({ [`POST ${PATH}/auto-mode`]: { body: answer } });

    expect(await setWorkbenchAutoMode(SESSION_ID, false)).toEqual(answer);
    expect(JSON.parse(seen[0]!.body)).toEqual({ enabled: false });
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });
});

describe("reportWorkbenchAction", () => {
  const REPORT_PATH = `${PATH}/action/call%2F1/report`;
  const BODY = { outcome: "failed", error_code: "mission.node.state_conflict" } as const;

  it("posts the outcome to the encoded path with an idempotency key", async () => {
    const answer = { session_id: SESSION_ID, tool_call_id: "call/1", outcome: "failed" };
    await serve({ [`POST ${REPORT_PATH}`]: { body: answer } });

    expect(await reportWorkbenchAction(SESSION_ID, "call/1", BODY)).toEqual(answer);
    expect(JSON.parse(seen[0]!.body)).toEqual(BODY);
    expect(seen[0]!.idempotencyKey).toMatch(IDEMPOTENCY_KEY);
  });

  it("rejects a settled action with the code of the owning service", async () => {
    await serve({
      [`POST ${REPORT_PATH}`]: {
        status: 409,
        body: {
          error: {
            code: "workbench.session.action_settled",
            message: "The action is settled.",
          },
        },
      },
    });

    const failure = await reportWorkbenchAction(SESSION_ID, "call/1", BODY).catch(
      (cause: unknown) => cause,
    );

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).code).toBe("conflict");
    expect((failure as ApiError).detail).toBe("workbench.session.action_settled");
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

  it("sends a multi-pair after unchanged", async () => {
    const after = "session-1:entry-9,session-2:entry-4";
    await serve({
      [`GET ${PATH}/events?after=${encodeURIComponent(after)}&version=4`]: { body: EVENTS },
    });

    expect(await readWorkbenchEvents(SESSION_ID, after, 4)).toEqual(EVENTS);
    expect(new URL(seen[0]!.url, "http://x").searchParams.get("after")).toBe(after);
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

describe("invites", () => {
  const INVITE = {
    id: "invite_1",
    invitee_name: "Dana",
    expires_at: 1790000000000,
    projects: [{ id: "project_a", name: "Alpha" }],
  };

  it("creates an invite for the session", async () => {
    await serve({
      [`POST ${PATH}/invite`]: {
        status: 201,
        body: { ...INVITE, session_id: SESSION_ID, invite_token: "invite-secret" },
      },
    });

    const created = await createInvite(SESSION_ID, {
      invitee_name: "Dana",
      project_ids: ["project_b", "project_a", "project_c"],
    });

    expect(JSON.parse(seen[0]!.body)).toEqual({
      invitee_name: "Dana",
      project_ids: ["project_a", "project_b", "project_c"],
    });
    expect(created.invite_token).toBe("invite-secret");
  });

  it("lists the invites of the session", async () => {
    await serve({
      [`GET ${PATH}/invite`]: { body: { items: [INVITE], project_ids: ["project_a"] } },
    });

    expect(await listInvites(SESSION_ID)).toEqual([INVITE]);
  });

  it("revokes an invite by id", async () => {
    await serve({ ["DELETE /api/workbench/invite/invite_1"]: { body: { id: "invite_1" } } });

    expect(await revokeInvite("invite_1")).toEqual({ id: "invite_1" });
  });

  it("reads the invite code of a refused join from the detail", async () => {
    await serve({
      ["POST /api/workbench/invite/join"]: {
        status: 404,
        body: { error: { code: "workbench.invite.not_found", message: "No such invite." } },
      },
    });

    const failure = await joinInvite({ invite_token: "x", name: "Dana" }).catch(
      (cause: unknown) => cause,
    );

    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).detail).toBe("workbench.invite.not_found");
  });
});

describe("joinInvite", () => {
  it("posts the invite token and the name with no authorization", async () => {
    await serve({
      ["POST /api/workbench/invite/join"]: {
        body: {
          guest_token: "guest-issued",
          guest_id: "guest_1",
          name: "Dana",
          session_id: SESSION_ID,
          expires_at: 1790000000000,
        },
      },
    });

    const answer = await joinInvite({ invite_token: "invite-secret", name: "Dana" });

    expect(JSON.parse(seen[0]!.body)).toEqual({ invite_token: "invite-secret", name: "Dana" });
    expect(seen[0]!.authorization).toBeUndefined();
    expect(answer.session_id).toBe(SESSION_ID);
  });
});

describe("guest calls", () => {
  const GUEST_BEARER = "guest-bearer-1";

  it("reads the guest session with the passed connection", async () => {
    await serve({
      ["GET /api/workbench/guest/session"]: {
        body: {
          session_id: SESSION_ID,
          title: "Shared",
          members: [],
          owner_name: "Kanthor Labs",
          entries: [],
          run_active: false,
        },
      },
    });

    const session = await readGuestSession({
      baseUrl: connectionBase(),
      token: GUEST_BEARER,
    });

    expect(session.title).toBe("Shared");
    expect(seen[0]!.authorization).toBe(`Bearer ${GUEST_BEARER}`);
  });

  it("posts the guest message with the passed connection", async () => {
    await serve({
      ["POST /api/workbench/guest/session/message"]: { status: 202, body: { kind: "note" } },
    });

    const answer = await sendGuestMessage(
      { baseUrl: connectionBase(), token: GUEST_BEARER },
      { text: "Hello" },
    );

    expect(JSON.parse(seen[0]!.body)).toEqual({ text: "Hello" });
    expect(seen[0]!.authorization).toBe(`Bearer ${GUEST_BEARER}`);
    expect(answer).toEqual({ kind: "note" });
  });
});
