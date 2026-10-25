import { describe, expect, it } from "vitest";

import type { TimelineItem } from "@/api/types";

import { durationText } from "./format";

import {
  executionKindOf,
  executionStateOf,
  executionStopReasonOf,
  hasOpenRoot,
  itemKindOf,
  reasonTextIdOf,
  spanDurationText,
  timelineRows,
} from "./timeline-rows";

const START = Date.UTC(2026, 4, 2, 10, 0);

function item(spanId: string, overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    trace_id: "trace_a",
    span_id: spanId,
    parent_span_id: null,
    producer: "scheduler",
    origin: "asserted",
    operation: "scheduler.execution",
    start_time: START,
    end_time: START + 60_000,
    status: "Ok",
    attributes: {},
    events: [],
    links: [],
    text_ids: [],
    created_at: START,
    depth: 1,
    duration_ms: 60_000,
    project_id: "project_1",
    node_id: "node_1",
    execution_id: "execution_1",
    attempt: 1,
    worker_name: "general",
    ...overrides,
  };
}

function child(spanId: string, start: number, overrides: Partial<TimelineItem> = {}) {
  return item(spanId, {
    depth: 2,
    parent_span_id: "root_a",
    operation: "worker.phase",
    start_time: start,
    end_time: start + 1_000,
    ...overrides,
  });
}

describe("timelineRows", () => {
  it("orders the groups by the start of the trace and the children by time", () => {
    const rows = timelineRows([
      item("root_b", { trace_id: "trace_b", start_time: START + 10_000 }),
      child("late", START + 5_000),
      item("root_a", { start_time: START }),
      child("early", START + 1_000),
    ]);

    expect(rows.map((row) => row.key)).toEqual(["root_a", "early", "late", "root_b"]);
    expect(rows.map((row) => row.kind)).toEqual(["root", "child", "child", "root"]);
  });

  it("adds a missing root row before the items of a trace with no stored root", () => {
    const rows = timelineRows([child("orphan", START, { trace_id: "trace_c" })]);

    expect(rows).toEqual([
      { kind: "missing_root", key: "trace_c:root", traceId: "trace_c" },
      expect.objectContaining({ kind: "child", key: "orphan" }),
    ]);
  });

  it("joins the items of a trace that two pages hold into one group", () => {
    const rows = timelineRows([
      item("root_a"),
      child("first", START + 1_000),
      item("root_b", { trace_id: "trace_b", start_time: START + 9_000 }),
      child("second", START + 2_000),
    ]);

    expect(rows.map((row) => row.key)).toEqual(["root_a", "first", "second", "root_b"]);
  });

  it("marks a child row by the end of its root span", () => {
    const rows = timelineRows([
      item("root_a"),
      child("under_ended", START + 1_000),
      item("root_b", { trace_id: "trace_b", end_time: null }),
      child("under_open", START + 2_000, { trace_id: "trace_b" }),
      child("orphan", START + 3_000, { trace_id: "trace_c" }),
    ]);

    const rootEnded = Object.fromEntries(
      rows.flatMap((row) => (row.kind === "child" ? [[row.key, row.rootEnded]] : [])),
    );
    expect(rootEnded).toEqual({ under_ended: true, under_open: false, orphan: false });
  });

  it("keeps one row for a span that two reads return", () => {
    const rows = timelineRows([item("root_a"), item("root_a", { end_time: null })]);

    expect(rows).toHaveLength(1);
  });
});

describe("spanDurationText", () => {
  it("shows the duration of a span with an end", () => {
    expect(spanDurationText(child("a", START, { duration_ms: 1_000 }), true)).toBe(
      durationText(1_000),
    );
  });

  it("shows running for a span with no end under an open root span", () => {
    expect(spanDurationText(child("a", START, { end_time: null, duration_ms: null }), false)).toBe(
      "running",
    );
  });

  it("shows No start recorded for a span with no start", () => {
    expect(
      spanDurationText(child("a", START, { start_time: null, duration_ms: null }), false),
    ).toBe("No start recorded");
  });

  it("shows No end recorded for a span with no end under a root span with an end", () => {
    expect(spanDurationText(child("a", START, { end_time: null, duration_ms: null }), true)).toBe(
      "No end recorded",
    );
  });
});

describe("hasOpenRoot", () => {
  it("is true when a root span has no end", () => {
    expect(hasOpenRoot([item("root_a", { end_time: null })])).toBe(true);
  });

  it("is false when every root span has an end", () => {
    expect(hasOpenRoot([item("root_a"), child("open", START, { end_time: null })])).toBe(false);
  });
});

describe("execution facts", () => {
  it("derives the state from the end and the status of the root span", () => {
    expect(executionStateOf(item("a", { end_time: null }))).toBe("open");
    expect(executionStateOf(item("a", { status: "Error" }))).toBe("error");
    expect(executionStateOf(item("a"))).toBe("ok");
  });

  it("reads the kind and the stop reason from the attributes", () => {
    const revoked = item("a", {
      attributes: { "kanthord.execution.kind": "steps", "kanthord.execution.end": "revoked" },
    });

    expect(executionKindOf(revoked)).toBe("steps");
    expect(executionStopReasonOf(revoked)).toBe("revoked");
    expect(executionKindOf(item("a"))).toBeNull();
    expect(executionStopReasonOf(item("a"))).toBeNull();
  });

  it("reads the revocation label as the stop reason of a revoked execution with a cause", () => {
    const revoked = item("a", {
      attributes: { "kanthord.execution.end": "revoked", "kanthord.revoke.cause": "assessment" },
    });

    expect(executionStopReasonOf(revoked)).toBe("Revoked by a review");
  });

  it("reports no stop reason for a finished execution", () => {
    const finished = item("a", { attributes: { "kanthord.execution.end": "finished" } });

    expect(executionStopReasonOf(finished)).toBeNull();
  });
});

describe("reasonTextIdOf", () => {
  it("finds the text whose name is reason", () => {
    const act = item("a", { text_ids: ["a:note", "a:reason"] });

    expect(reasonTextIdOf(act)).toBe("a:reason");
    expect(reasonTextIdOf(item("a"))).toBeNull();
  });
});

describe("itemKindOf", () => {
  it("names the kind of the row of an operation", () => {
    const kindOf = (operation: string) => itemKindOf(item("a", { operation }));

    expect(kindOf("scheduler.execution")).toBe("execution");
    expect(kindOf("scheduler.transition")).toBe("transition");
    expect(kindOf("mission.node.pause")).toBe("act");
    expect(kindOf("worker.phase")).toBe("span");
  });
});
