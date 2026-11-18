import { afterEach, describe, expect, it, vi } from "vitest";

import { AGENT_DECLARATIONS } from "../mock/fixtures.mjs";
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
    projects: [{ id: "project_a", name: "Alpha" }],
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
      expect(stop.data.operation_id).toBe("mission.node.discard");
      const guestEntries = daemon.call("GET", "/api/workbench/guest/session", {}, token).body
        .entries;
      expect(guestEntries.find((entry) => entry.kind === "scope_stop")).toMatchObject({
        tool_call_id: stop.data.tool_call_id,
        operation_id: "mission.node.discard",
      });
    });
  });
});
