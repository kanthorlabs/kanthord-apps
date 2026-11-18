import { describe, expect, it } from "vitest";

import type { WorkbenchMember, WorkbenchRunSnapshot, WorkbenchSessionEntry } from "@/api/types";
import { WORKBENCH_FORK_FRAME, WORKBENCH_FORK_PREFIX } from "@/api/types";
import {
  ACTION_VERBS,
  agentWorking,
  type ChatItem,
  chatItemsOf,
  memberOf,
  runErrorTargetId,
  runRequestOf,
  summaryOf,
  unresolvedLine,
  workbenchPathsIn,
} from "./workbench-chat";

const IDLE: WorkbenchRunSnapshot = {
  streaming_message: null,
  pending_tool_calls: [],
  pending_approval: null,
  queue: [],
  run_active: false,
  error_message: null,
  auto_mode: true,
  phase: null,
  scope_requests: [],
};

const HOST: WorkbenchMember = { session_id: "host-1", agent_name: "ops@1", display_name: "Yumi" };
const GUEST: WorkbenchMember = { session_id: "guest-1", agent_name: "re@1", display_name: "RE" };
const MEMBERS = [HOST, GUEST];

function stripOrigin<T extends ChatItem>(item: T) {
  const { session_id: _s, agent_name: _a, display_name: _d, ...body } = item;
  return body;
}

function bodyItemsOf(
  entries: readonly WorkbenchSessionEntry[],
  snapshot: WorkbenchRunSnapshot,
): readonly ChatItem[] {
  return chatItemsOf(entries, snapshot, MEMBERS);
}

function message(id: string, body: Record<string, unknown>): WorkbenchSessionEntry {
  return {
    session_id: HOST.session_id,
    agent_name: HOST.agent_name,
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-10-05T09:00:00.000Z",
    message: body,
  };
}

const AT = Date.parse("2026-10-05T09:00:00.000Z");

const CALL = { type: "toolCall", id: "call_1", name: "mission.node.list", arguments: { a: 1 } };

