import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

vi.mock("@/api/resources/tracking", () => ({
  readSessionEntry: vi.fn(),
  readAnalyticsDuration: vi.fn(),
}));

import { readAnalyticsDuration, readSessionEntry } from "@/api/resources/tracking";
import type { AnalyticsDurationItem, TraceSessionEntry, TraceSpan } from "@/api/types";

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

function runningTool(attributes: TraceSpan["attributes"]): TraceSpan {
  return {
    ...running(0),
    span_id: "tool",
    parent_span_id: "turn",
    operation: "agent.tool",
    attributes: {
      "gen_ai.conversation.id": "session",
      "gen_ai.tool.call.id": "call-1",
      "gen_ai.tool.name": "bash",
      ...attributes,
    },
  };
}

function assistantEntry(command: string): TraceSessionEntry {
  return {
    trace_id: "trace-1",
    session_id: "session",
    entry_id: "tool-entry",
    parent_entry_id: null,
    sequence: 1,
    entry_type: "message",
    entry_time: 0,
    tool_call_id: null,
    truncated: false,
    entry: {
      type: "message",
      message: {
        role: "assistant",
        content: [{ type: "toolCall", id: "call-1", name: "bash", arguments: { command } }],
      },
    },
    created_at: 0,
  };
}

function p90Of(p90: number): AnalyticsDurationItem {
  return { key: "bash", bucket_start: null, count: 5, p50: 1, p90, p99: p90, mean: 1, max: p90 };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("NowBlock", () => {
  it("shows the running span and its age", () => {
    render(
      <NowBlock
        traceId="trace-1"
        projectId="project-1"
        spans={[running(2 * MINUTE_MS)]}
        now={2 * MINUTE_MS}
      />,
    );

    expect(screen.getByRole("heading", { name: "Now" })).toBeInTheDocument();
    expect(screen.getByText("Turn 3 is running for 2 min.")).toBeInTheDocument();
    expect(screen.queryByText(/No new record/)).not.toBeInTheDocument();
  });

  it("warns when no record arrives for a long time", () => {
    render(
      <NowBlock traceId="trace-1" projectId="project-1" spans={[running(0)]} now={5 * MINUTE_MS} />,
    );

    expect(screen.getByText("No new record for 5 min")).toBeInTheDocument();
  });

  it("says that no span runs when every span ended", () => {
    render(<NowBlock traceId="trace-1" projectId="project-1" spans={[]} now={0} />);

    expect(screen.getByText("No span is running.")).toBeInTheDocument();
  });

  it("shows the first line of the command of a running tool", async () => {
    vi.mocked(readSessionEntry).mockResolvedValue(assistantEntry("pnpm test\necho done"));
    const spans = [running(0), runningTool({ "kanthord.session.entry_id": "tool-entry" })];

    render(<NowBlock traceId="trace-1" projectId="project-1" spans={spans} now={MINUTE_MS} />);

    expect(await screen.findByText("Command")).toBeInTheDocument();
    expect(screen.getByText("pnpm test")).toBeInTheDocument();
    expect(readSessionEntry).toHaveBeenCalledWith("trace-1", "session", "tool-entry");
  });

  it("shows no command for a running turn", () => {
    render(
      <NowBlock traceId="trace-1" projectId="project-1" spans={[running(0)]} now={MINUTE_MS} />,
    );

    expect(screen.getByText("Turn 3 is running for 1 min.")).toBeInTheDocument();
    expect(screen.queryByText("Command")).not.toBeInTheDocument();
    expect(readSessionEntry).not.toHaveBeenCalled();
  });

  it("shows the running sentence and no command when the read fails", async () => {
    vi.mocked(readSessionEntry).mockRejectedValue(new ApiError("unavailable", "boom", 503));
    const spans = [running(0), runningTool({ "kanthord.session.entry_id": "tool-entry" })];

    render(<NowBlock traceId="trace-1" projectId="project-1" spans={spans} now={MINUTE_MS} />);

    await vi.waitFor(() => expect(readSessionEntry).toHaveBeenCalled());
    expect(screen.getByText(/is running for 1 min\./)).toBeInTheDocument();
    expect(screen.queryByText("Command")).not.toBeInTheDocument();
  });

  it("flags a running tool older than its p90", async () => {
    vi.mocked(readAnalyticsDuration).mockResolvedValue({
      items: [p90Of(30_000)],
      truncated: false,
    });

    render(
      <NowBlock
        traceId="trace-1"
        projectId="project-1"
        spans={[running(0), runningTool({})]}
        now={MINUTE_MS}
      />,
    );

    expect(
      await screen.findByText("Longer than 90% of the runs of this tool in 7 days (p90 30 s)."),
    ).toBeInTheDocument();
  });

  it("does not flag a running tool younger than its p90", async () => {
    vi.mocked(readAnalyticsDuration).mockResolvedValue({
      items: [p90Of(2 * MINUTE_MS)],
      truncated: false,
    });

    render(
      <NowBlock
        traceId="trace-1"
        projectId="project-1"
        spans={[running(0), runningTool({})]}
        now={MINUTE_MS}
      />,
    );

    await vi.waitFor(() => expect(readAnalyticsDuration).toHaveBeenCalled());
    expect(screen.queryByText(/Longer than 90%/)).not.toBeInTheDocument();
  });

  it("shows no flag when the p90 read fails", async () => {
    vi.mocked(readAnalyticsDuration).mockRejectedValue(new ApiError("unavailable", "boom", 503));

    render(
      <NowBlock
        traceId="trace-1"
        projectId="project-1"
        spans={[running(0), runningTool({})]}
        now={MINUTE_MS}
      />,
    );

    await vi.waitFor(() => expect(readAnalyticsDuration).toHaveBeenCalled());
    expect(screen.queryByText(/Longer than 90%/)).not.toBeInTheDocument();
  });

  it("reads no p90 for a running turn", () => {
    render(
      <NowBlock traceId="trace-1" projectId="project-1" spans={[running(0)]} now={MINUTE_MS} />,
    );

    expect(readAnalyticsDuration).not.toHaveBeenCalled();
  });
});
