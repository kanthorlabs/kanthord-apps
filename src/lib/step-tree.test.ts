import { describe, expect, it } from "vitest";

import type { SpanAttributeValue, SpanStatus, TraceSpan } from "@/api/types";

import {
  INDENT_PX,
  MAX_INDENT_LEVEL,
  pillFilter,
  selfTimeMs,
  StepPill,
  type StepRow,
  stepRows,
} from "./step-tree";
import { buildSpanTree } from "./trace-tree";

interface Options {
  readonly status?: SpanStatus;
  readonly attributes?: Record<string, SpanAttributeValue>;
}

function span(
  id: string,
  parent: string | null,
  operation: string,
  start: number,
  end: number,
  options: Options = {},
): TraceSpan {
  return {
    trace_id: "trace_1",
    span_id: id,
    parent_span_id: parent,
    producer: "worker",
    origin: "observed",
    operation,
    start_time: start,
    end_time: end,
    status: options.status ?? "Ok",
    attributes: options.attributes ?? {},
    events: [],
    links: [],
    text_ids: [],
    created_at: 1,
  };
}

function turns(count: number, parent: string): TraceSpan[] {
  return Array.from({ length: count }, (_, index) =>
    span(`turn_${index + 1}`, parent, "agent.turn", index * 10, index * 10 + 10, {
      attributes: { "kanthord.turn.index": index + 1 },
    }),
  );
}

function rowsOf(spans: readonly TraceSpan[], expanded: string[] = []): readonly StepRow[] {
  return stepRows(buildSpanTree(spans), { expanded: new Set(expanded), keep: null });
}

function names(rows: readonly StepRow[]): string[] {
  return rows.map((row) => ("span" in row ? row.span.span_id : row.key));
}

const session = span("session", null, "agent.session", 0, 100);

describe("constants", () => {
  it("holds the indent limits", () => {
    expect(MAX_INDENT_LEVEL).toBe(4);
    expect(INDENT_PX).toBe(12);
  });
});

describe("stepRows", () => {
  it("shows one span row with its label, duration and status", () => {
    const rows = rowsOf([session, ...turns(1, "session")], ["session"]);
    expect(rows[0]).toMatchObject({
      depth: 0,
      label: "Session",
      durationMs: 100,
      status: "Ok",
      hasChildren: true,
    });
    expect(rows[1]).toMatchObject({ depth: 1, label: "Turn 1", hasChildren: false });
  });

  it("folds eight turns into one collapsed group", () => {
    const rows = rowsOf([session, ...turns(8, "session")], ["session"]);
    expect(names(rows)).toEqual(["session", "turns:turn_1"]);
    expect(rows[1]).toEqual({
      key: "turns:turn_1",
      depth: 1,
      first: 1,
      last: 8,
      turnCount: 8,
      durationMs: 80,
      toolErrorCount: 0,
      spanIds: ["turn_1", "turn_2", "turn_3", "turn_4", "turn_5", "turn_6", "turn_7", "turn_8"],
    });
  });

  it("keeps a lone turn as a span row", () => {
    const rows = rowsOf([session, ...turns(1, "session")], ["session"]);
    expect(names(rows)).toEqual(["session", "turn_1"]);
  });

  it("keeps an Error turn outside the group and splits the run", () => {
    const all = turns(8, "session").map((turn) =>
      turn.span_id === "turn_4" ? { ...turn, status: "Error" as const } : turn,
    );
    const rows = rowsOf([session, ...all], ["session"]);
    expect(names(rows)).toEqual(["session", "turns:turn_1", "turn_4", "turns:turn_5"]);
    expect(rows[1]).toMatchObject({ first: 1, last: 3, turnCount: 3 });
    expect(rows[3]).toMatchObject({ first: 5, last: 8, turnCount: 4 });
  });

  it("counts the tool errors under the turns of a group", () => {
    const tools = [
      span("tool_1", "turn_2", "agent.tool", 10, 12, { status: "Error" }),
      span("tool_2", "turn_3", "agent.tool", 20, 22),
    ];
    const rows = rowsOf([session, ...turns(3, "session"), ...tools], ["session"]);
    expect(rows[1]).toMatchObject({ toolErrorCount: 1 });
  });

  it("lists the turns under an expanded group", () => {
    const rows = rowsOf([session, ...turns(3, "session")], ["session", "turns:turn_1"]);
    expect(names(rows)).toEqual(["session", "turns:turn_1", "turn_1", "turn_2", "turn_3"]);
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 2, 2, 2]);
  });

  it("shows the children of a turn of an expanded group when the turn is expanded", () => {
    const tool = span("tool_1", "turn_1", "agent.tool", 0, 5);
    const rows = rowsOf(
      [session, ...turns(2, "session"), tool],
      ["session", "turns:turn_1", "turn_1"],
    );
    expect(names(rows)).toEqual(["session", "turns:turn_1", "turn_1", "tool_1", "turn_2"]);
  });

  it("hides the children of a collapsed span", () => {
    expect(names(rowsOf([session, ...turns(3, "session")]))).toEqual(["session"]);
  });

  it("holds the true depth of a row below the indent cap", () => {
    const chain = Array.from({ length: MAX_INDENT_LEVEL + 3 }, (_, level) =>
      span(`s${level}`, level === 0 ? null : `s${level - 1}`, "other.op", level, 100 - level),
    );
    const expanded = chain.map((item) => item.span_id);
    const depths = rowsOf(chain, expanded).map((row) => row.depth);
    expect(depths).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(Math.min(depths[6] ?? 0, MAX_INDENT_LEVEL) * INDENT_PX).toBe(48);
  });

  it("shows no group and every kept row when a filter is active", () => {
    const spans = [session, ...turns(3, "session")];
    const rows = stepRows(buildSpanTree(spans), {
      expanded: new Set(),
      keep: (item) => item.operation === "agent.turn",
    });
    expect(names(rows)).toEqual(["session", "turn_1", "turn_2", "turn_3"]);
  });
});