describe("chatItemsOf", () => {
  it("keeps user, assistant, tool call and tool result entries in order", () => {
    const items = bodyItemsOf(
      [
        message("e1", { role: "user", content: "List the nodes" }),
        message("e2", { role: "assistant", content: [{ type: "text", text: "Reading." }, CALL] }),
        message("e3", {
          role: "toolResult",
          toolCallId: "call_1",
          toolName: "mission.node.list",
          isError: true,
          content: [{ type: "text", text: "refused" }],
        }),
      ],
      IDLE,
    );

    expect(items.map(stripOrigin)).toEqual([
      { kind: "user", id: "e1", text: "List the nodes", timestamp: AT },
      { kind: "assistant", id: "e2", text: "Reading.", streaming: false, timestamp: AT },
      {
        kind: "tool-call",
        id: "e2:call_1",
        name: "mission.node.list",
        input: JSON.stringify({ a: 1 }, null, 2),
        state: "done",
        guard: null,
      },
      { kind: "tool-result", id: "e3", name: "mission.node.list", text: "refused", isError: true },
    ]);
  });

  it("labels each item with the member of its session in the order of the entries", () => {
    const guest = (id: string, body: Record<string, unknown>): WorkbenchSessionEntry => ({
      ...message(id, body),
      session_id: GUEST.session_id,
      agent_name: GUEST.agent_name,
    });

    const items = bodyItemsOf(
      [
        message("e1", {
          role: "assistant",
          content: [{ type: "text", text: "Hello, I am Yumi." }],
        }),
        guest("e1", { role: "assistant", content: [{ type: "text", text: "RE here." }] }),
        message("e2", { role: "assistant", content: [{ type: "text", text: "Back to Yumi." }] }),
      ],
      IDLE,
    );

    expect(
      items.map((item) => [
        item.kind === "assistant" && item.text,
        item.session_id,
        item.display_name,
      ]),
    ).toEqual([
      ["Hello, I am Yumi.", "host-1", "Yumi"],
      ["RE here.", "guest-1", "RE"],
      ["Back to Yumi.", "host-1", "Yumi"],
    ]);
    expect(items.map((item) => item.agent_name)).toEqual(["ops@1", "re@1", "ops@1"]);
  });

  it("renders the greeting as the first host assistant item", () => {
    const items = bodyItemsOf(
      [message("e1", { role: "assistant", content: "Hello, I am Yumi." })],
      IDLE,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "assistant",
      text: "Hello, I am Yumi.",
      session_id: "host-1",
      display_name: "Yumi",
    });
  });

  it("renders nothing for a relay entry", () => {
    const relay: WorkbenchSessionEntry = {
      session_id: GUEST.session_id,
      agent_name: GUEST.agent_name,
      type: "custom_message",
      id: "e5",
      parentId: null,
      timestamp: "2026-10-05T09:00:00.000Z",
      customType: "kanthord.workbench.relay",
      display: false,
      message: { role: "user", content: "Relayed text" },
    };

    expect(bodyItemsOf([relay], IDLE)).toEqual([]);
  });

  it("labels the streaming text with the member of the last entry", () => {
    const entries = [
      { ...message("e1", { role: "user", content: "@RE look" }), session_id: GUEST.session_id },
    ];

    const items = bodyItemsOf(entries, {
      ...IDLE,
      run_active: true,
      streaming_message: { role: "assistant", content: [{ type: "text", text: "Looking" }] },
    });

    expect(items.at(-1)).toMatchObject({ streaming: true, display_name: "RE", agent_name: "re@1" });
  });

  it("fails when an entry names a session that is no member", () => {
    const stranger = { ...message("e1", { role: "user", content: "Hi" }), session_id: "other" };

    expect(() => bodyItemsOf([stranger], IDLE)).toThrow("The conversation has no member other");
  });

  it("skips the entries that are no message and the thinking blocks", () => {
    const items = bodyItemsOf(
      [
        {
          session_id: HOST.session_id,
          agent_name: HOST.agent_name,
          type: "model_change",
          id: "e0",
          parentId: null,
          timestamp: "t",
        },
        message("e1", { role: "assistant", content: [{ type: "thinking", thinking: "hmm" }] }),
      ],
      IDLE,
    );

    expect(items).toEqual([]);
  });

  it("marks a pending tool call as running and the approval call as awaiting approval", () => {
    const entries = [
      message("e2", {
        role: "assistant",
        content: [CALL, { ...CALL, id: "call_2", name: "project.create" }],
      }),
    ];

    const items = bodyItemsOf(entries, {
      ...IDLE,
      run_active: true,
      pending_tool_calls: ["call_1"],
      pending_approval: {
        session_id: HOST.session_id,
        requested_by: { kind: "owner", name: "Kanthor Labs" },
        tool_call_id: "call_2",
        operation_id: "project.create",
        input: {},
        guard: null,
      },
    });

    expect(items.map((item) => item.kind === "tool-call" && item.state)).toEqual([
      "running",
      "awaiting-approval",
    ]);
  });

  it("marks a call with no result as no-result when no run is active", () => {
    const entries = [message("e2", { role: "assistant", content: [CALL] })];

    const items = bodyItemsOf(entries, IDLE);

    expect(items.map((item) => item.kind === "tool-call" && item.state)).toEqual(["no-result"]);
  });

  it("keeps no-result for the call that a user entry follows during a new active run", () => {
    const entries = [
      message("e2", { role: "assistant", content: [CALL] }),
      message("e3", { role: "user", content: "Again" }),
    ];

    const items = bodyItemsOf(entries, { ...IDLE, run_active: true });

    expect(items.map((item) => item.kind === "tool-call" && item.state)).toEqual([
      "no-result",
      false,
    ]);
  });

  it("keeps a pending call running while the run is active", () => {
    const entries = [message("e2", { role: "assistant", content: [CALL] })];

    const items = bodyItemsOf(entries, {
      ...IDLE,
      run_active: true,
      pending_tool_calls: ["call_1"],
    });

    expect(items.map((item) => item.kind === "tool-call" && item.state)).toEqual(["running"]);
  });

  it("renders an expired approval result as an error result", () => {
    const text =
      "The approval wait ended with no human decision. The call did not run. Do not call it again unless the human asks again.";
    const entries = [
      message("e2", { role: "assistant", content: [CALL] }),
      message("e3", {
        role: "toolResult",
        toolCallId: "call_1",
        toolName: "mission.node.list",
        isError: true,
        content: [{ type: "text", text }],
      }),
    ];

    const items = bodyItemsOf(entries, IDLE);

    expect(items.map((item) => item.kind === "tool-call" && item.state)).toEqual(["done", false]);
    expect(stripOrigin(items.at(-1)!)).toEqual({
      kind: "tool-result",
      id: "e3",
      name: "mission.node.list",
      text,
      isError: true,
    });
  });

  it("appends the streaming partial message after the entries", () => {
    const items = bodyItemsOf([message("e1", { role: "user", content: "Hi" })], {
      ...IDLE,
      run_active: true,
      streaming_message: { role: "assistant", content: [{ type: "text", text: "Hel" }] },
    });

    expect(stripOrigin(items.at(-1)!)).toEqual({
      kind: "assistant",
      id: "streaming",
      text: "Hel",
      streaming: true,
      timestamp: null,
    });
  });
});

