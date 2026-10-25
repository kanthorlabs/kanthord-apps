import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
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

function Location() {
  return <output>{useLocation().search}</output>;
}

function writtenKeys(): URLSearchParams {
  return new URLSearchParams(screen.getByRole("status").textContent ?? "");
}

function show(target: TraceSpan, spans: readonly TraceSpan[] = SPANS, onSelect = vi.fn()) {
  render(
    <MemoryRouter>
      <SpanDetail traceId="trace-1" span={target} spans={spans} onSelect={onSelect} />
      <Location />
    </MemoryRouter>,
  );
  return onSelect;
}

function factOf(label: string): Element | null {
  return screen.getByText(label).nextElementSibling;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("SpanDetail", () => {
  it("shows the identity and the time facts", () => {
    show(TURN);

    expect(factOf("Span id")).toHaveTextContent("turn-1");
    expect(factOf("Start")).toHaveTextContent(utcDateTime(START + 60_000));
    expect(factOf("End")).toHaveTextContent(utcDateTime(START + 180_000));
    expect(factOf("Duration")).toHaveTextContent("2 min");
    expect(factOf("Offset")).toHaveTextContent("1 min");
  });

  it("shows the output, the exit facts and then the command of a verification", async () => {
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
      {
        "kanthord.verification.index": 1,
        "process.exit.code": 127,
        "kanthord.verification.timed_out": false,
      },
      { text_ids: ["verify-1:command", "verify-1:output"] },
    );
    show(verification, [verification]);

    const result = screen.getByRole("region", { name: "Result" });
    const command = screen.getByRole("region", { name: "Command" });
    const output = await within(result).findByText("3 passed 0 failed");
    expect(within(result).getByText("process.exit.code").nextElementSibling).toHaveTextContent(
      "127",
    );
    expect(
      within(result).getByText("kanthord.verification.timed_out").nextElementSibling,
    ).toHaveTextContent("false");
    const exitCode = within(result).getByText("process.exit.code");
    const commandText = await within(command).findByText("pnpm test");
    expect(output.compareDocumentPosition(exitCode)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(result.compareDocumentPosition(command)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(commandText).toBeInTheDocument();
    expect(readTraceText).toHaveBeenCalledWith("trace-1", "verify-1:command");
    expect(readTraceText).toHaveBeenCalledWith("trace-1", "verify-1:output");
  });

  it("shows the error text and the violation of a gate before its step facts", async () => {
    vi.mocked(readTraceText).mockResolvedValue({
      trace_id: "trace-1",
      text_id: "gate-1:error",
      content: "Changed files outside the allowed paths.",
      created_at: START,
    });
    const gate = span(
      "gate-1",
      "root",
      "worker.gate",
      {
        "kanthord.gate.mode": "strict",
        "kanthord.gate.violation": "outside_scope",
        "kanthord.gate.changed": ["a.ts", "b.ts"],
      },
      { status: "Error", text_ids: ["gate-1:error"] },
    );
    show(gate, [gate]);

    const failure = screen.getByRole("region", { name: "Failure" });
    expect(await within(failure).findByText(/Changed files outside/)).toBeInTheDocument();
    expect(
      within(failure).getByText("kanthord.gate.violation").nextElementSibling,
    ).toHaveTextContent("outside_scope");
    const step = screen.getByRole("region", { name: "Step" });
    expect(within(step).getByText("kanthord.gate.mode").nextElementSibling).toHaveTextContent(
      "strict",
    );
    expect(within(step).getByText("kanthord.gate.changed").nextElementSibling).toHaveTextContent(
      "a.ts, b.ts",
    );
    expect(failure.compareDocumentPosition(step)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("shows the revocation label beside the end of a revoked execution", () => {
    const execution = span("exec", null, "scheduler.execution", {
      "kanthord.execution.end": "revoked",
      "kanthord.revoke.cause": "human",
      "kanthord.queue.wait_ms": 40,
    });
    show(execution, [execution]);

    const stop = screen.getByRole("region", { name: "Cause and stop" });
    expect(within(stop).getByText("kanthord.execution.end").nextElementSibling).toHaveTextContent(
      "revoked - Revoked by a human",
    );
    const queue = screen.getByRole("region", { name: "Queue" });
    expect(within(queue).getByText("kanthord.queue.wait_ms").nextElementSibling).toHaveTextContent(
      "40",
    );
  });

  it("keeps the texts in a collapsed Texts block", async () => {
    vi.mocked(readTraceText).mockResolvedValue({
      trace_id: "trace-1",
      text_id: "verify-1:output",
      content: "done",
      created_at: START,
    });
    const verification = span(
      "verify-1",
      "root",
      "worker.verification",
      {},
      { text_ids: ["verify-1:output"] },
    );
    show(verification, [verification]);

    expect(screen.queryByRole("region", { name: "Texts" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Texts" }));

    const texts = await screen.findByRole("region", { name: "Texts" });
    expect(await within(texts).findByText("done")).toBeInTheDocument();
    expect(within(texts).getByText("output")).toBeInTheDocument();
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

  it("opens the model reply entry of a turn in the conversation", async () => {
    vi.mocked(readSessionEntry).mockResolvedValue(REPLY_ENTRY);
    show(TURN);

    fireEvent.click(screen.getByRole("button", { name: "Conversation" }));

    const keys = writtenKeys();
    expect(keys.get("tab")).toBe("conversation");
    expect(keys.get("session")).toBe("session");
    expect(keys.get("entry")).toBe("entry-1");
    expect(await screen.findByText("I will list the files.")).toBeInTheDocument();
  });

  it("opens the result entry of a tool in the conversation", async () => {
    vi.mocked(readSessionEntry).mockResolvedValue(REPLY_ENTRY);
    vi.mocked(listSessionEntryPage).mockResolvedValue({
      items: [resultEntry(false)],
      next_cursor: null,
    });
    show(TOOL);

    fireEvent.click(await screen.findByRole("button", { name: "Conversation" }));

    const keys = writtenKeys();
    expect(keys.get("tab")).toBe("conversation");
    expect(keys.get("session")).toBe("session");
    expect(keys.get("entry")).toBe("entry-2");
  });

  it("opens the reply entry of the turn for a tool without a result entry", async () => {
    vi.mocked(readSessionEntry).mockResolvedValue(REPLY_ENTRY);
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: [], next_cursor: null });
    show(TOOL);

    fireEvent.click(await screen.findByRole("button", { name: "Conversation" }));

    const keys = writtenKeys();
    expect(keys.get("session")).toBe("session");
    expect(keys.get("entry")).toBe("entry-1");
  });

  it("offers no Conversation for a span outside a session", () => {
    const bare = span("bare", "root", "worker.git");
    show(bare, [bare]);

    expect(screen.queryByRole("button", { name: "Conversation" })).not.toBeInTheDocument();
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

    expect(screen.queryByRole("region", { name: "All attributes" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Events" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "All attributes" }));
    fireEvent.click(screen.getByRole("button", { name: "Events" }));
    const attributes = screen.getByRole("region", { name: "All attributes" });
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

    for (const name of ["All attributes", "Events", "Links", "Texts"]) {
      expect(screen.queryByRole("region", { name })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });
});

const PROVIDER_DETAIL = "429 Too Many Requests: slow down";

const FAILED_ROOT = span(
  "root",
  null,
  "scheduler.execution",
  {
    "kanthord.stop.reason": "provider_failed",
    "kanthord.stop.code": "rate_limited",
    "kanthord.stop.detail": PROVIDER_DETAIL,
  },
  { status: "Error", end_time: START + 100_000 },
);

const FAILED_TASK = span(
  "task",
  "root",
  "worker.task",
  { "kanthord.task.id": "t2" },
  { status: "Error", end_time: START + 100_000 },
);

function turnOf(id: string, index: number, tokens: number, overrides: Partial<TraceSpan> = {}) {
  return span(
    id,
    "task",
    "agent.turn",
    {
      "kanthord.turn.index": index,
      "gen_ai.conversation.id": "session",
      "gen_ai.usage.input_tokens": tokens,
    },
    { end_time: START + index * 1000, ...overrides },
  );
}

const CAUSAL_TURN = turnOf("turn-5", 5, 3000, {
  status: "Error",
  attributes: {
    "kanthord.turn.index": 5,
    "gen_ai.conversation.id": "session",
    "gen_ai.usage.input_tokens": 3000,
    "error.type": "rate_limited",
  },
  end_time: START + 90_000,
});

const RECOVERED_TOOL = span(
  "tool-recovered",
  "turn-1b",
  "agent.tool",
  { "error.type": "tool_error" },
  { status: "Error", end_time: START + 500 },
);

const FAILED_SPANS = [
  FAILED_ROOT,
  FAILED_TASK,
  turnOf("turn-1b", 1, 1000),
  turnOf("turn-3", 3, 2000),
  CAUSAL_TURN,
  RECOVERED_TOOL,
];

describe("SpanDetail provider error", () => {
  it("shows the root stop detail as the error of the causal turn", async () => {
    vi.mocked(readSessionEntry).mockRejectedValue(new ApiError("not_found", "No entry.", 404));
    show(CAUSAL_TURN, FAILED_SPANS);

    const error = await screen.findByRole("region", { name: "Provider error" });
    expect(within(error).getByText(PROVIDER_DETAIL)).toBeInTheDocument();
    expect(screen.queryByText("The entry holds no model reply.")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Model reply" })).not.toBeInTheDocument();
  });

  it("shows the whole stop detail without a cut", async () => {
    const detail = `${"x".repeat(400)} end of error`;
    const root = span(
      "root",
      null,
      "scheduler.execution",
      { ...FAILED_ROOT.attributes, "kanthord.stop.detail": detail },
      { status: "Error", end_time: START + 100_000 },
    );
    vi.mocked(readSessionEntry).mockRejectedValue(new ApiError("not_found", "No entry.", 404));
    show(CAUSAL_TURN, [root, FAILED_TASK, CAUSAL_TURN]);

    expect(await screen.findByText(detail)).toBeInTheDocument();
  });

  it("shows the errorMessage of the reply entry for a turn that is not causal", async () => {
    vi.mocked(readSessionEntry).mockResolvedValue(
      entry("entry-1", {
        type: "message",
        message: { role: "assistant", content: [], errorMessage: "529 Overloaded" },
      }),
    );
    show(TURN);

    const error = await screen.findByRole("region", { name: "Provider error" });
    expect(within(error).getByText("529 Overloaded")).toBeInTheDocument();
  });

  it("shows the model reply of a turn without an error", async () => {
    vi.mocked(readSessionEntry).mockResolvedValue(REPLY_ENTRY);
    show(TURN);

    expect(await screen.findByRole("region", { name: "Model reply" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Provider error" })).not.toBeInTheDocument();
  });

  it("keeps The entry holds no model reply. for another entry without an error", async () => {
    vi.mocked(readSessionEntry).mockResolvedValue(
      entry("entry-1", { type: "message", message: { role: "user", content: "hi" } }),
    );
    show(TURN);

    expect(await screen.findByText("The entry holds no model reply.")).toBeInTheDocument();
  });
});

describe("SpanDetail why this span", () => {
  it.each([
    [CAUSAL_TURN, "Causal span of this trace.", "Parent Task t2 ended Error."],
    [FAILED_TASK, "Consequence of the stop.", "Parent Execution ended Error."],
    [RECOVERED_TOOL, "Recovered error.", "Parent Turn 1 ended OK."],
  ])("states the role and the parent of %#", (target, role, parent) => {
    vi.mocked(readSessionEntry).mockRejectedValue(new ApiError("not_found", "No entry.", 404));
    show(target, FAILED_SPANS);

    const why = screen.getByRole("region", { name: "Why this span" });
    expect(within(why).getByText(role)).toBeInTheDocument();
    expect(within(why).getByText(parent)).toBeInTheDocument();
  });

  it("states only the parent for a span without an error role", () => {
    const turn = turnOf("turn-1b", 1, 1000);
    show(turn, FAILED_SPANS);

    const why = screen.getByRole("region", { name: "Why this span" });
    expect(within(why).getByText("Parent Task t2 ended Error.")).toBeInTheDocument();
    expect(within(why).queryByText(/span of this trace|Consequence|Recovered/)).toBeNull();
  });
});

describe("SpanDetail input tokens chart", () => {
  it("charts the input tokens of each turn of the session and marks the selected turn", () => {
    show(CAUSAL_TURN, FAILED_SPANS);

    const chart = screen.getByRole("list", { name: "Input tokens per turn" });
    const rows = within(chart).getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(["11.0k", "32.0k", "53.0kThis turn"]);
    expect(rows.filter((row) => row.getAttribute("aria-current") === "true")).toEqual([rows[2]]);
    expect(within(rows[2] as HTMLElement).getByText("This turn")).toBeInTheDocument();
  });

  it("charts the turns for a session span and marks no turn", () => {
    const session = span("session", "task", "agent.session", { "kanthord.agent.name": "coder" });
    show(session, [...FAILED_SPANS, session]);

    const rows = within(screen.getByRole("list", { name: "Input tokens per turn" })).getAllByRole(
      "listitem",
    );
    expect(rows).toHaveLength(3);
    expect(screen.queryByText("This turn")).not.toBeInTheDocument();
  });

  it("shows no chart for a span that is no turn and no session", () => {
    show(FAILED_TASK, FAILED_SPANS);

    expect(screen.queryByRole("list", { name: "Input tokens per turn" })).not.toBeInTheDocument();
  });
});

describe("SpanDetail identity", () => {
  it("shows a long identity whole and copies it", async () => {
    const identity = `span-${"0123456789abcdef".repeat(8)}`;
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    const long = span(identity, "root", "worker.git");
    show(long, [long]);

    expect(factOf("Span id")).toHaveTextContent(identity);
    fireEvent.click(screen.getByRole("button", { name: "Copy Span id" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(identity));
  });
});

describe("SpanDetail footer", () => {
  it("steps to the previous and the next error", () => {
    vi.mocked(readSessionEntry).mockRejectedValue(new ApiError("not_found", "No entry.", 404));
    const onSelect = show(FAILED_TASK, FAILED_SPANS);

    fireEvent.click(screen.getByRole("button", { name: "Previous error" }));
    expect(onSelect).toHaveBeenLastCalledWith("turn-5");
    fireEvent.click(screen.getByRole("button", { name: "Next error" }));
    expect(onSelect).toHaveBeenLastCalledWith("root");
  });

  it("disables the control at the end of the errors", () => {
    vi.mocked(readSessionEntry).mockRejectedValue(new ApiError("not_found", "No entry.", 404));
    show(CAUSAL_TURN, FAILED_SPANS);

    expect(screen.getByRole("button", { name: "Previous error" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next error" })).toBeEnabled();
  });
});
