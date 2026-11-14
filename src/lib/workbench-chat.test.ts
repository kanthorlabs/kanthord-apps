import { describe, expect, it } from "vitest";

import type { WorkbenchRunSnapshot, WorkbenchSessionEntry } from "@/api/types";
import {
  ACTION_VERBS,
  agentWorking,
  chatItemsOf,
  runErrorTargetId,
  runRequestOf,
  summaryOf,
  workbenchPathsIn,
} from "./workbench-chat";

const IDLE: WorkbenchRunSnapshot = {
  streaming_message: null,
  pending_tool_calls: [],
  pending_approval: null,
  queue: [],
  run_active: false,
  error_message: null,
};

function message(id: string, body: Record<string, unknown>): WorkbenchSessionEntry {
  return {
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
    const items = chatItemsOf(
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

    expect(items).toEqual([
      { kind: "user", id: "e1", text: "List the nodes", timestamp: AT },
      { kind: "assistant", id: "e2", text: "Reading.", streaming: false, timestamp: AT },
      {
        kind: "tool-call",
        id: "e2:call_1",
        name: "mission.node.list",
        input: JSON.stringify({ a: 1 }, null, 2),
        state: "done",
      },
      { kind: "tool-result", id: "e3", name: "mission.node.list", text: "refused", isError: true },
    ]);
  });

  it("skips the entries that are no message and the thinking blocks", () => {
    const items = chatItemsOf(
      [
        { type: "model_change", id: "e0", parentId: null, timestamp: "t" },
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

    const items = chatItemsOf(entries, {
      ...IDLE,
      run_active: true,
      pending_tool_calls: ["call_1"],
      pending_approval: { tool_call_id: "call_2", operation_id: "project.create", input: {} },
    });

    expect(items.map((item) => item.kind === "tool-call" && item.state)).toEqual([
      "running",
      "awaiting-approval",
    ]);
  });

  it("marks a call with no result as no-result when no run is active", () => {
    const entries = [message("e2", { role: "assistant", content: [CALL] })];

    const items = chatItemsOf(entries, IDLE);

    expect(items.map((item) => item.kind === "tool-call" && item.state)).toEqual(["no-result"]);
  });

  it("keeps no-result for the call that a user entry follows during a new active run", () => {
    const entries = [
      message("e2", { role: "assistant", content: [CALL] }),
      message("e3", { role: "user", content: "Again" }),
    ];

    const items = chatItemsOf(entries, { ...IDLE, run_active: true });

    expect(items.map((item) => item.kind === "tool-call" && item.state)).toEqual([
      "no-result",
      false,
    ]);
  });

  it("keeps a pending call running while the run is active", () => {
    const entries = [message("e2", { role: "assistant", content: [CALL] })];

    const items = chatItemsOf(entries, {
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

    const items = chatItemsOf(entries, IDLE);

    expect(items.map((item) => item.kind === "tool-call" && item.state)).toEqual(["done", false]);
    expect(items.at(-1)).toEqual({
      kind: "tool-result",
      id: "e3",
      name: "mission.node.list",
      text,
      isError: true,
    });
  });

  it("appends the streaming partial message after the entries", () => {
    const items = chatItemsOf([message("e1", { role: "user", content: "Hi" })], {
      ...IDLE,
      run_active: true,
      streaming_message: { role: "assistant", content: [{ type: "text", text: "Hel" }] },
    });

    expect(items.at(-1)).toEqual({
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
  const user = { kind: "user", id: "e1", text: "Hi", timestamp: AT } as const;
  const streamed = {
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
        pending_approval: { tool_call_id: "c1", operation_id: "o", input: {} },
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
    const items = chatItemsOf(
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
    const items = chatItemsOf([FIRST, CALLED, SECOND], IDLE);

    expect(runRequestOf(items)).toMatchObject({ kind: "user", id: "e3", text: "Second" });
  });

  it("names no request before a user item exists", () => {
    expect(runRequestOf([])).toBeNull();
  });
});

function record(id: string, data: Record<string, unknown>, extra = {}): WorkbenchSessionEntry {
  return {
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
  return chatItemsOf(entries, snapshot).filter((item) => item.kind === "action-card");
}

describe("ACTION_VERBS", () => {
  it("holds exactly the eight card ids", () => {
    expect(ACTION_VERBS).toEqual({
      "mission.node.resume": "Resume",
      "mission.node.unblock": "Unblock",
      "mission.node.check": "Check",
      "mission.node.discard": "Discard",
      "mission.node.override": "Override",
      "mission.node.pause": "Pause",
      "project.pause": "Pause",
      "project.resume": "Resume",
    });
  });
});

describe("chatItemsOf action card", () => {
  it("maps the record to one card and hides the offer_action call and its result", () => {
    const items = chatItemsOf(
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

    expect(items).toEqual([
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

  it("renders nothing for a record with an extra key or an unknown kind", () => {
    const items = chatItemsOf(
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
    const items = chatItemsOf(
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
    const items = chatItemsOf([result({ details: FACTS })], IDLE);

    expect(items).toEqual([{ kind: "evidence-row", id: "e1", facts: FACTS }]);
    expect(JSON.stringify(items)).not.toContain(CONTENT);
  });

  it("reads the facts from the first text block when details is absent", () => {
    const items = chatItemsOf([result({})], IDLE);

    expect(items).toEqual([{ kind: "evidence-row", id: "e1", facts: FACTS }]);
    expect(JSON.stringify(items)).not.toContain(CONTENT);
  });

  it("reads the facts from the first text block when details is invalid", () => {
    const items = chatItemsOf([result({ details: { asset_id: 7 } })], IDLE);

    expect(items).toEqual([{ kind: "evidence-row", id: "e1", facts: FACTS }]);
  });

  it("keeps a failed result as a tool result with its error text", () => {
    const text = "workbench.evidence.media_refused: The asset is not text.";
    const items = chatItemsOf(
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

    expect(items).toEqual([
      { kind: "tool-result", id: "e1", name: "evidence_read", text, isError: true },
    ]);
  });

  it("keeps the content text out of a result whose facts are unreadable", () => {
    const items = chatItemsOf(
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

    expect(items).toEqual([
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
    const waiting = chatItemsOf([assistant], {
      ...IDLE,
      run_active: true,
      pending_approval: { tool_call_id: "call_1" } as WorkbenchRunSnapshot["pending_approval"],
    });
    const settled = chatItemsOf([assistant, result({ details: FACTS })], IDLE);

    expect(waiting.map((item) => item.kind)).toEqual(["tool-call"]);
    expect(settled.map((item) => item.kind)).toEqual(["tool-call", "evidence-row"]);
    expect(settled[0]).toMatchObject({ name: "mission--node--get" });
  });
});
