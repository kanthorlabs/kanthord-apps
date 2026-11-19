import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AGENT_DECLARATIONS,
  PROJECT_ATLAS,
  PROJECT_ORBIT,
  VARIANT_CONVERSATION_ID,
  WORKBENCH_SESSIONS,
} from "../mock/fixtures.mjs";
import { registerWorkbench } from "../mock/workbench.mjs";

const HOST_ID = "workbench_session_0HOSTHOSTHOSTHOSTHOSTHOST";
const CONFIGURATION = {
  agent_provider: "atlas-llm",
  model_identifier: "qwen3-coder",
  reasoning_effort: "off",
};
const WAIT = { timeout: 5000, interval: 25 };

const VARIANT = {
  id: "agent_variant_01J9ZQ4XKM3B6V8N2R5T7W0VA1",
  agent_name: "swe@1",
  display_name: "Software Architecture",
  instruction: "Weigh each change against the structure.",
  revision: 1,
};

const mockDaemon = (extraSessions = []) => {
  const routes = [];
  const sessions = [
    {
      id: HOST_ID,
      agent_name: "ops@1",
      created: Date.now(),
      configuration: CONFIGURATION,
      entries: [],
    },
    ...extraSessions,
  ];
  registerWorkbench({
    on: (method, pattern, handler) => routes.push({ method, pattern, handler }),
    json: (res, status, body) => res.reply({ status, body }),
    envelope: (res, status, code) => res.reply({ status, body: { error: { code } } }),
    agents: structuredClone(AGENT_DECLARATIONS),
    sessions,
    variants: [VARIANT],
    projects: [{ id: "project_a", name: "Alpha" }, PROJECT_ORBIT, PROJECT_ATLAS],
  });
  const call = (method, path, body = {}, token = null) => {
    const url = new URL(path, "http://mock");
    const route = routes.find(
      (candidate) => candidate.method === method && candidate.pattern.test(url.pathname),
    );
    let answer;
    route.handler(
      url.pathname.match(route.pattern),
      body,
      { reply: (a) => (answer = a) },
      token,
      url,
    );
    return answer;
  };
  return { call, sessions };
};

const entriesOf = (daemon) => daemon.call("GET", `/api/workbench/session/${HOST_ID}`).body.entries;

const phaseEntriesOf = (entries) => entries.filter((entry) => entry.phase !== undefined);

const sendPlan = (daemon) =>
  daemon.call("POST", `/api/workbench/session/${HOST_ID}/message`, {
    text: "@Jeremy plan the retry of the payment client",
  });

const planDone = (daemon) =>
  daemon.call("GET", `/api/workbench/session/${HOST_ID}`).body.run_active === false;

