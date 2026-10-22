import { describe, expect, it } from "vitest";

import type { TraceSpan } from "@/api/types";

import { traceAxis, waterfallBar } from "./trace-waterfall";

function span(start: number | null, end: number | null): TraceSpan {
  return {
    trace_id: "trace_1",
    span_id: "span_1",
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation: "other.op",
    start_time: start,
    end_time: end,
    status: "Ok",
    attributes: {},
    events: [],
    links: [],
    text_ids: [],
    created_at: 1,
  };
}

const axis = { start: 1000, end: 2000 };

describe("traceAxis", () => {
  it("starts at the smallest start and ends at the largest time", () => {
    expect(traceAxis([span(1500, 1800), span(1000, null), span(1900, null)])).toEqual({
      start: 1000,
      end: 1900,
    });
    expect(traceAxis([span(1000, 1200), span(1100, 2000)])).toEqual({ start: 1000, end: 2000 });
  });

  it("answers null when no span holds a time", () => {
    expect(traceAxis([])).toBeNull();
    expect(traceAxis([span(null, null)])).toBeNull();
  });

  it("answers an axis from end times alone", () => {
    expect(traceAxis([span(null, 500), span(null, 900)])).toEqual({ start: 500, end: 900 });
  });
});

describe("waterfallBar", () => {
  it("covers the range of a span with a start and an end", () => {
    expect(waterfallBar(span(1250, 1750), axis, "ok")).toEqual({
      offsetPercent: 25,
      widthPercent: 50,
      running: false,
      noEnd: false,
    });
  });

  it("runs to the axis end for a span without an end in an open trace", () => {
    expect(waterfallBar(span(1500, null), axis, "open")).toEqual({
      offsetPercent: 50,
      widthPercent: 50,
      running: true,
      noEnd: false,
    });
  });

  it("makes a bar of width 0 with noEnd for a span without an end in an ok trace", () => {
    expect(waterfallBar(span(1500, null), axis, "ok")).toEqual({
      offsetPercent: 50,
      widthPercent: 0,
      running: false,
      noEnd: true,
    });
    expect(waterfallBar(span(1500, null), axis, "error").noEnd).toBe(true);
  });

  it("makes a bar of width 0 at the end for a span with only an end", () => {
    expect(waterfallBar(span(null, 1500), axis, "open")).toEqual({
      offsetPercent: 50,
      widthPercent: 0,
      running: false,
      noEnd: false,
    });
  });

  it("gives a span with a start and an end at least 0.5 percent", () => {
    expect(waterfallBar(span(1500, 1500), axis, "ok").widthPercent).toBe(0.5);
  });

  it("gives a running span at least 0.5 percent", () => {
    expect(waterfallBar(span(2000, null), axis, "open").widthPercent).toBe(0.5);
  });

  it("answers offset 0 and width 100 on an axis of length 0", () => {
    const flat = { start: 1000, end: 1000 };
    expect(waterfallBar(span(1000, 1000), flat, "ok")).toMatchObject({
      offsetPercent: 0,
      widthPercent: 100,
    });
  });
});