describe("summaryOf", () => {
  it("collapses whitespace and cuts a long text", () => {
    expect(summaryOf("a\n  b")).toBe("a b");
    expect(summaryOf("x".repeat(100))).toBe(`${"x".repeat(80)}…`);
  });
});

describe("agentWorking", () => {
  const origin = {
    session_id: HOST.session_id,
    agent_name: HOST.agent_name,
    display_name: HOST.display_name,
  };
  const user = { ...origin, kind: "user", id: "e1", text: "Hi", timestamp: AT } as const;
  const streamed = {
    ...origin,
    kind: "assistant",
    id: "s",
    text: "Hel",
    streaming: true,
    timestamp: null,
  } as const;

  it("shows the agent at work while a run is active and no text streams", () => {
    expect(agentWorking([user], { ...IDLE, run_active: true })).toBe(true);
  });

  it("hides it while text streams, while an approval waits and when no run is active", () => {
    expect(agentWorking([user, streamed], { ...IDLE, run_active: true })).toBe(false);
    expect(
      agentWorking([user], {
        ...IDLE,
        run_active: true,
        pending_approval: {
          session_id: HOST.session_id,
          requested_by: { kind: "owner", name: "Kanthor Labs" },
          tool_call_id: "c1",
          operation_id: "o",
          input: {},
          guard: null,
        },
      }),
    ).toBe(false);
    expect(agentWorking([user], IDLE)).toBe(false);
  });
});

describe("workbenchPathsIn", () => {
  it("finds a path of two or more segments", () => {
    expect(workbenchPathsIn("/missions/checkout/nodes/node_42")).toEqual([
      { start: 0, end: 32, path: "/missions/checkout/nodes/node_42" },
    ]);
  });

  it("finds a path inside a sentence with its exact bounds", () => {
    const text = "Open /missions/checkout/nodes/node_42, then /projects/atlas. Done.";

    const found = workbenchPathsIn(text);

    expect(found.map((match) => text.slice(match.start, match.end))).toEqual([
      "/missions/checkout/nodes/node_42",
      "/projects/atlas",
    ]);
    expect(found[0]).toEqual({ start: 5, end: 37, path: "/missions/checkout/nodes/node_42" });
  });

  it("leaves a slash command as text", () => {
    expect(workbenchPathsIn("Try /brief, /health or /new now.")).toEqual([]);
  });

  it("leaves a trailing slash and a double slash as text", () => {
    expect(workbenchPathsIn("/health/ and //a/b")).toEqual([]);
  });

  it("leaves a path inside a URL as text", () => {
    expect(workbenchPathsIn("See https://example.com/missions/checkout.")).toEqual([]);
  });

  it("keeps a dot inside a segment and drops the dot of the sentence end", () => {
    const text = "Read /docs/plan.v2.md.";

    expect(workbenchPathsIn(text).map((match) => match.path)).toEqual(["/docs/plan.v2.md"]);
  });
});

describe("runErrorTargetId", () => {
  it("names the last user item", () => {
    const items = bodyItemsOf(
      [
        message("e1", { role: "user", content: "First" }),
        message("e2", { role: "assistant", content: [{ type: "text", text: "Hi" }] }),
        message("e3", { role: "user", content: "Second" }),
      ],
      IDLE,
    );

    expect(runErrorTargetId(items)).toBe("e3");
  });

  it("names nothing when no user item exists", () => {
    expect(runErrorTargetId([])).toBeNull();
  });
});

describe("runRequestOf", () => {
  const FIRST = message("e1", { role: "user", content: "First" });
  const CALLED = message("e2", { role: "assistant", content: [CALL] });
  const SECOND = message("e3", { role: "user", content: "Second" });

  it("names the latest user item", () => {
    const items = bodyItemsOf([FIRST, CALLED, SECOND], IDLE);

    expect(runRequestOf(items)).toMatchObject({ kind: "user", id: "e3", text: "Second" });
  });

  it("names no request before a user item exists", () => {
    expect(runRequestOf([])).toBeNull();
  });
});

function record(id: string, data: Record<string, unknown>, extra = {}): WorkbenchSessionEntry {
  return {
    session_id: HOST.session_id,
    agent_name: HOST.agent_name,
    type: "custom",
    id,
    parentId: null,
    timestamp: "2026-10-05T09:00:00.000Z",
    customType: "kanthord.workbench.record",
    data,
    ...extra,
  };
}

