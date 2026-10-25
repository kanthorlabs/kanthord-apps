import { describe, expect, it } from "vitest";

import type { TraceSpan } from "@/api/types";

import { turnTokenRows } from "./turn-token-rows";

function span(id: string, operation: string, attributes: TraceSpan["attributes"]): TraceSpan {
  return {
    trace_id: "trace_1",
    span_id: id,
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation,
    start_time: 1,
    end_time: 2,
    status: "Ok",
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: 1,
  };
}

const turn = (id: string, index: number, tokens: number, session = "session") =>
  span(id, "agent.turn", {
    "kanthord.turn.index": index,
    "gen_ai.conversation.id": session,
    "gen_ai.usage.input_tokens": tokens,
  });

const session = span("session", "agent.session", {});
const spans = [session, turn("t3", 3, 3000), turn("t1", 1, 1000), turn("other", 1, 9, "elsewhere")];

describe("turnTokenRows", () => {
  it("lists the turns of the session of a turn in index order and marks the selected one", () => {
    const rows = turnTokenRows(turn("t3", 3, 3000), spans);

    expect(rows).toEqual([
      {
        spanId: "t1",
        index: 1,
        tokens: "1.0k",
        percent: expect.closeTo(33.33, 1),
        selected: false,
      },
      { spanId: "t3", index: 3, tokens: "3.0k", percent: 100, selected: true },
    ]);
  });

  it("marks no turn for a session span", () => {
    const rows = turnTokenRows(session, spans);

    expect(rows.map((row) => row.spanId)).toEqual(["t1", "t3"]);
    expect(rows.some((row) => row.selected)).toBe(false);
  });

  it("answers no row for another operation and a zero bar for zero tokens", () => {
    expect(turnTokenRows(span("git", "worker.git", {}), spans)).toEqual([]);
    expect(turnTokenRows(turn("z", 1, 0), [turn("z", 1, 0)])[0]?.percent).toBe(0);
  });
});
