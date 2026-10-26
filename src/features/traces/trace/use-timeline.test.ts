import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import type { TraceSpan, TraceState } from "@/api/types";
import { StepPill, type StepRow } from "@/lib/step-tree";

import { useTimeline } from "./use-timeline";

function span(
  id: string,
  parent: string | null,
  operation: string,
  attributes: TraceSpan["attributes"] = {},
  overrides: Partial<TraceSpan> = {},
): TraceSpan {
  return {
    trace_id: "trace-1",
    span_id: id,
    parent_span_id: parent,
    producer: "worker",
    origin: "observed",
    operation,
    start_time: 1000,
    end_time: 2000,
    status: "Ok",
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: 1000,
    ...overrides,
  };
}

const SPANS: readonly TraceSpan[] = [
  span("root", null, "scheduler.execution"),
  span("phase", "root", "worker.phase", { "kanthord.phase": "execute" }, { start_time: 1001 }),
  span("task", "phase", "worker.task", { "kanthord.task.id": "t1" }, { start_time: 1002 }),
  span("turn", "task", "agent.turn", { "kanthord.turn.index": 1 }, { start_time: 1003 }),
  span(
    "bash",
    "turn",
    "agent.tool",
    { "gen_ai.tool.name": "bash" },
    { start_time: 1004, status: "Error" },
  ),
  span("read", "turn", "agent.tool", { "gen_ai.tool.name": "read" }, { start_time: 1005 }),
  span("commit", "root", "worker.git", { "kanthord.git.step": "commit" }, { start_time: 1006 }),
];

const NO_TASK_NAMES: ReadonlyMap<string, string> = new Map();

function setup(selected: string | null = null) {
  const selectSpan = vi.fn();
  const hook = renderHook(
    (props: { readonly span: string | null }) =>
      useTimeline(SPANS, { span: props.span, selectSpan }, NO_TASK_NAMES, "ok"),
    { initialProps: { span: selected } },
  );
  return { ...hook, selectSpan };
}

function idsOf(rows: readonly StepRow[]): readonly string[] {
  return rows.map((row) => ("span" in row ? row.span.span_id : row.key));
}

function labelsOf(rows: readonly StepRow[]): readonly string[] {
  return rows.map((row) => ("span" in row ? row.label : row.key));
}

const TURN_COUNT = 8;
const FAILING_TURN = 3;

function turnSpans(): readonly TraceSpan[] {
  const turns = Array.from({ length: TURN_COUNT }, (_, index) =>
    span(
      `turn_${index + 1}`,
      "session",
      "agent.turn",
      { "kanthord.turn.index": index + 1 },
      { start_time: 1010 + index, end_time: 1011 + index },
    ),
  );
  return [
    span("root", null, "scheduler.execution"),
    span("session", "root", "agent.session", {}, { start_time: 1001 }),
    ...turns,
    span(
      "tool",
      `turn_${FAILING_TURN}`,
      "agent.tool",
      { "gen_ai.tool.name": "bash" },
      { start_time: 1012, end_time: 1013, status: "Error" },
    ),
  ];
}

function setupTurns(selected: string | null = null) {
  const turns = turnSpans();
  return renderHook(() =>
    useTimeline(turns, { span: selected, selectSpan: vi.fn() }, NO_TASK_NAMES, "ok"),
  );
}

function recoveredSpans(): readonly TraceSpan[] {
  return [
    span("root", null, "scheduler.execution"),
    span("task", "root", "worker.task", {}, { start_time: 1001 }),
    span(
      "recovered",
      "task",
      "agent.tool",
      { "gen_ai.tool.name": "read" },
      { start_time: 1002, end_time: 1500, status: "Error" },
    ),
    span("fine", "task", "agent.tool", { "gen_ai.tool.name": "grep" }, { start_time: 1600 }),
    span(
      "fatal",
      "task",
      "agent.tool",
      { "gen_ai.tool.name": "bash" },
      { start_time: 1700, end_time: 1900, status: "Error" },
    ),
  ];
}

function press(key: string) {
  const preventDefault = vi.fn();
  return { key, defaultPrevented: false, preventDefault } as unknown as KeyboardEvent<HTMLElement>;
}