function offer(toolCallId: string, operationId = "mission.node.discard") {
  return {
    kind: "action_offer",
    tool_call_id: toolCallId,
    operation_id: operationId,
    target_id: "node_1",
    seen: { name: "Add retry to payment client", state: "Blocked", attempt: 2 },
  };
}

function actionResult(
  id: string,
  toolCallId: string,
  outcome: "done" | "failed",
  errorCode: string | null,
): WorkbenchSessionEntry {
  return {
    session_id: HOST.session_id,
    agent_name: HOST.agent_name,
    type: "custom_message",
    id,
    parentId: null,
    timestamp: "2026-10-05T09:00:00.000Z",
    customType: "kanthord.workbench.action_result",
    display: false,
    details: {
      tool_call_id: toolCallId,
      operation_id: "mission.node.discard",
      target_id: "node_1",
      outcome,
      error_code: errorCode,
    },
  };
}

const OFFER_CALL = { type: "toolCall", id: "call_a", name: "offer_action", arguments: {} };

function cardsOf(entries: readonly WorkbenchSessionEntry[], snapshot = IDLE) {
  return bodyItemsOf(entries, snapshot).filter((item) => item.kind === "action-card");
}

describe("chatItemsOf guard records", () => {
  const GUARD = {
    kind: "guard",
    tool_call_id: "call_1",
    operation_id: "mission.node.pause",
    reason: "reversible",
  };

  it("joins a guard record to the tool call with the same tool call id", () => {
    const items = bodyItemsOf(
      [
        message("e1", { role: "assistant", content: [CALL] }),
        record("e2", GUARD),
        message("e3", { role: "assistant", content: [{ ...CALL, id: "call_2" }] }),
      ],
      IDLE,
    );

    const calls = items.filter((item) => item.kind === "tool-call");
    expect(calls.map((item) => item.guard)).toEqual([GUARD, null]);
    expect(items).toHaveLength(2);
  });

  it("yields no item for an auto_mode record or a guard record", () => {
    const items = bodyItemsOf(
      [record("e1", { kind: "auto_mode", enabled: false }), record("e2", GUARD)],
      IDLE,
    );

    expect(items).toEqual([]);
  });

  it("ignores a guard record with a malformed field", () => {
    const items = bodyItemsOf(
      [
        message("e1", { role: "assistant", content: [CALL] }),
        record("e2", { ...GUARD, reason: 7 }),
      ],
      IDLE,
    );

    expect(items.map((item) => item.kind === "tool-call" && item.guard)).toEqual([null]);
  });
});

describe("ACTION_VERBS", () => {
  it("holds exactly the eleven card ids", () => {
    expect(ACTION_VERBS).toEqual({
      "mission.node.resume": "Resume",
      "mission.node.unblock": "Unblock",
      "mission.node.check": "Check",
      "mission.node.discard": "Discard",
      "mission.node.override": "Override",
      "mission.node.pause": "Pause",
      "project.pause": "Pause",
      "project.resume": "Resume",
      "llm.credential.rotate": "Rotate",
      "project.bindingSet.write": "Edit bindings of",
      "agent.enablement.put": "Edit default of",
    });
  });
});