describe("workbench mock plan run", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("answers both phase entries in session get for a Jeremy mention in a Yumi conversation", async () => {
    const daemon = mockDaemon();
    sendPlan(daemon);
    await vi.waitFor(() => expect(planDone(daemon)).toBe(true), WAIT);

    const phased = phaseEntriesOf(entriesOf(daemon));

    expect(
      phased.filter((entry) => entry.message.role === "assistant").map((e) => e.phase),
    ).toEqual(["planner", "reviewer"]);
    expect(new Set(phased.map((entry) => entry.agent_name))).toEqual(new Set(["plan@1"]));
  });

  it("opens each phase session with a user message before its assistant text", async () => {
    const daemon = mockDaemon();
    sendPlan(daemon);
    await vi.waitFor(() => expect(phaseEntriesOf(entriesOf(daemon))).toHaveLength(1), WAIT);

    const [opening] = phaseEntriesOf(entriesOf(daemon));

    expect(opening.phase).toBe("planner");
    expect(opening.message.role).toBe("user");
    daemon.call("POST", `/api/workbench/session/${HOST_ID}/abort`);
  });

  it("runs an untagged follow-up after a plan on Jeremy", async () => {
    const daemon = mockDaemon();
    sendPlan(daemon);
    await vi.waitFor(() => expect(planDone(daemon)).toBe(true), WAIT);

    const answer = daemon.call("POST", `/api/workbench/session/${HOST_ID}/message`, {
      text: "and the risks?",
    });

    expect(answer.status).toBe(202);
    expect(answer.body.agent_name).toBe("plan@1");
    daemon.call("POST", `/api/workbench/session/${HOST_ID}/abort`);
  });

  it("lists no phase session after a stop during a phase", async () => {
    const daemon = mockDaemon();
    sendPlan(daemon);
    await vi.waitFor(() => expect(phaseEntriesOf(entriesOf(daemon))).toHaveLength(1), WAIT);

    daemon.call("POST", `/api/workbench/session/${HOST_ID}/abort`);

    expect(phaseEntriesOf(entriesOf(daemon))).toEqual([]);
  });

  it("counts no phase entry in message_count of the list", async () => {
    const daemon = mockDaemon();
    sendPlan(daemon);
    await vi.waitFor(() => expect(planDone(daemon)).toBe(true), WAIT);

    const [item] = daemon.call("GET", "/api/workbench/session").body.items;

    expect(item.message_count).toBe(1);
  });

  describe("the variant conversation", () => {
    const eventsOf = (daemon) =>
      daemon.call("GET", `/api/workbench/session/${VARIANT_CONVERSATION_ID}/events`).body;

    it("routes a leading variant mention to a member keyed by agent_name and variant_id", () => {
      const daemon = mockDaemon();
      const hostId = daemon.sessions[0].id;

      daemon.call("POST", `/api/workbench/session/${hostId}/message`, {
        text: "@Software Architecture review it",
      });
      const { members } = daemon.call("GET", `/api/workbench/session/${hostId}/events`).body;

      expect(members.map(({ agent_name, display_name }) => [agent_name, display_name])).toEqual([
        ["ops@1", "Yumi"],
        ["swe@1", "Software Architecture"],
      ]);
      expect(daemon.sessions.at(-1)).toMatchObject({ agent_name: "swe@1", variant_id: VARIANT.id });
    });

    it("refuses a guest run on a variant mention", () => {
      const daemon = mockDaemon();
      const invite = daemon.call("POST", `/api/workbench/session/${HOST_ID}/invite`, {
        invitee_name: "Dana",
        project_ids: ["project_a"],
        granted_operations: ["mission.node.pause"],
      });
      const joined = daemon.call("POST", "/api/workbench/invite/join", {
        invite_token: invite.body.invite_token,
        name: "Dana",
      });

      const refused = daemon.call(
        "POST",
        "/api/workbench/guest/session/message",
        { text: "@Software Architecture do it" },
        joined.body.guest_token,
      );

      expect(refused.status).toBe(409);
      expect(refused.body.error.code).toBe("workbench.guest.agent_refused");
    });

    it("serves a Yumi host, a Software Architecture member of swe@1 and one queued variant item", () => {
      const daemon = mockDaemon(
        structuredClone(
          WORKBENCH_SESSIONS.filter(
            (session) =>
              session.id === VARIANT_CONVERSATION_ID ||
              session.host_session_id === VARIANT_CONVERSATION_ID,
          ),
        ),
      );

      const { members, snapshot } = eventsOf(daemon);

      expect(members.map(({ agent_name, display_name }) => [agent_name, display_name])).toEqual([
        ["ops@1", "Yumi"],
        ["swe@1", "Software Architecture"],
      ]);
      expect(snapshot.queue).toEqual([
        expect.objectContaining({
          agent_name: "swe@1",
          variant_id: VARIANT.id,
          display_name: "Software Architecture",
        }),
      ]);
    });
  });

  describe("the invite name", () => {
    const createInvite = (daemon, name) =>
      daemon.call("POST", `/api/workbench/session/${HOST_ID}/invite`, {
        invitee_name: name,
        project_ids: ["project_a"],
        granted_operations: [],
      });

    it("accepts a 64-character name with spaces around it and stores it trimmed", () => {
      const daemon = mockDaemon();
      const name = "x".repeat(64);

      const invite = createInvite(daemon, `  ${name}  `);

      expect(invite.status).toBe(200);
      expect(invite.body.invitee_name).toBe(name);
      const joined = daemon.call("POST", "/api/workbench/invite/join", {
        invite_token: invite.body.invite_token,
        name: ` ${name} `,
      });
      expect(joined.status).toBe(200);
      expect(joined.body.name).toBe(name);
    });

    it("refuses an empty name after trim", () => {
      const daemon = mockDaemon();
      const invite = createInvite(daemon, "Dana");

      expect(createInvite(daemon, "   ").status).toBe(400);
      const joined = daemon.call("POST", "/api/workbench/invite/join", {
        invite_token: invite.body.invite_token,
        name: "   ",
      });
      expect(joined.status).toBe(400);
    });
  });

  describe("the granted guest run", () => {
    const guestSession = (daemon) => {
      const invite = daemon.call("POST", `/api/workbench/session/${HOST_ID}/invite`, {
        invitee_name: "Dana",
        project_ids: ["project_a"],
        granted_operations: ["mission.node.pause"],
      });
      const joined = daemon.call("POST", "/api/workbench/invite/join", {
        invite_token: invite.body.invite_token,
        name: "Dana",
      });
      return { invite: invite.body, token: joined.body.guest_token };
    };

    const guardOf = (entries) =>
      entries.find((entry) => entry.type === "custom" && entry.data?.kind === "guard");

    const resultOf = (entries) =>
      entries.find((entry) => entry.message?.role === "toolResult").message;

    const runGuest = async (daemon, token, text) => {
      daemon.call("POST", "/api/workbench/guest/session/message", { text }, token);
      await vi.waitFor(
        () => expect(entriesOf(daemon).at(-1).message?.role).toBe("assistant"),
        WAIT,
      );
    };

    it("records a guard with the grant and a successful result", async () => {
      const daemon = mockDaemon();
      const { invite, token } = guestSession(daemon);

      await runGuest(daemon, token, "@Yumi use the granted act");

      const entries = entriesOf(daemon);
      expect(guardOf(entries).data).toMatchObject({
        reason: "reversible",
        grant: { invite_id: invite.id, author: { kind: "guest", name: "Dana" } },
      });
      expect(resultOf(entries).isError).toBe(false);
    });

    it("records a guard with the grant and a refused result", async () => {
      const daemon = mockDaemon();
      const { token } = guestSession(daemon);

      await runGuest(daemon, token, "@Yumi the refused act");

      const entries = entriesOf(daemon);
      expect(guardOf(entries).data.grant.author.name).toBe("Dana");
      expect(resultOf(entries)).toMatchObject({ isError: true });
      expect(resultOf(entries).content[0].text).toContain("gateway.grant.refused");
    });

    it("carries the scope_stop record in the owner feed and in the guest feed", async () => {
      const daemon = mockDaemon();
      const { token } = guestSession(daemon);

      await runGuest(daemon, token, "@Yumi act outside the shared projects");

      const stop = entriesOf(daemon).find((entry) => entry.data?.kind === "scope_stop");
      expect(stop.data.operation_id).toBe("mission.node.pause");
      const guestEntries = daemon.call("GET", "/api/workbench/guest/session", {}, token).body
        .entries;
      expect(guestEntries.find((entry) => entry.kind === "scope_stop")).toMatchObject({
        tool_call_id: stop.data.tool_call_id,
        operation_id: "mission.node.pause",
      });
    });
  });

  describe("the grant and the scope request", () => {
    const INVITE_PATH = `/api/workbench/session/${HOST_ID}/invite`;
    const ENGINE_GRANTABLE = [
      "mission.dependency.add",
      "mission.dependency.remove",
      "mission.node.block",
      "mission.node.check",
      "mission.node.pause",
      "mission.node.priority.set",
      "mission.node.resume",
      "mission.node.unblock",
      "project.pause",
      "project.resume",
    ];
    const ENGINE_EXPECTED = {
      expected_attempt: 1,
      expected_mission_version: 1,
      expected_state: "Running",
    };

    const invited = (daemon) => {
      const invite = daemon.call("POST", INVITE_PATH, {
        invitee_name: "Dana",
        project_ids: ["project_a"],
        granted_operations: [],
      }).body;
      const [request] = daemon.call("GET", `/api/workbench/session/${HOST_ID}`).body.scope_requests;
      return { invite, request };
    };

    const approve = (daemon, request, body) =>
      daemon.call(
        "POST",
        `/api/workbench/session/${HOST_ID}/scope-request/${request.id}/approve`,
        body,
      );

    it("answers 400 gateway.request.validation_failed for a missing granted_operations", () => {
      const daemon = mockDaemon();

      const answer = daemon.call("POST", INVITE_PATH, {
        invitee_name: "Dana",
        project_ids: ["project_a"],
      });

      expect(answer.status).toBe(400);
      expect(answer.body.error.code).toBe("gateway.request.validation_failed");
    });

    it("seeds a request that targets a project outside the invite", () => {
      const daemon = mockDaemon();

      const { invite, request } = invited(daemon);

      expect(invite.id).toBe(request.invite_id);
      expect(request.project_id).not.toBe("project_a");
      expect(request.operation_id).toBe("mission.node.pause");
      expect(request.expected_keys).toEqual([
        "expected_attempt",
        "expected_mission_version",
        "expected_state",
      ]);
      expect(request.expires_at).toBe(invite.expires_at);
      expect(request.input).toEqual({
        params: { node_id: request.target_id },
        body: { reason: expect.any(String) },
      });
    });

    it("refuses a name in another case and accepts the exact name", () => {
      const daemon = mockDaemon();
      const { request } = invited(daemon);
      const name = [PROJECT_ORBIT, PROJECT_ATLAS].find(
        (project) => project.id === request.project_id,
      ).name;

      const refused = approve(daemon, request, {
        project_name: name.toUpperCase(),
        expected: ENGINE_EXPECTED,
      });
      const accepted = approve(daemon, request, { project_name: name, expected: ENGINE_EXPECTED });

      expect(refused.status).toBe(409);
      expect(refused.body.error.code).toBe("workbench.scope_request.name_mismatch");
      expect(accepted.status).toBe(200);
      expect(accepted.body).toEqual({
        request_id: request.id,
        outcome: "done",
        error_code: null,
      });
    });

    it("lists the grantable set of the engine with no card or read entry", () => {
      const daemon = mockDaemon();

      const { grantable } = daemon.call("GET", INVITE_PATH).body;

      expect(grantable).toHaveLength(10);
      expect(grantable.map((operation) => operation.operation_id).sort()).toEqual(ENGINE_GRANTABLE);
      expect(grantable.filter((operation) => operation.guard_class === "judged")).toHaveLength(2);
      expect(
        grantable.some((operation) =>
          /^(card|read)\b|\.(card|read)\b/.test(operation.operation_id),
        ),
      ).toBe(false);
    });
  });
});