describe("useTimeline filters", () => {
  it("expands the root and the phases on the first render", () => {
    const { result } = setup();

    expect(idsOf(result.current.rows)).toEqual(["root", "phase", "task", "commit"]);
    expect(result.current.filtered).toBe(false);
  });

  it("expands the sessions on the first render", () => {
    const sessions = [
      span("root", null, "scheduler.execution"),
      span("session", "root", "agent.session", {}, { start_time: 1001 }),
      span("child", "session", "agent.turn", {}, { start_time: 1002 }),
    ];
    const { result } = renderHook(() =>
      useTimeline(sessions, { span: null, selectSpan: vi.fn() }, NO_TASK_NAMES, "ok"),
    );

    expect(idsOf(result.current.rows)).toEqual(["root", "session", "child"]);
  });

  it("keeps the causal span, its consequences and their ancestors with the Errors pill", () => {
    const { result } = setup();

    act(() => result.current.setPill(StepPill.Errors));

    expect(idsOf(result.current.rows)).toEqual(["root", "phase", "task", "turn", "bash"]);
    expect(result.current.filtered).toBe(true);
  });

  it("keeps the spans of a group pill with their ancestors", () => {
    const { result } = setup();

    act(() => result.current.setPill(StepPill.Git));
    expect(idsOf(result.current.rows)).toEqual(["root", "commit"]);

    act(() => result.current.setPill(StepPill.Agent));
    expect(idsOf(result.current.rows)).toEqual(["root", "phase", "task", "turn", "bash", "read"]);

    act(() => result.current.setPill(null));
    expect(result.current.filtered).toBe(false);
  });

  it("keeps the spans that hold a tenth of the trace time with the Slow pill", () => {
    const slow = [
      span("root", null, "scheduler.execution", {}, { start_time: 0, end_time: 1000 }),
      span("quick", "root", "worker.git", {}, { start_time: 0, end_time: 10 }),
      span("long", "root", "worker.git", {}, { start_time: 10, end_time: 900 }),
    ];
    const { result } = renderHook(() =>
      useTimeline(slow, { span: null, selectSpan: vi.fn() }, NO_TASK_NAMES, "ok"),
    );

    act(() => result.current.setPill(StepPill.Slow));

    expect(idsOf(result.current.rows)).toEqual(["root", "long"]);
  });

  it("combines the search and a pill with AND", () => {
    const { result } = setup();

    act(() => result.current.setSearch("read"));
    act(() => result.current.setPill(StepPill.Errors));
    expect(idsOf(result.current.rows)).toEqual([]);

    act(() => result.current.setSearch("b"));
    expect(idsOf(result.current.rows)).toEqual(["root", "phase", "task", "turn", "bash"]);

    act(() => result.current.setPill(StepPill.Git));
    expect(idsOf(result.current.rows)).toEqual([]);
  });

  it("adds the recovered spans with All errors", () => {
    const recovered = recoveredSpans();
    const { result } = renderHook(() =>
      useTimeline(recovered, { span: null, selectSpan: vi.fn() }, NO_TASK_NAMES, "ok"),
    );

    act(() => result.current.setPill(StepPill.Errors));
    expect(idsOf(result.current.rows)).toEqual(["root", "task", "fatal"]);
    expect(result.current.errorCount).toBe(1);

    act(() => result.current.setAllErrors(true));
    expect(idsOf(result.current.rows)).toEqual(["root", "task", "recovered", "fatal"]);
  });

  it("names the causal span and the role of each error", () => {
    const recovered = recoveredSpans();
    const { result } = renderHook(() =>
      useTimeline(recovered, { span: null, selectSpan: vi.fn() }, NO_TASK_NAMES, "ok"),
    );

    expect(result.current.causalSpanId).toBe("fatal");
    expect(result.current.roleOf("fatal")).toBe("causal");
    expect(result.current.roleOf("recovered")).toBe("recovered");
    expect(result.current.roleOf("fine")).toBeUndefined();
  });

  it("names no causal span in a trace without an error", () => {
    const clean = [span("root", null, "scheduler.execution"), span("git", "root", "worker.git")];
    const { result } = renderHook(() =>
      useTimeline(clean, { span: null, selectSpan: vi.fn() }, NO_TASK_NAMES, "ok"),
    );

    expect(result.current.causalSpanId).toBeNull();
    expect(result.current.errorCount).toBe(0);
  });

  it("shows the name of a task in taskNames and the task id otherwise", () => {
    const named = renderHook(() =>
      useTimeline(
        SPANS,
        { span: null, selectSpan: vi.fn() },
        new Map([["t1", "Build the page"]]),
        "ok",
      ),
    );
    const unnamed = renderHook(() =>
      useTimeline(SPANS, { span: null, selectSpan: vi.fn() }, new Map([["t2", "Other"]]), "ok"),
    );

    expect(labelsOf(named.result.current.rows)).toContain("Build the page");
    expect(labelsOf(unnamed.result.current.rows)).toContain("Task t1");
  });

  it("keeps no filter when every filter is inactive", () => {
    const { result } = setup();

    act(() => result.current.setSearch("  "));

    expect(result.current.filtered).toBe(false);
  });

  it("expands every row and collapses every row", () => {
    const { result } = setup();

    act(() => result.current.expandAll());
    expect(idsOf(result.current.rows)).toHaveLength(SPANS.length);

    act(() => result.current.collapseAll());
    expect(idsOf(result.current.rows)).toEqual(["root"]);
  });

  it("expands the ancestors of a selected span", () => {
    const { result, rerender } = setup();

    rerender({ span: "read" });

    expect(idsOf(result.current.rows)).toContain("read");
  });

  it("expands the ancestors of a span selected on the first render", () => {
    const { result } = setup("bash");

    expect(idsOf(result.current.rows)).toEqual([
      "root",
      "phase",
      "task",
      "turn",
      "bash",
      "read",
      "commit",
    ]);
  });
});