describe("chatItemsOf action card", () => {
  it("maps the record to one card and hides the offer_action call and its result", () => {
    const items = bodyItemsOf(
      [
        message("e1", { role: "assistant", content: [OFFER_CALL] }),
        record("e2", offer("call_a")),
        message("e3", {
          role: "toolResult",
          toolCallId: "call_a",
          toolName: "offer_action",
          isError: false,
          content: [{ type: "text", text: "offered" }],
        }),
      ],
      IDLE,
    );

    expect(items.map(stripOrigin)).toEqual([
      {
        kind: "action-card",
        id: "e2",
        offer: offer("call_a"),
        results: [],
        state: "live",
      },
    ]);
  });

  it("merges the results of one tool call id into the card in entry order", () => {
    const cards = cardsOf([
      record("e1", offer("call_a")),
      actionResult("e2", "call_a", "failed", "mission.node.state_conflict"),
      actionResult("e3", "call_b", "done", null),
      actionResult("e4", "call_a", "failed", "mission.node.not_found"),
    ]);

    expect(cards.map((card) => card.results.map((result) => result.error_code))).toEqual([
      ["mission.node.state_conflict", "mission.node.not_found"],
    ]);
  });

  it("gives done for a done result", () => {
    const cards = cardsOf([
      record("e1", offer("call_a")),
      actionResult("e2", "call_a", "done", null),
    ]);

    expect(cards.map((card) => card.state)).toEqual(["done"]);
  });

  it("gives superseded for a later user message", () => {
    const cards = cardsOf([
      record("e1", offer("call_a")),
      message("e2", { role: "user", content: "Next" }),
    ]);

    expect(cards.map((card) => card.state)).toEqual(["superseded"]);
  });

  it("gives superseded to the first card when a later offer exists", () => {
    const cards = cardsOf([record("e1", offer("call_a")), record("e2", offer("call_b"))]);

    expect(cards.map((card) => card.state)).toEqual(["superseded", "live"]);
  });

  it("keeps the card live after an assistant text", () => {
    const cards = cardsOf([
      record("e1", offer("call_a")),
      message("e2", { role: "assistant", content: [{ type: "text", text: "Done." }] }),
    ]);

    expect(cards.map((card) => card.state)).toEqual(["live"]);
  });

  it("gives waiting while the run is active", () => {
    const cards = cardsOf([record("e1", offer("call_a"))], { ...IDLE, run_active: true });

    expect(cards.map((card) => card.state)).toEqual(["waiting"]);
  });

  it("gives unknown for an operation id with no verb", () => {
    const cards = cardsOf([record("e1", offer("call_a", "mission.node.explode"))]);

    expect(cards.map((card) => card.state)).toEqual(["unknown"]);
  });

  it("keeps the card live and the result after a failed result", () => {
    const cards = cardsOf([
      record("e1", offer("call_a")),
      actionResult("e2", "call_a", "failed", "mission.node.state_conflict"),
    ]);

    expect(cards.map((card) => [card.state, card.results.at(-1)?.error_code])).toEqual([
      ["live", "mission.node.state_conflict"],
    ]);
  });

  it("accepts the project seen shape", () => {
    const cards = cardsOf([
      record("e1", {
        ...offer("call_a", "project.pause"),
        seen: { name: "Billing", paused: false },
      }),
    ]);

    expect(cards.map((card) => card.offer.seen)).toEqual([{ name: "Billing", paused: false }]);
  });

  it.each([
    ["llm.credential.rotate", "anthropic-main", { revision: 3 }],
    ["project.bindingSet.write", "project_01", { version: 7 }],
    ["agent.enablement.put", "ops@1", { revision: 5 }],
  ])("maps the %s record to one card with its seen value", (operationId, targetId, seen) => {
    const cards = cardsOf([
      record("e1", { ...offer("call_a", operationId), target_id: targetId, seen }),
    ]);

    expect(
      cards.map((card) => [card.offer.operation_id, card.offer.target_id, card.offer.seen]),
    ).toEqual([[operationId, targetId, seen]]);
    expect(cards.map((card) => card.state)).toEqual(["live"]);
    expect(Object.keys(cards[0] ?? {}).sort()).toEqual([
      "agent_name",
      "display_name",
      "id",
      "kind",
      "offer",
      "results",
      "session_id",
      "state",
    ]);
  });

  it("renders nothing for a revision or version seen with a wrong shape", () => {
    const items = bodyItemsOf(
      [
        record("e1", { ...offer("call_a", "llm.credential.rotate"), seen: { revision: "3" } }),
        record("e2", { ...offer("call_b", "llm.credential.rotate"), seen: { revision: 3, x: 1 } }),
        record("e3", { ...offer("call_c", "project.bindingSet.write"), seen: { version: null } }),
      ],
      IDLE,
    );

    expect(items).toEqual([]);
  });

  it("renders nothing for a record with an extra key or an unknown kind", () => {
    const items = bodyItemsOf(
      [
        record("e1", { ...offer("call_a"), text: "Click me" }),
        record("e2", { ...offer("call_b"), kind: "other" }),
        record("e3", {
          ...offer("call_c"),
          seen: { name: "n", state: "Blocked", attempt: 1, extra: 1 },
        }),
        record("e4", { ...offer("call_d"), seen: { name: "n", state: "Nowhere", attempt: 1 } }),
        record("e5", offer("call_e"), { customType: "other.record" }),
      ],
      IDLE,
    );

    expect(items).toEqual([]);
  });

  it("renders nothing for a seen without a string name", () => {
    const items = bodyItemsOf(
      [
        record("e1", { ...offer("call_a"), seen: { state: "Blocked", attempt: 1 } }),
        record("e2", { ...offer("call_b", "project.pause"), seen: { paused: true } }),
        record("e3", { ...offer("call_c", "project.pause"), seen: { name: 7, paused: true } }),
      ],
      IDLE,
    );

    expect(items).toEqual([]);
  });
});

