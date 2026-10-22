import { describe, expect, it } from "vitest";

import type { SpanAttributeValue, TraceSpan } from "@/api/types";

import { ancestorIds, buildSpanTree, spanMatches, visibleRows } from "./trace-tree";

function span(
  id: string,
  parent: string | null,
  start: number | null,
  operation = "other.op",
  attributes: Record<string, SpanAttributeValue> = {},
): TraceSpan {
  return {
    trace_id: "trace_1",
    span_id: id,
    parent_span_id: parent,
    producer: "worker",
    origin: "observed",
    operation,
    start_time: start,
    end_time: null,
    status: "Ok",
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: 1,
  };
}

const ids = (nodes: readonly { span: TraceSpan }[]): string[] =>
  nodes.map((node) => node.span.span_id);

describe("buildSpanTree", () => {
  it("places a span with a missing parent at the top level with parentMissing", () => {
    const roots = buildSpanTree([span("a", null, 1), span("b", "gone", 2), span("c", "a", 3)]);
    expect(ids(roots)).toEqual(["a", "b"]);
    expect(roots.map((root) => root.parentMissing)).toEqual([false, true]);
    expect(ids(roots[0]?.children ?? [])).toEqual(["c"]);
    expect(roots[0]?.children[0]?.depth).toBe(1);
    expect(roots[0]?.children[0]?.parentMissing).toBe(false);
  });

  it("sorts children by start, a null start last, then by span id", () => {
    const roots = buildSpanTree([
      span("root", null, 0),
      span("z", "root", 5),
      span("n", "root", null),
      span("b", "root", 5),
      span("a", "root", 9),
      span("first", "root", 1),
    ]);
    expect(ids(roots[0]?.children ?? [])).toEqual(["first", "b", "z", "a", "n"]);
  });

  it("sorts the roots the same way", () => {
    const roots = buildSpanTree([
      span("late", null, 9),
      span("none", null, null),
      span("early", null, 1),
    ]);
    expect(ids(roots)).toEqual(["early", "late", "none"]);
  });

  it("never loops on a cycle of parents", () => {
    const roots = buildSpanTree([
      span("root", null, 0),
      span("a", "b", 1),
      span("b", "a", 2),
      span("s", "s", 3),
    ]);
    expect(ids(roots)).toEqual(["root"]);
  });

  it("skips a span that appears twice", () => {
    const roots = buildSpanTree([
      span("root", null, 0),
      span("dup", "root", 1),
      span("dup", "root", 2),
    ]);
    expect(ids(roots[0]?.children ?? [])).toEqual(["dup"]);
  });
});

describe("spanMatches", () => {
  const tool = span("t", null, 1, "agent.tool", { "gen_ai.tool.name": "Bash", "kanthord.n": 42 });

  it("matches the label without regard to case", () => {
    expect(spanMatches(tool, "bAsH")).toBe(true);
  });

  it("matches the string form of an attribute value", () => {
    expect(spanMatches(span("x", null, 1, "other.op", { code: 4242 }), "424")).toBe(true);
    expect(spanMatches(span("x", null, 1, "other.op", { tags: ["Alpha", "beta"] }), "alpha")).toBe(
      true,
    );
  });

  it("rejects a text that is nowhere", () => {
    expect(spanMatches(tool, "missing")).toBe(false);
  });
});

describe("visibleRows", () => {
  const roots = buildSpanTree([
    span("root", null, 0),
    span("a", "root", 1),
    span("a1", "a", 2),
    span("a2", "a", 3, "agent.tool", { "gen_ai.tool.name": "deep-match" }),
    span("b", "root", 4),
  ]);
  const none = new Set<string>();

  it("shows only the roots when no node is expanded", () => {
    expect(ids(visibleRows(roots, { expanded: none, keep: null }))).toEqual(["root"]);
  });

  it("shows the children of an expanded node depth first", () => {
    const rows = visibleRows(roots, { expanded: new Set(["root", "a"]), keep: null });
    expect(ids(rows)).toEqual(["root", "a", "a1", "a2", "b"]);
  });

  it("keeps the children of a collapsed node hidden", () => {
    const rows = visibleRows(roots, { expanded: new Set(["root"]), keep: null });
    expect(ids(rows)).toEqual(["root", "a", "b"]);
  });

  it("shows the ancestors of a span that passes keep", () => {
    const rows = visibleRows(roots, { expanded: none, keep: (s) => s.span_id === "a1" });
    expect(ids(rows)).toEqual(["root", "a", "a1"]);
  });

  it("shows a search match deep in the tree with its ancestors", () => {
    const rows = visibleRows(roots, { expanded: none, keep: (s) => spanMatches(s, "deep-match") });
    expect(ids(rows)).toEqual(["root", "a", "a2"]);
  });

  it("shows nothing when no span passes keep", () => {
    expect(visibleRows(roots, { expanded: none, keep: () => false })).toEqual([]);
  });
});

describe("ancestorIds", () => {
  const spans = [
    span("root", null, 0),
    span("a", "root", 1),
    span("b", "a", 2),
    span("orphan", "gone", 3),
  ];

  it("answers the span identities from the root down to the parent", () => {
    expect(ancestorIds(spans, "b")).toEqual(["root", "a"]);
  });

  it("answers nothing for a root, an orphan or an unknown span", () => {
    expect(ancestorIds(spans, "root")).toEqual([]);
    expect(ancestorIds(spans, "orphan")).toEqual([]);
    expect(ancestorIds(spans, "unknown")).toEqual([]);
  });

  it("stops on a cycle of parents", () => {
    const cycle = [span("a", "b", 1), span("b", "a", 2)];
    expect(ancestorIds(cycle, "a")).toEqual(["b"]);
  });
});
