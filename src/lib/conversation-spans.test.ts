import { describe, expect, it } from "vitest";

import type { TraceSessionEntry, TraceSpan } from "@/api/types";

import {
  causalEntryIdOf,
  promptLabelsOf,
  sessionLabel,
  sessionSpansOf,
  turnsByEntry,
} from "./conversation-spans";
import { utcDateTime } from "./format";

const START = Date.UTC(2026, 4, 2, 10, 30);

function span(
  id: string,
  operation: string,
  attributes: TraceSpan["attributes"] = {},
  overrides: Partial<TraceSpan> = {},
): TraceSpan {
  return {
    trace_id: "trace-1",
    span_id: id,
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation,
    start_time: START,
    end_time: START + 1000,
    status: "Ok",
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: START,
    ...overrides,
  };
}

describe("sessionSpansOf", () => {
  it("keeps the session spans in start order and puts an unstarted one last", () => {
    const late = span("late", "agent.session", {}, { start_time: START + 5 });
    const unstarted = span("unstarted", "agent.session", {}, { start_time: null });
    const early = span("early", "agent.session", {}, { start_time: START });

    const sessions = sessionSpansOf([unstarted, late, span("turn", "agent.turn"), early]);

    expect(sessions.map((session) => session.span_id)).toEqual(["early", "late", "unstarted"]);
  });
});

describe("sessionLabel", () => {
  it("joins the agent name and the start time", () => {
    const session = span("s", "agent.session", { "kanthord.agent.name": "coder" });

    expect(sessionLabel(session)).toBe(`coder · ${utcDateTime(START)}`);
  });

  it("falls back when the name or the start is absent", () => {
    expect(sessionLabel(span("s", "agent.session", {}, { start_time: null }))).toBe("Agent");
  });
});

describe("turnsByEntry", () => {
  it("maps the reply entry of each turn of the session", () => {
    const own = span("own", "agent.turn", {
      "gen_ai.conversation.id": "s1",
      "kanthord.session.entry_id": "e1",
    });
    const other = span("other", "agent.turn", {
      "gen_ai.conversation.id": "s2",
      "kanthord.session.entry_id": "e2",
    });
    const bare = span("bare", "agent.turn", { "gen_ai.conversation.id": "s1" });

    const turns = turnsByEntry([own, other, bare], "s1");

    expect([...turns.keys()]).toEqual(["e1"]);
    expect(turns.get("e1")).toBe(own);
  });
});

function entry(
  id: string,
  sequence: number,
  raw: Record<string, unknown>,
  toolCallId: string | null = null,
): TraceSessionEntry {
  return {
    trace_id: "trace-1",
    session_id: "session-1",
    entry_id: id,
    parent_entry_id: null,
    sequence,
    entry_type: String(raw.type),
    entry_time: START,
    tool_call_id: toolCallId,
    truncated: false,
    entry: raw,
    created_at: START,
  };
}

const TASK = span("task-1", "worker.task");
const TURN = span(
  "turn-1",
  "agent.turn",
  { "gen_ai.conversation.id": "session-1", "kanthord.session.entry_id": "reply" },
  { parent_span_id: "task-1" },
);
const ENTRIES = [
  entry("pin", 1, { type: "custom", customType: "kanthord.pinned_context", data: {} }),
  entry("ask", 2, { type: "message", message: { role: "user", content: "Go." } }),
  entry("reply", 3, { type: "message", message: { role: "assistant", content: "Done." } }),
  entry("result", 4, { type: "message", message: { role: "toolResult", content: "ok" } }, "call-1"),
];

describe("promptLabelsOf", () => {
  it("labels the pinned entry and the work prompt of each task", () => {
    expect(promptLabelsOf([TASK, TURN], ENTRIES)).toEqual(
      new Map([
        ["pin", "System prompt"],
        ["ask", "Work prompt task-1"],
      ]),
    );
  });
});

describe("causalEntryIdOf", () => {
  it("returns the reply entry of a causal turn", () => {
    const failed = { ...TURN, status: "Error" } satisfies TraceSpan;

    expect(causalEntryIdOf([TASK, failed], "session-1", ENTRIES)).toBe("reply");
  });

  it("returns the result entry of a causal tool", () => {
    const tool = span(
      "tool-1",
      "agent.tool",
      { "gen_ai.tool.call.id": "call-1" },
      { parent_span_id: "task-1", status: "Error" },
    );

    expect(causalEntryIdOf([TASK, tool], "session-1", ENTRIES)).toBe("result");
  });

  it("returns null when the causal span has no entry", () => {
    const tool = span(
      "tool-1",
      "agent.tool",
      { "gen_ai.tool.call.id": "call-9" },
      { parent_span_id: "task-1", status: "Error" },
    );

    expect(causalEntryIdOf([TASK, tool], "session-1", ENTRIES)).toBeNull();
    expect(causalEntryIdOf([TASK, TURN], "session-1", ENTRIES)).toBeNull();
    expect(causalEntryIdOf([], "session-1", ENTRIES)).toBeNull();
  });
});