describe("chatItemsOf evidence_read", () => {
  const FACTS = {
    asset_id: "evidence_asset_1",
    node_id: "node_1",
    attempt: 2,
    media_type: "text/plain",
    size: 120,
    offset: 0,
    length: 100,
    truncated: true,
  };
  const CONTENT = "SECRET-CONTENT-LINE";

  function result(extra: Record<string, unknown>, isError = false) {
    return message("e1", {
      role: "toolResult",
      toolCallId: "call_1",
      toolName: "evidence_read",
      isError,
      content: [
        { type: "text", text: JSON.stringify(FACTS) },
        { type: "text", text: CONTENT },
      ],
      ...extra,
    });
  }

  it("maps a result to one evidence row with the facts of details and no content text", () => {
    const items = bodyItemsOf([result({ details: FACTS })], IDLE);

    expect(items.map(stripOrigin)).toEqual([{ kind: "evidence-row", id: "e1", facts: FACTS }]);
    expect(JSON.stringify(items)).not.toContain(CONTENT);
  });

  it("reads the facts from the first text block when details is absent", () => {
    const items = bodyItemsOf([result({})], IDLE);

    expect(items.map(stripOrigin)).toEqual([{ kind: "evidence-row", id: "e1", facts: FACTS }]);
    expect(JSON.stringify(items)).not.toContain(CONTENT);
  });

  it("reads the facts from the first text block when details is invalid", () => {
    const items = bodyItemsOf([result({ details: { asset_id: 7 } })], IDLE);

    expect(items.map(stripOrigin)).toEqual([{ kind: "evidence-row", id: "e1", facts: FACTS }]);
  });

  it("keeps a failed result as a tool result with its error text", () => {
    const text = "workbench.evidence.media_refused: The asset is not text.";
    const items = bodyItemsOf(
      [
        message("e1", {
          role: "toolResult",
          toolCallId: "call_1",
          toolName: "evidence_read",
          isError: true,
          content: [{ type: "text", text }],
        }),
      ],
      IDLE,
    );

    expect(items.map(stripOrigin)).toEqual([
      { kind: "tool-result", id: "e1", name: "evidence_read", text, isError: true },
    ]);
  });

  it("keeps the content text out of a result whose facts are unreadable", () => {
    const items = bodyItemsOf(
      [
        message("e1", {
          role: "toolResult",
          toolCallId: "call_1",
          toolName: "evidence_read",
          isError: false,
          content: [
            { type: "text", text: "not json" },
            { type: "text", text: CONTENT },
          ],
        }),
      ],
      IDLE,
    );

    expect(items.map(stripOrigin)).toEqual([
      { kind: "tool-result", id: "e1", name: "evidence_read", text: "not json", isError: false },
    ]);
  });

  it("maps an evidence_read call to no tool call while it waits and after its result", () => {
    const evidenceCall = {
      type: "toolCall",
      id: "call_1",
      name: "evidence_read",
      arguments: { asset_id: "evidence_asset_1" },
    };
    const nodeCall = { type: "toolCall", id: "call_2", name: "mission--node--get", arguments: {} };
    const assistant = message("e0", { role: "assistant", content: [evidenceCall, nodeCall] });
    const waiting = bodyItemsOf([assistant], {
      ...IDLE,
      run_active: true,
      pending_approval: { tool_call_id: "call_1" } as WorkbenchRunSnapshot["pending_approval"],
    });
    const settled = bodyItemsOf([assistant, result({ details: FACTS })], IDLE);

    expect(waiting.map((item) => item.kind)).toEqual(["tool-call"]);
    expect(settled.map((item) => item.kind)).toEqual(["tool-call", "evidence-row"]);
    expect(settled[0]).toMatchObject({ name: "mission--node--get" });
  });
});