describe("workbench mock notice", () => {
  const NOTICE_SESSION_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0NT1";

  const noticeDaemon = () => {
    const daemon = mockDaemon();
    daemon.sessions.push(
      structuredClone(WORKBENCH_SESSIONS.find((session) => session.id === NOTICE_SESSION_ID)),
    );
    return daemon;
  };

  const noticeOfList = (daemon) =>
    daemon
      .call("GET", "/api/workbench/session")
      .body.items.find((item) => item.id === NOTICE_SESSION_ID).notice;

  it("answers the notice of the last notice record on the list item", () => {
    expect(noticeOfList(noticeDaemon())).toBe("atlas · 2 Completed, 1 Discarded");
  });

  it("answers null after an owner note in the shared conversation", () => {
    const daemon = noticeDaemon();
    const invite = daemon.call("POST", `/api/workbench/session/${NOTICE_SESSION_ID}/invite`, {
      invitee_name: "Dana",
      project_ids: ["project_a"],
      granted_operations: ["mission.node.pause"],
    });
    const note = daemon.call("POST", `/api/workbench/session/${NOTICE_SESSION_ID}/message`, {
      text: "Thanks, I saw it.",
    });
    expect(invite.status).toBe(200);
    expect(note.body.kind).toBe("note");

    expect(noticeOfList(daemon)).toBeNull();
  });
});