describe("useTimeline turn groups", () => {
  it("folds eight turns into one collapsed group", () => {
    const { result } = setupTurns();

    expect(idsOf(result.current.rows)).toEqual(["root", "session", "turns:turn_1"]);
    expect(result.current.rows[2]).toMatchObject({
      first: 1,
      last: TURN_COUNT,
      turnCount: TURN_COUNT,
      toolErrorCount: 1,
    });
  });

  it("opens and closes a group with toggle", () => {
    const { result } = setupTurns();

    act(() => result.current.toggle("turns:turn_1"));
    expect(idsOf(result.current.rows)).toHaveLength(2 + 1 + TURN_COUNT);
    expect(result.current.isExpanded(result.current.rows[2] as StepRow)).toBe(true);

    act(() => result.current.toggle("turns:turn_1"));
    expect(idsOf(result.current.rows)).toEqual(["root", "session", "turns:turn_1"]);
  });

  it("opens the group of a selected span", () => {
    const { result } = setupTurns("tool");

    expect(idsOf(result.current.rows)).toContain("tool");
  });

  it("searches inside a collapsed group", () => {
    const { result } = setupTurns();

    act(() => result.current.setSearch("bash"));

    expect(idsOf(result.current.rows)).toEqual(["root", "session", "turn_3", "tool"]);
  });
});

function liveTurns(count: number, failing: number | null = null): readonly TraceSpan[] {
  const turns = Array.from({ length: count }, (_, index) =>
    span(
      `turn_${index + 1}`,
      "session",
      "agent.turn",
      { "kanthord.turn.index": index + 1 },
      {
        start_time: 1010 + index,
        end_time: 1011 + index,
        status: index + 1 === failing ? "Error" : "Ok",
      },
    ),
  );
  return [
    span("root", null, "scheduler.execution"),
    span("session", "root", "agent.session", {}, { start_time: 1001 }),
    ...turns,
    span(
      "tool_1",
      "turn_1",
      "agent.tool",
      { "gen_ai.tool.name": "bash" },
      { start_time: 1012, end_time: 1013 },
    ),
  ];
}

function setupLive(initial: readonly TraceSpan[]) {
  return renderHook(
    (props: { readonly spans: readonly TraceSpan[] }) =>
      useTimeline(props.spans, { span: null, selectSpan: vi.fn() }, NO_TASK_NAMES, "open"),
    { initialProps: { spans: initial } },
  );
}

describe("useTimeline live updates", () => {
  it("keeps a group open when a new turn joins its run", () => {
    const { result, rerender } = setupLive(liveTurns(3));
    act(() => result.current.toggle("turns:turn_1"));

    rerender({ spans: liveTurns(4) });

    expect(idsOf(result.current.rows)).toContain("turn_4");
  });

  it("keeps a lone expanded turn visible when a second turn arrives", () => {
    const { result, rerender } = setupLive(liveTurns(1));
    act(() => result.current.toggle("turn_1"));
    expect(idsOf(result.current.rows)).toContain("tool_1");

    rerender({ spans: liveTurns(2) });

    expect(idsOf(result.current.rows)).toEqual([
      "root",
      "session",
      "turns:turn_1",
      "turn_1",
      "tool_1",
      "turn_2",
    ]);
  });

  it("opens the new group when a turn ends with Error inside an open group", () => {
    const { result, rerender } = setupLive(liveTurns(5));
    act(() => result.current.toggle("turns:turn_1"));

    rerender({ spans: liveTurns(5, 3) });

    expect(idsOf(result.current.rows)).toEqual([
      "root",
      "session",
      "turns:turn_1",
      "turn_1",
      "turn_2",
      "turn_3",
      "turns:turn_4",
      "turn_4",
      "turn_5",
    ]);
  });

  it("keeps a group that the reader collapsed collapsed", () => {
    const { result, rerender } = setupLive(liveTurns(3));
    act(() => result.current.toggle("turns:turn_1"));
    act(() => result.current.toggle("turns:turn_1"));

    rerender({ spans: liveTurns(4) });

    expect(idsOf(result.current.rows)).toEqual(["root", "session", "turns:turn_1"]);
  });

  it("keeps a group that the reader never opened collapsed", () => {
    const { result, rerender } = setupLive(liveTurns(3));

    rerender({ spans: liveTurns(4) });

    expect(idsOf(result.current.rows)).toEqual(["root", "session", "turns:turn_1"]);
  });
});

