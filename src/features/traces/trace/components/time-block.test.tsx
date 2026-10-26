import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { TraceSpan, TraceSummary } from "@/api/types";

import { TimeBlock } from "./time-block";

const SUMMARY = {
  trace_id: "trace-1",
  root_span_id: "root",
  started_at: 0,
  duration_ms: 10_000,
  root_attributes: { "kanthord.queue.wait_ms": 4000 },
  input_tokens: 1000,
  cache_read_tokens: 700,
  cache_creation_tokens: 100,
  turn_count: 3,
  tool_count: 5,
} as unknown as TraceSummary;

const SPANS: readonly TraceSpan[] = [
  {
    trace_id: "trace-1",
    span_id: "git",
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation: "worker.git",
    start_time: 0,
    end_time: 500,
    status: "Ok",
    attributes: {},
    events: [],
    links: [],
    text_ids: [],
    created_at: 0,
  },
];

describe("TimeBlock", () => {
  it("shows the total, the lines, the queue wait and the counts", () => {
    render(<TimeBlock summary={SUMMARY} spans={SPANS} />);
    expect(screen.getByText("Total 10 s")).toBeInTheDocument();
    expect(screen.getByText("Queue wait 4 s")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Git" })).toHaveAttribute("aria-valuenow", "5");
    expect(screen.getByText("500 ms")).toBeInTheDocument();
    expect(
      screen.getByText("3 turns, 5 tools, 70% of the input tokens came from the cache"),
    ).toBeInTheDocument();
  });

  it("keeps the cache share at read over input when the cache write is large", () => {
    const summary = { ...SUMMARY, cache_read_tokens: 100, cache_creation_tokens: 800 };
    render(<TimeBlock summary={summary} spans={SPANS} />);
    expect(
      screen.getByText("3 turns, 5 tools, 10% of the input tokens came from the cache"),
    ).toBeInTheDocument();
  });

  it("omits the queue wait when the root records none", () => {
    render(<TimeBlock summary={{ ...SUMMARY, root_attributes: null }} spans={[]} />);
    expect(screen.queryByText(/Queue wait/)).not.toBeInTheDocument();
  });
});

describe("TimeBlock of an open trace", () => {
  it("computes the total at the current time", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(7000);
    const open = { ...SUMMARY, state: "open", duration_ms: null } as TraceSummary;
    render(<TimeBlock summary={open} spans={[]} />);
    vi.useRealTimers();
    expect(screen.getByText("Total 7 s")).toBeInTheDocument();
  });
});