describe("workbench mock variant session", () => {
  const createBody = (variantId) => ({
    agent_name: "swe@1",
    ...CONFIGURATION,
    ...(variantId === undefined ? {} : { variant_id: variantId }),
  });

  it("carries the variant id and the variant name in the create, list and get answers", () => {
    const daemon = mockDaemon();

    const created = daemon.call("POST", "/api/workbench/session", createBody(VARIANT.id)).body;
    const listed = daemon
      .call("GET", "/api/workbench/session")
      .body.items.find((item) => item.id === created.id);
    const read = daemon.call("GET", `/api/workbench/session/${created.id}`).body;

    expect(created.variant_id).toBe(VARIANT.id);
    expect(created.members[0].display_name).toBe(VARIANT.display_name);
    expect(listed.variant_id).toBe(VARIANT.id);
    expect(listed.display_name).toBe(VARIANT.display_name);
    expect(read.variant_id).toBe(VARIANT.id);
  });

  it("answers a null variant id for a base session", () => {
    const daemon = mockDaemon();

    const created = daemon.call("POST", "/api/workbench/session", createBody(undefined)).body;

    expect(created.variant_id).toBeNull();
    expect(created.members[0].display_name).toBe("SWE");
  });

  it("refuses a variant that does not exist", () => {
    const daemon = mockDaemon();

    const answer = daemon.call(
      "POST",
      "/api/workbench/session",
      createBody("agent_variant_01J9ZQ4XKM3B6V8N2R5T7W0ZZZ"),
    );

    expect(answer.status).toBe(404);
    expect(answer.body.error.code).toBe("agent.variant.not_found");
  });

  it("refuses a malformed variant id", () => {
    const daemon = mockDaemon();

    const answer = daemon.call("POST", "/api/workbench/session", createBody("agent_variant_none"));

    expect(answer.status).toBe(400);
    expect(answer.body.error.code).toBe("gateway.request.validation_failed");
  });
});