function runningToolSpans(): readonly TraceSpan[] {
  return [
    span("root", null, "scheduler.execution"),
    span("task", "root", "worker.task", {}, { start_time: 1001 }),
    span("turn_1", "task", "agent.turn", {}, { start_time: 1002, end_time: 1003 }),
    span("turn_2", "task", "agent.turn", {}, { start_time: 1004, end_time: null }),
    span("tool_2", "turn_2", "agent.tool", {}, { start_time: 1005, end_time: null }),
  ];
}

function setupFirstRender(spans: readonly TraceSpan[], state: TraceState) {
  return renderHook(() =>
    useTimeline(spans, { span: null, selectSpan: vi.fn() }, NO_TASK_NAMES, state),
  );
}

describe("useTimeline first render", () => {
  it("opens the path to the deepest running span of an open trace", () => {
    const { result } = setupFirstRender(runningToolSpans(), "open");

    expect(idsOf(result.current.rows)).toEqual([
      "root",
      "task",
      "turns:turn_1",
      "turn_1",
      "turn_2",
      "tool_2",
    ]);
  });

  it("keeps the initial rows of an ok trace with a span that has no end", () => {
    const { result } = setupFirstRender(runningToolSpans(), "ok");

    expect(idsOf(result.current.rows)).toEqual(["root", "task"]);
  });
});

describe("useTimeline keyboard", () => {
  it("moves the selection with ArrowDown and ArrowUp", () => {
    const { result, selectSpan } = setup("phase");

    const down = press("ArrowDown");
    act(() => result.current.onKey(down));
    expect(selectSpan).toHaveBeenLastCalledWith("task");
    expect(down.preventDefault).toHaveBeenCalled();

    act(() => result.current.onKey(press("ArrowUp")));
    expect(selectSpan).toHaveBeenLastCalledWith("root");
  });

  it("starts from the first row when no row is selected", () => {
    const { result, selectSpan } = setup();

    act(() => result.current.onKey(press("ArrowDown")));

    expect(selectSpan).toHaveBeenLastCalledWith("phase");
  });

  it("selects nothing past the first and the last row", () => {
    const { result, selectSpan } = setup("root");

    act(() => result.current.onKey(press("ArrowUp")));

    expect(selectSpan).not.toHaveBeenCalled();
  });

  it("expands the selected row with ArrowRight", () => {
    const { result } = setup("task");

    act(() => result.current.onKey(press("ArrowRight")));

    expect(idsOf(result.current.rows)).toContain("turn");
  });

  it("collapses the selected row with ArrowLeft and then moves to its parent", () => {
    const { result, selectSpan } = setup("phase");

    act(() => result.current.onKey(press("ArrowLeft")));
    expect(idsOf(result.current.rows)).toEqual(["root", "phase", "commit"]);
    expect(selectSpan).not.toHaveBeenCalled();

    act(() => result.current.onKey(press("ArrowLeft")));
    expect(selectSpan).toHaveBeenLastCalledWith("root");
  });

  it("moves to the parent from a row without children", () => {
    const { result, selectSpan } = setup("commit");

    act(() => result.current.onKey(press("ArrowLeft")));

    expect(selectSpan).toHaveBeenLastCalledWith("root");
  });

  it("selects the row with Enter", () => {
    const { result, selectSpan } = setup("task");

    act(() => result.current.onKey(press("Enter")));

    expect(selectSpan).toHaveBeenLastCalledWith("task");
  });

  it("ignores another key and an event that a handler already took", () => {
    const { result, selectSpan } = setup("task");

    const other = press("a");
    act(() => result.current.onKey(other));
    const taken = { ...press("ArrowDown"), defaultPrevented: true } as KeyboardEvent<HTMLElement>;
    act(() => result.current.onKey(taken));

    expect(other.preventDefault).not.toHaveBeenCalled();
    expect(selectSpan).not.toHaveBeenCalled();
  });

  it("keeps the expanded state while a filter is active", () => {
    const { result, selectSpan } = setup("task");

    act(() => result.current.setSearch("bash"));
    act(() => result.current.onKey(press("ArrowRight")));
    act(() => result.current.onKey(press("ArrowLeft")));

    expect(selectSpan).toHaveBeenLastCalledWith("phase");
  });
});
