import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

vi.mock("@/api/resources/tracking", () => ({
  readTraceText: vi.fn(),
  readSessionEntry: vi.fn(),
  listSessionEntryPage: vi.fn(),
}));

import { listSessionEntryPage, readSessionEntry, readTraceText } from "@/api/resources/tracking";
import type { TraceSessionEntry, TraceSpan } from "@/api/types";
import { utcDateTime } from "@/lib/format";

import { SpanDetail } from "./span-detail";

const START = Date.UTC(2026, 4, 2, 10, 30);

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
    start_time: START,
    end_time: START + 1000,
    status: "Ok",
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: START,
    ...overrides,
  };
}

function entry(id: string, raw: Record<string, unknown>, toolCallId: string | null = null) {
  return {
    trace_id: "trace-1",
    session_id: "session",
    entry_id: id,
    parent_entry_id: null,
    sequence: 1,
    entry_type: "message",
    entry_time: START,
    tool_call_id: toolCallId,
    truncated: false,
    entry: raw,
    created_at: START,
  } satisfies TraceSessionEntry;
}

const REPLY_ENTRY = entry("entry-1", {
  type: "message",
  message: {
    role: "assistant",
    content: [
      { type: "text", text: "I will list the files." },
      { type: "thinking", thinking: "Plan the listing." },
      { type: "toolCall", id: "call-1", name: "bash", arguments: { command: "ls" } },
    ],
  },
});

function resultEntry(isError: boolean) {
  return entry(
    "entry-2",
    {
      type: "message",
      message: {
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "bash",
        isError,
        content: [{ type: "text", text: "a.txt" }],
      },
    },
    "call-1",
  );
}

const TURN = span(
  "turn-1",
  "task",
  "agent.turn",
  {
    "kanthord.turn.index": 1,
    "gen_ai.conversation.id": "session",
    "kanthord.session.entry_id": "entry-1",
    "gen_ai.request.model": "claude-a",
    "gen_ai.response.model": "claude-b",
    "gen_ai.usage.input_tokens": 1200,
    "gen_ai.usage.output_tokens": 600,
    "gen_ai.usage.cache_read.input_tokens": 300,
    "gen_ai.usage.cache_creation.input_tokens": 200,
    "kanthord.usage.cost_usd": 0.06,
    "gen_ai.response.finish_reasons": ["stop", "length"],
    "kanthord.turn.model_duration_ms": 2500,
  },
  { start_time: START + 60_000, end_time: START + 180_000 },
);

const TOOL = span(
  "tool-1",
  "turn-1",
  "agent.tool",
  {
    "gen_ai.conversation.id": "session",
    "gen_ai.tool.name": "bash",
    "gen_ai.tool.call.id": "call-1",
  },
  { start_time: START + 61_000 },
);

const SPANS = [span("root", null, "scheduler.execution"), TURN, TOOL];

function show(target: TraceSpan, spans: readonly TraceSpan[] = SPANS, onSelect = vi.fn()) {
  render(<SpanDetail traceId="trace-1" span={target} spans={spans} onSelect={onSelect} />);
  return onSelect;
}