describe("chatItemsOf fork", () => {
  const SOURCE_ID = "workbench_session_SOURCE";
  const SUMMARY = "The user asked for the node list.";

  function forkRecord(): WorkbenchSessionEntry {
    return {
      session_id: HOST.session_id,
      agent_name: HOST.agent_name,
      type: "custom",
      id: "e3",
      parentId: null,
      timestamp: "2026-10-05T09:00:00.000Z",
      customType: "kanthord.workbench.record",
      data: { kind: "fork", source_title: "List the nodes" },
    };
  }

  const forkEntries = [
    forkRecord(),
    message("e4", {
      role: "user",
      content: `${WORKBENCH_FORK_PREFIX}${SOURCE_ID}.${WORKBENCH_FORK_FRAME}\n\n${SUMMARY}`,
    }),
    message("e5", {
      role: "assistant",
      content: [{ type: "text", text: "I read the summary of the earlier conversation." }],
    }),
    message("e7", { role: "user", content: "Go on" }),
  ];

  it("maps the fork record and the fork user message to one fork item", () => {
    const items = chatItemsOf(forkEntries, IDLE, MEMBERS, SOURCE_ID);

    expect(items.map(stripOrigin)).toEqual([
      {
        kind: "fork",
        id: "e3",
        source_title: "List the nodes",
        source_id: SOURCE_ID,
        summary: SUMMARY,
      },
      { kind: "user", id: "e7", text: "Go on", timestamp: AT },
    ]);
  });

  it("keeps the prefix, the source id and the frame out of the summary", () => {
    const [fork] = chatItemsOf(forkEntries, IDLE, MEMBERS, SOURCE_ID);

    const summary = fork?.kind === "fork" ? fork.summary : "";
    expect(summary).toBe(SUMMARY);
    expect(summary).not.toContain(WORKBENCH_FORK_PREFIX);
    expect(summary).not.toContain(SOURCE_ID);
    expect(summary).not.toContain(WORKBENCH_FORK_FRAME);
  });

  it("gives no bubble for the fork user message and none for the ack", () => {
    const items = chatItemsOf(forkEntries, IDLE, MEMBERS, SOURCE_ID);

    expect(items.map((item) => item.kind)).toEqual(["fork", "user"]);
  });
});

describe("memberOf", () => {
  it("reads the member by its session id", () => {
    expect(memberOf(MEMBERS, "guest-1")).toBe(GUEST);
  });

  it("fails for an unknown session id", () => {
    expect(() => memberOf(MEMBERS, "none")).toThrow("The conversation has no member none");
  });
});

describe("chatItemsOf plan and phases", () => {
  const JEREMY: WorkbenchMember = {
    session_id: "plan-host",
    agent_name: "plan@1",
    display_name: "Jeremy",
  };
  const PLAN_MEMBERS = [JEREMY];

  function phaseEntry(
    id: string,
    sessionId: string,
    phase: "planner" | "reviewer",
    text: string,
  ): WorkbenchSessionEntry {
    return {
      session_id: sessionId,
      agent_name: JEREMY.agent_name,
      type: "message",
      id,
      parentId: null,
      timestamp: "2026-10-05T09:00:00.000Z",
      phase,
      message: { role: "assistant", content: [{ type: "text", text }] },
    };
  }

  function planEntry(id: string, details: unknown): WorkbenchSessionEntry {
    return {
      session_id: JEREMY.session_id,
      agent_name: JEREMY.agent_name,
      type: "custom_message",
      id,
      parentId: null,
      timestamp: "2026-10-05T09:00:00.000Z",
      customType: "kanthord.workbench.plan",
      content: "## Plan\n\n1. Step",
      display: true,
      details,
    };
  }

  it("maps a plan entry to one plan item with the Jeremy display name", () => {
    const items = chatItemsOf([planEntry("p1", { phases: [], unresolved: 2 })], IDLE, PLAN_MEMBERS);

    expect(items.map(stripOrigin)).toEqual([
      {
        kind: "plan",
        id: "p1",
        text: "## Plan\n\n1. Step",
        unresolved: 2,
        author: "Jeremy",
        timestamp: AT,
      },
    ]);
  });

  it.each([
    ["no details", undefined],
    ["details that are no record", "text"],
    ["an unknown unresolved value", { phases: [], unresolved: "many" }],
  ])("maps %s to a plan item with unresolved null", (_name, details) => {
    const [item] = chatItemsOf([planEntry("p1", details)], IDLE, PLAN_MEMBERS);

    expect(item?.kind === "plan" ? item.unresolved : "no plan item").toBeNull();
  });

  it("keeps the missing mark of unresolved", () => {
    const [item] = chatItemsOf(
      [planEntry("p1", { phases: [], unresolved: "missing" })],
      IDLE,
      PLAN_MEMBERS,
    );

    expect(item?.kind === "plan" ? item.unresolved : null).toBe("missing");
  });

  it("collects phase entries into one group per phase session before the plan item", () => {
    const items = chatItemsOf(
      [
        phaseEntry("a1", "phase-planner", "planner", "Draft one"),
        phaseEntry("a2", "phase-planner", "planner", "Draft two"),
        phaseEntry("b1", "phase-reviewer", "reviewer", "Review one"),
        planEntry("p1", { phases: [], unresolved: null }),
      ],
      IDLE,
      PLAN_MEMBERS,
    );

    expect(items.map((item) => item.kind)).toEqual(["phase-group", "phase-group", "plan"]);
    const groups = items.flatMap((item) => (item.kind === "phase-group" ? [item] : []));
    expect(groups.map((group) => group.phase)).toEqual(["planner", "reviewer"]);
    expect(groups.map((group) => group.items.map((held) => held.id))).toEqual([
      ["a1", "a2"],
      ["b1"],
    ]);
    expect(groups[0]?.items.map((held) => held.display_name)).toEqual(["Jeremy", "Jeremy"]);
  });

  it("gives a new group to a second run with new phase sessions", () => {
    const items = chatItemsOf(
      [
        phaseEntry("a1", "phase-planner-1", "planner", "Draft"),
        planEntry("p1", { phases: [], unresolved: null }),
        phaseEntry("a2", "phase-planner-2", "planner", "Draft"),
        planEntry("p2", { phases: [], unresolved: null }),
      ],
      IDLE,
      PLAN_MEMBERS,
    );

    expect(items.map((item) => item.kind)).toEqual(["phase-group", "plan", "phase-group", "plan"]);
  });

  it("shows the plan item and no phase group for entries with no phase", () => {
    const items = chatItemsOf(
      [
        { ...message("e1", { role: "user", content: "Plan it" }), session_id: JEREMY.session_id },
        planEntry("p1", { phases: [], unresolved: 1 }),
      ],
      IDLE,
      PLAN_MEMBERS,
    );

    expect(items.map((item) => item.kind)).toEqual(["user", "plan"]);
  });

  it("streams the host text while the last entry is a phase entry", () => {
    const items = chatItemsOf(
      [phaseEntry("a1", "phase-planner", "planner", "Draft")],
      {
        ...IDLE,
        run_active: true,
        streaming_message: { role: "assistant", content: [{ type: "text", text: "Hel" }] },
      },
      PLAN_MEMBERS,
    );

    expect(items.map((item) => item.kind)).toEqual(["phase-group", "assistant"]);
  });

  it("fails for a phase entry when no member is plan@1", () => {
    expect(() =>
      chatItemsOf([phaseEntry("a1", "phase-planner", "planner", "Draft")], IDLE, MEMBERS),
    ).toThrow("The conversation has no member plan@1");
  });
});

