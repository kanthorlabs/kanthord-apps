import { describe, expect, it } from "vitest";

import type { TraceSpan } from "@/api/types";

import { sessionLabel, sessionSpansOf, turnsByEntry } from "./conversation-spans";
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