function factOf(label: string): Element | null {
  return screen.getByText(label).nextElementSibling;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("SpanDetail", () => {
  it("shows the label, the status and the time facts", () => {
    show(TURN);

    expect(screen.getByRole("heading", { name: "Turn 1" })).toBeInTheDocument();
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(factOf("Start")).toHaveTextContent(utcDateTime(START + 60_000));
    expect(factOf("End")).toHaveTextContent(utcDateTime(START + 180_000));
    expect(factOf("Duration")).toHaveTextContent("2 min");
    expect(factOf("Offset")).toHaveTextContent("1 min");
  });

  it("shows the command and the output texts of a verification", async () => {
    vi.mocked(readTraceText).mockImplementation(async (traceId, textId) => ({
      trace_id: traceId,
      text_id: textId,
      content: textId.endsWith(":command") ? "pnpm test" : "3 passed\n0 failed",
      created_at: START,
    }));
    const verification = span(
      "verify-1",
      "root",
      "worker.verification",
      { "kanthord.verification.index": 1 },
      { text_ids: ["verify-1:command", "verify-1:output"] },
    );
    show(verification, [verification]);

    const texts = screen.getByRole("region", { name: "Texts" });
    expect(await within(texts).findByText("pnpm test")).toBeInTheDocument();
    expect(within(texts).getByText("command")).toBeInTheDocument();
    expect(within(texts).getByText("output")).toBeInTheDocument();
    expect(await within(texts).findByText("3 passed 0 failed")).toBeInTheDocument();
    expect(readTraceText).toHaveBeenCalledWith("trace-1", "verify-1:command");
    expect(readTraceText).toHaveBeenCalledWith("trace-1", "verify-1:output");
  });

  it("shows a failed text read in its block and the other text beside it", async () => {
    vi.mocked(readTraceText).mockImplementation(async (traceId, textId) => {
      if (textId.endsWith(":command")) throw new ApiError("unavailable", "Daemon down.", 503);
      return { trace_id: traceId, text_id: textId, content: "done", created_at: START };
    });
    const verification = span(
      "verify-1",
      "root",
      "worker.verification",
      {},
      { text_ids: ["verify-1:command", "verify-1:output"] },
    );
    show(verification, [verification]);

    expect(await screen.findByText("Daemon down.")).toBeInTheDocument();
    expect(await screen.findByText("done")).toBeInTheDocument();
  });

  it("shows the facts, the reply and the thinking of a turn and opens its tool span", async () => {
    vi.mocked(readSessionEntry).mockResolvedValue(REPLY_ENTRY);
    const onSelect = show(TURN);

    for (const [label, value] of [
      ["Model", "claude-b"],
      ["Input tokens", "1.2k"],
      ["Output tokens", "600"],
      ["Cached tokens", "500"],
      ["Est. cost", "$0.0600"],
      ["Finish reason", "stop, length"],
      ["Model duration", "2 s"],
    ] as const) {
      expect(factOf(label)).toHaveTextContent(value);
    }
    expect(await screen.findByText("I will list the files.")).toBeInTheDocument();
    expect(readSessionEntry).toHaveBeenCalledWith("trace-1", "session", "entry-1");

    expect(screen.queryByText("Plan the listing.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show thinking" }));
    expect(await screen.findByText("Plan the listing.")).toBeInTheDocument();

    const reply = screen.getByRole("region", { name: "Model reply" });
    expect(within(reply).getByText("bash")).toBeInTheDocument();
    fireEvent.click(within(reply).getByRole("button", { name: "Open tool span" }));
    expect(onSelect).toHaveBeenCalledWith("tool-1");
  });

  it("falls back to the request model and omits an absent fact", () => {
    const turn = span("turn-2", "task", "agent.turn", { "gen_ai.request.model": "claude-a" });
    show(turn, [turn]);

    expect(factOf("Model")).toHaveTextContent("claude-a");
    expect(screen.queryByText("Input tokens")).not.toBeInTheDocument();
    expect(screen.queryByText("Cached tokens")).not.toBeInTheDocument();
    expect(screen.queryByText("Finish reason")).not.toBeInTheDocument();
  });

  it("shows the arguments and the result of a tool", async () => {
    vi.mocked(readSessionEntry).mockResolvedValue(REPLY_ENTRY);
    vi.mocked(listSessionEntryPage).mockResolvedValue({
      items: [resultEntry(false)],
      next_cursor: null,
    });
    show(TOOL);

    const args = screen.getByRole("region", { name: "Arguments" });
    expect((await within(args).findByText(/"command"/)).textContent).toBe(
      '{\n  "command": "ls"\n}',
    );
    const result = screen.getByRole("region", { name: "Result" });
    expect(await within(result).findByText("a.txt")).toBeInTheDocument();
    expect(within(result).getByText("OK")).toBeInTheDocument();
    expect(readSessionEntry).toHaveBeenCalledWith("trace-1", "session", "entry-1");
    expect(listSessionEntryPage).toHaveBeenCalledWith("trace-1", "session", null, 1, "call-1");
  });

  it("shows the Error outcome of a failed tool", async () => {
    vi.mocked(readSessionEntry).mockResolvedValue(REPLY_ENTRY);
    vi.mocked(listSessionEntryPage).mockResolvedValue({
      items: [resultEntry(true)],
      next_cursor: null,
    });
    show(TOOL);

    const result = screen.getByRole("region", { name: "Result" });
    expect(await within(result).findByText("a.txt")).toBeInTheDocument();
    expect(within(result).getByText("Error")).toBeInTheDocument();
  });

  it("shows The entry is not stored. for a not_found reply entry", async () => {
    vi.mocked(readSessionEntry).mockRejectedValue(new ApiError("not_found", "No entry.", 404));
    show(TURN);

    const reply = screen.getByRole("region", { name: "Model reply" });
    expect(await within(reply).findByText("The entry is not stored.")).toBeInTheDocument();
  });

  it("shows The entry is not stored. for a tool without a result entry", async () => {
    vi.mocked(readSessionEntry).mockRejectedValue(new ApiError("not_found", "No entry.", 404));
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: [], next_cursor: null });
    show(TOOL);

    const result = screen.getByRole("region", { name: "Result" });
    expect(await within(result).findByText("The entry is not stored.")).toBeInTheDocument();
    const args = screen.getByRole("region", { name: "Arguments" });
    expect(await within(args).findByText("The entry is not stored.")).toBeInTheDocument();
  });

  it("shows the message of another entry failure", async () => {
    vi.mocked(readSessionEntry).mockRejectedValue(new ApiError("unavailable", "Daemon down.", 503));
    show(TURN);

    expect(await screen.findByText("Daemon down.")).toBeInTheDocument();
  });

  it("lists every attribute, event and link", () => {
    const busy = span(
      "busy",
      "root",
      "worker.git",
      { "kanthord.git.step": "commit", count: 3, flag: true, tags: ["a", "b"] },
      {
        events: [
          { name: "retry", time: START + 1, attributes: { reason: "slow" } },
          { name: "done", time: START + 2 },
        ],
        links: [
          { trace_id: "trace-2", span_id: "span-2" },
          { trace_id: "trace-3", span_id: "span-3" },
        ],
      },
    );
    show(busy, [busy]);

    const attributes = screen.getByRole("region", { name: "Attributes" });
    for (const [name, value] of [
      ["kanthord.git.step", "commit"],
      ["count", "3"],
      ["flag", "true"],
      ["tags", "a, b"],
    ] as const) {
      expect(within(attributes).getByText(name).nextElementSibling).toHaveTextContent(value);
    }
    const events = screen.getByRole("region", { name: "Events" });
    expect(within(events).getByText("retry")).toBeInTheDocument();
    expect(within(events).getByText("done")).toBeInTheDocument();
    expect(within(events).getAllByText(utcDateTime(START))).toHaveLength(2);
    expect(within(events).getByText("reason").nextElementSibling).toHaveTextContent("slow");
    const links = screen.getByRole("region", { name: "Links" });
    for (const id of ["trace-2", "span-2", "trace-3", "span-3"]) {
      expect(within(links).getByText(id)).toBeInTheDocument();
    }
  });

  it("omits an empty section", () => {
    const bare = span("bare", "root", "worker.git");
    show(bare, [bare]);

    for (const name of ["Attributes", "Events", "Links", "Texts"]) {
      expect(screen.queryByRole("region", { name })).not.toBeInTheDocument();
    }
  });
});
