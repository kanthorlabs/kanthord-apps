import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { TraceSpan } from "@/api/types";

import { NowBlock } from "./now-block";

const MINUTE_MS = 60_000;

function running(createdAt: number): TraceSpan {
  return {
    trace_id: "trace-1",
    span_id: "turn",
    parent_span_id: null,
    producer: "worker",
    origin: "observed",
    operation: "agent.turn",
    start_time: 0,
    end_time: null,
    status: "Unset",
    attributes: { "kanthord.turn.index": 3 },
    events: [],
    links: [],
    text_ids: [],
    created_at: createdAt,
  };
}

describe("NowBlock", () => {
  it("shows the running span and its age", () => {
    render(<NowBlock spans={[running(2 * MINUTE_MS)]} now={2 * MINUTE_MS} />);

    expect(screen.getByRole("heading", { name: "Now" })).toBeInTheDocument();
    expect(screen.getByText("Turn 3 is running for 2 min.")).toBeInTheDocument();
    expect(screen.queryByText(/No new record/)).not.toBeInTheDocument();
  });

  it("warns when no record arrives for a long time", () => {
    render(<NowBlock spans={[running(0)]} now={5 * MINUTE_MS} />);

    expect(screen.getByText("No new record for 5 min")).toBeInTheDocument();
  });

  it("says that no span runs when every span ended", () => {
    render(<NowBlock spans={[]} now={0} />);

    expect(screen.getByText("No span is running.")).toBeInTheDocument();
  });
});
