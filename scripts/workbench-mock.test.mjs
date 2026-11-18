import { afterEach, describe, expect, it, vi } from "vitest";

import { AGENT_DECLARATIONS, PROJECT_ATLAS, PROJECT_ORBIT } from "../mock/fixtures.mjs";
import { registerWorkbench } from "../mock/workbench.mjs";

const HOST_ID = "workbench_session_0HOSTHOSTHOSTHOSTHOSTHOST";
const CONFIGURATION = {
  agent_provider: "atlas-llm",
  model_identifier: "qwen3-coder",
  reasoning_effort: "off",
};
const WAIT = { timeout: 5000, interval: 25 };

const mockDaemon = () => {
  const routes = [];
  const sessions = [
    {
      id: HOST_ID,
      agent_name: "ops@1",
      created: Date.now(),
      configuration: CONFIGURATION,
      entries: [],
    },
  ];
  registerWorkbench({
    on: (method, pattern, handler) => routes.push({ method, pattern, handler }),
    json: (res, status, body) => res.reply({ status, body }),
    envelope: (res, status, code) => res.reply({ status, body: { error: { code } } }),
    agents: structuredClone(AGENT_DECLARATIONS),
    sessions,
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
  return { call };
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
