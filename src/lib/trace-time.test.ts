import { describe, expect, it } from "vitest";

import type { TraceSpan, TraceSummary } from "@/api/types";

import { TIME_LINE_LABELS, timeBreakdown, TimeLine, turnInputTokens, unionMs } from "./trace-time";

const NOW = 100_000;

function summaryOf(overrides: Partial<TraceSummary> = {}): TraceSummary {
  return {
    trace_id: "trace-1",
    root_span_id: "root",
    started_at: 0,
    duration_ms: 10_000,
    root_attributes: null,
    ...overrides,
  } as TraceSummary;
}

function span(
  id: string,
  operation: string,
  start: number | null,
  end: number | null,
  attributes: TraceSpan["attributes"] = {},
): TraceSpan {
  return {
    trace_id: "trace-1",
    span_id: id,
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation,
    start_time: start,
    end_time: end,
    status: "Ok",
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: 0,
  };
}

function msOf(breakdown: ReturnType<typeof timeBreakdown>, line: TimeLine): number {
  return breakdown.lines.find((entry) => entry.line === line)?.ms ?? Number.NaN;
}

describe("unionMs", () => {
  it("counts overlapping intervals once", () => {
    expect(
      unionMs([
        [0, 100],
        [50, 150],
        [300, 400],
      ]),
    ).toBe(250);
  });

  it("counts a nested interval once", () => {
    expect(
      unionMs([
        [0, 100],
        [20, 30],
      ]),
    ).toBe(100);
  });

  it("answers 0 for no interval", () => {
    expect(unionMs([])).toBe(0);
  });
});

describe("timeBreakdown", () => {
  it("counts an open interval up to now", () => {
    const spans = [span("t", "agent.tool", 90_000, null)];
    const breakdown = timeBreakdown(summaryOf({ duration_ms: 20_000 }), spans, NOW);
    expect(msOf(breakdown, TimeLine.ToolLatency)).toBe(10_000);
  });

  it("answers the duration of a closed trace as the total", () => {
    expect(timeBreakdown(summaryOf({ duration_ms: 20_000 }), [], NOW).totalMs).toBe(20_000);
  });

  it("counts two parallel tool calls once", () => {
    const spans = [span("a", "agent.tool", 1000, 3000), span("b", "agent.tool", 2000, 4000)];
    const breakdown = timeBreakdown(summaryOf(), spans, NOW);
    expect(msOf(breakdown, TimeLine.ToolLatency)).toBe(3000);
  });

  it("takes the tool time out of the turn that holds it", () => {
    const spans = [span("turn", "agent.turn", 1000, 5000), span("tool", "agent.tool", 2000, 3000)];
    const breakdown = timeBreakdown(summaryOf(), spans, NOW);
    expect(msOf(breakdown, TimeLine.ModelCalls)).toBe(3000);
    expect(msOf(breakdown, TimeLine.ToolLatency)).toBe(1000);
    expect(msOf(breakdown, TimeLine.WorkerOther)).toBe(6000);
  });

  it("sums verification and git lines and the shares", () => {
    const spans = [
      span("v", "worker.verification", 0, 1000),
      span("g", "worker.git", 1000, 1500),
      span("k", "worker.gate", 1500, 2000),
    ];
    const breakdown = timeBreakdown(summaryOf(), spans, NOW);
    expect(msOf(breakdown, TimeLine.VerificationTime)).toBe(1000);
    expect(msOf(breakdown, TimeLine.Git)).toBe(1000);
    expect(breakdown.lines.find((entry) => entry.line === TimeLine.Git)?.share).toBe(0.1);
    expect(msOf(breakdown, TimeLine.WorkerOther)).toBe(8000);
  });

  it("keeps worker_other at 0 when the intervals exceed the duration", () => {
    const spans = [span("v", "worker.verification", 0, 20_000)];
    const breakdown = timeBreakdown(summaryOf(), spans, NOW);
    expect(msOf(breakdown, TimeLine.WorkerOther)).toBe(0);
  });

  it("answers the whole duration as worker_other for a trace with no spans", () => {
    const breakdown = timeBreakdown(summaryOf(), [], NOW);
    expect(breakdown.lines.map((entry) => entry.line)).toEqual(Object.values(TimeLine));
    expect(msOf(breakdown, TimeLine.WorkerOther)).toBe(10_000);
    expect(msOf(breakdown, TimeLine.ModelCalls)).toBe(0);
    expect(breakdown.queueWaitMs).toBeNull();
  });

  it("answers 0 shares for a trace with no duration", () => {
    const breakdown = timeBreakdown(summaryOf({ duration_ms: 0 }), [], NOW);
    expect(breakdown.lines.every((entry) => entry.share === 0)).toBe(true);
  });

  it("answers the queue wait of the root span outside the total", () => {
    const spans = [span("root", "worker.run", 0, 10_000, { "kanthord.queue.wait_ms": 4000 })];
    const breakdown = timeBreakdown(summaryOf(), spans, NOW);
    expect(breakdown.queueWaitMs).toBe(4000);
    expect(msOf(breakdown, TimeLine.WorkerOther)).toBe(10_000);
  });

  it("labels every line", () => {
    expect(TIME_LINE_LABELS[TimeLine.ModelCalls]).toBe("Model calls");
    expect(TIME_LINE_LABELS[TimeLine.WorkerOther]).toBe("Worker other");
  });
});

describe("turnInputTokens", () => {
  const turn = (id: string, session: string, index: number, tokens?: number): TraceSpan =>
    span(id, "agent.turn", 0, 1, {
      "gen_ai.conversation.id": session,
      "kanthord.turn.index": index,
      ...(tokens === undefined ? {} : { "gen_ai.usage.input_tokens": tokens }),
    });

  it("lists the turns of the session in index order with 0 for absent tokens", () => {
    const spans = [
      turn("c", "s1", 3, 30),
      turn("a", "s1", 1, 10),
      turn("other", "s2", 2, 99),
      turn("b", "s1", 2),
    ];
    expect(turnInputTokens(spans, "s1")).toEqual([
      { spanId: "a", index: 1, inputTokens: 10 },
      { spanId: "b", index: 2, inputTokens: 0 },
      { spanId: "c", index: 3, inputTokens: 30 },
    ]);
  });

  it("answers no turn without a session", () => {
    expect(turnInputTokens([turn("a", "s1", 1, 10)], null)).toEqual([]);
  });
});