describe("selfTimeMs", () => {
  it("subtracts the union of overlapping children", () => {
    const spans = [
      span("parent", null, "other.op", 0, 100),
      span("a", "parent", "other.op", 10, 40),
      span("b", "parent", "other.op", 30, 60),
      span("c", "parent", "other.op", 80, 90),
    ];
    const [root] = buildSpanTree(spans);
    expect(root).toBeDefined();
    expect(selfTimeMs(root as NonNullable<typeof root>)).toBe(40);
  });

  it("answers the full duration for a span without children", () => {
    const [root] = buildSpanTree([span("only", null, "other.op", 5, 25)]);
    expect(selfTimeMs(root as NonNullable<typeof root>)).toBe(20);
  });
});

describe("pillFilter", () => {
  const spans = [
    span("task", null, "worker.task", 0, 1000),
    span("session", "task", "agent.session", 0, 500),
    span("turn", "session", "agent.turn", 0, 400),
    span("tool", "turn", "agent.tool", 0, 100),
    span("verify", "task", "worker.verification", 500, 520),
    span("setup", "task", "worker.setup", 520, 530),
    span("gate", "task", "worker.gate", 530, 540),
    span("release", "task", "worker.release_gate", 540, 550),
    span("evaluation", "task", "worker.evaluation", 550, 560),
    span("git", "task", "worker.git", 560, 570),
  ];
  const summary = { duration_ms: 1000 };

  function kept(pill: StepPill, errors: string[] = []): string[] {
    const keep = pillFilter(pill, spans, summary, new Set(errors));
    return spans.filter(keep).map((item) => item.span_id);
  }

  it("keeps the error spans with their ancestors", () => {
    expect(kept(StepPill.Errors, ["tool"])).toEqual(["task", "session", "turn", "tool"]);
  });

  it("keeps nothing for errors without an error span", () => {
    expect(kept(StepPill.Errors)).toEqual([]);
  });

  it("keeps the spans with a self time of at least ten percent with their ancestors", () => {
    expect(kept(StepPill.Slow)).toEqual(["task", "session", "turn", "tool"]);
  });

  it("keeps no slow span when the trace has no duration", () => {
    const keep = pillFilter(StepPill.Slow, spans, { duration_ms: null }, new Set());
    expect(spans.filter(keep)).toEqual([]);
  });

  it("keeps the agent spans with their ancestors", () => {
    expect(kept(StepPill.Agent)).toEqual(["task", "session", "turn", "tool"]);
  });

  it("keeps the check spans with their ancestors", () => {
    expect(kept(StepPill.Checks)).toEqual(["task", "verify", "setup", "release", "evaluation"]);
  });

  it("keeps the git spans with their ancestors", () => {
    expect(kept(StepPill.Git)).toEqual(["task", "gate", "git"]);
  });

  it("builds the rows of a pill with its ancestors", () => {
    const keep = pillFilter(StepPill.Git, spans, summary, new Set());
    const rows = stepRows(buildSpanTree(spans), { expanded: new Set(), keep });
    expect(names(rows)).toEqual(["task", "gate", "git"]);
  });
});
