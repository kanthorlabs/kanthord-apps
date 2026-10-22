import { act, renderHook } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import { describe, expect, it, vi } from "vitest";

import type { TraceSpan } from "@/api/types";

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

function setup(selected: string | null = null) {
  const selectSpan = vi.fn();
  const hook = renderHook(
    (props: { readonly span: string | null }) =>
      useTimeline(SPANS, { span: props.span, selectSpan }),
    { initialProps: { span: selected } },
  );
  return { ...hook, selectSpan };
}

function idsOf(rows: readonly { readonly span: TraceSpan }[]): readonly string[] {
  return rows.map((row) => row.span.span_id);
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
    const { result } = renderHook(() => useTimeline(sessions, { span: null, selectSpan: vi.fn() }));

    expect(idsOf(result.current.rows)).toEqual(["root", "session", "child"]);
  });

  it("combines the search, Errors only and the group with AND", () => {
    const { result } = setup();

    act(() => result.current.setSearch("b"));
    expect(idsOf(result.current.rows)).toEqual(["root", "phase", "task", "turn", "bash"]);

    act(() => result.current.setSearch("read"));
    act(() => result.current.setErrorsOnly(true));
    expect(idsOf(result.current.rows)).toEqual([]);

    act(() => result.current.setSearch(""));
    expect(idsOf(result.current.rows)).toEqual(["root", "phase", "task", "turn", "bash"]);

    act(() => result.current.setGroup("git"));
    expect(idsOf(result.current.rows)).toEqual([]);

    act(() => result.current.setErrorsOnly(false));
    expect(idsOf(result.current.rows)).toEqual(["root", "commit"]);
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
