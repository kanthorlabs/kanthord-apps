import { describe, expect, it } from "vitest";

import type { TraceSpan } from "@/api/types";

import {
  attributeText,
  attributesOf,
  conversationIdOf,
  eventsOf,
  replyEntryIdOf,
  spanFacts,
  toolCallIdOf,
  turnFacts,
} from "./span-detail";
import { utcDateTime } from "./format";

const START = Date.UTC(2026, 4, 2, 10, 30);

function span(overrides: Partial<TraceSpan> = {}): TraceSpan {
  return {
    trace_id: "trace-1",
    span_id: "span-1",
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation: "agent.turn",
    start_time: START + 60_000,
    end_time: START + 180_000,
    status: "Ok",
    attributes: {},
    events: [],
    links: [],
    text_ids: [],
    created_at: START,
    ...overrides,
  };
}

describe("spanFacts", () => {
  it("gives the start, the end, the duration and the offset from the axis", () => {
    expect(spanFacts(span(), { start: START, end: START + 180_000 })).toEqual([
      { name: "Start", value: utcDateTime(START + 60_000) },
      { name: "End", value: utcDateTime(START + 180_000) },
      { name: "Duration", value: "2 m" },
      { name: "Offset", value: "1 m" },
    ]);
  });

  it("omits what the span or the axis does not hold", () => {
    expect(spanFacts(span({ end_time: null }), null)).toEqual([
      { name: "Start", value: utcDateTime(START + 60_000) },
    ]);
    expect(spanFacts(span({ start_time: null, end_time: null }), null)).toEqual([]);
  });
});

describe("turnFacts", () => {
  it("prefers the response model and shows the cache read, the cache write and the hit", () => {
    const turn = span({
      attributes: {
        "gen_ai.request.model": "a",
        "gen_ai.response.model": "b",
        "gen_ai.usage.input_tokens": 1000,
        "gen_ai.usage.cache_read.input_tokens": 300,
        "gen_ai.usage.cache_creation.input_tokens": 200,
        "gen_ai.response.finish_reasons": ["stop", "length"],
        "kanthord.usage.cost_usd": 0,
      },
    });

    expect(turnFacts(turn)).toEqual([
      { name: "Model", value: "b" },
      { name: "Input tokens", value: "1.0k" },
      { name: "Cache read", value: "300" },
      { name: "Cache write", value: "200" },
      { name: "Cache hit", value: "30%" },
      { name: "API price", value: "$0" },
      { name: "Finish reason", value: "stop, length" },
    ]);
  });

  it("keeps the hit at read over input when the cache write is large", () => {
    const turn = span({
      attributes: {
        "gen_ai.usage.input_tokens": 1000,
        "gen_ai.usage.cache_read.input_tokens": 100,
        "gen_ai.usage.cache_creation.input_tokens": 800,
      },
    });

    expect(turnFacts(turn)).toContainEqual({ name: "Cache hit", value: "10%" });
  });

  it("shows one cache attribute alone and omits all absent facts", () => {
    expect(
      turnFacts(span({ attributes: { "gen_ai.usage.cache_creation.input_tokens": 7 } })),
    ).toEqual([{ name: "Cache write", value: "7" }]);
    expect(turnFacts(span())).toEqual([]);
  });
});

describe("attributes and events", () => {
  it("joins an array value and prints a scalar", () => {
    expect(attributeText(["a", "b"])).toBe("a, b");
    expect(attributeText([1, 2])).toBe("1, 2");
    expect(attributeText(true)).toBe("true");
    expect(attributesOf({ a: "x", n: 3 })).toEqual([
      { name: "a", value: "x" },
      { name: "n", value: "3" },
    ]);
  });

  it("lists each event with its time and its attributes", () => {
    const events = [
      { name: "retry", time: START, attributes: { reason: "slow" } },
      { name: "done", time: START },
    ];

    expect(eventsOf(span({ events }))).toEqual([
      { name: "retry", time: utcDateTime(START), attributes: [{ name: "reason", value: "slow" }] },
      { name: "done", time: utcDateTime(START), attributes: [] },
    ]);
  });
});

describe("identities", () => {
  it("reads the string attributes and ignores another type", () => {
    const turn = span({
      attributes: {
        "gen_ai.conversation.id": "session",
        "kanthord.session.entry_id": "entry",
        "gen_ai.tool.call.id": 5,
      },
    });

    expect(conversationIdOf(turn)).toBe("session");
    expect(replyEntryIdOf(turn)).toBe("entry");
    expect(toolCallIdOf(turn)).toBeNull();
  });
});