describe("unresolvedLine", () => {
  it("answers the line of a count", () => {
    expect(unresolvedLine(2)).toBe("Review unresolved: 2 open action:YES findings");
  });

  it("answers the line of a missing Review section", () => {
    expect(unresolvedLine("missing")).toBe("Review unresolved: no Review section");
  });

  it("answers null for null", () => {
    expect(unresolvedLine(null)).toBeNull();
  });
});

function userAt(id: string, text: string, sessionId = HOST.session_id): WorkbenchSessionEntry {
  return { ...message(id, { role: "user", content: text }), session_id: sessionId };
}

function authorRecord(id: string, name: string, sessionId = HOST.session_id) {
  return {
    ...record(id, { kind: "author", author: { kind: "guest", name } }),
    session_id: sessionId,
  };
}

describe("chatItemsOf guest-started runs", () => {
  it("labels only the user message that follows an author record", () => {
    const items = bodyItemsOf(
      [authorRecord("e1", "Anna"), userAt("e2", "from the guest"), userAt("e3", "from the owner")],
      IDLE,
    ).filter((item) => item.kind === "user");

    expect(items.map((item) => item.guest)).toEqual(["Anna", undefined]);
  });

  it("renders no item for an author record or a queue_clear record", () => {
    const items = bodyItemsOf(
      [authorRecord("e1", "Anna"), record("e2", { kind: "queue_clear", count: 2, cause: "stop" })],
      IDLE,
    );

    expect(items).toEqual([]);
  });

  it("labels an action offer after a guest-labelled user message", () => {
    const entries = [
      authorRecord("e1", "Anna"),
      userAt("e2", "discard the node"),
      actionResult("e3", "call_x", "done", null),
      record("e4", offer("call_a")),
    ];

    expect(cardsOf(entries).map((item) => item.guest)).toEqual(["Anna"]);
  });

  it("carries no guest line for an action offer after a later owner user message", () => {
    const entries = [
      authorRecord("e1", "Anna"),
      userAt("e2", "discard the node"),
      userAt("e3", "now my own request"),
      record("e4", offer("call_a")),
    ];

    expect(cardsOf(entries).map((item) => item.guest)).toEqual([undefined]);
  });

  it("reads the author record of the session of the user message only", () => {
    const entries = [
      authorRecord("e1", "Anna", GUEST.session_id),
      userAt("e2", "owner text in the host session"),
    ];

    const users = bodyItemsOf(entries, IDLE).filter((item) => item.kind === "user");
    expect(users.map((item) => item.guest)).toEqual([undefined]);
  });
});
