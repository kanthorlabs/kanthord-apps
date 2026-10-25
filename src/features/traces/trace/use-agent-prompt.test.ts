import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/tracking", () => ({
  listSessionEntryPage: vi.fn(),
}));

import { listSessionEntryPage } from "@/api/resources/tracking";
import type { SpanAttributeValue, TraceSessionEntry, TraceSpan } from "@/api/types";

import { useAgentPrompt } from "./use-agent-prompt";
import type { TraceSelection } from "./use-trace-selection";

function span(
  id: string,
  operation: string,
  attributes: Readonly<Record<string, SpanAttributeValue>> = {},
  overrides: Partial<TraceSpan> = {},
): TraceSpan {
  return {
    trace_id: "trace-1",
    span_id: id,
    parent_span_id: null,
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

function entry(id: string, sequence: number, raw: Record<string, unknown>): TraceSessionEntry {
  return {
    trace_id: "trace-1",
    session_id: "session-1",
    entry_id: id,
    parent_entry_id: null,
    sequence,
    entry_type: String(raw.type),
    entry_time: 1000,
    tool_call_id: null,
    truncated: false,
    entry: raw,
    created_at: 1000,
  };
}

function message(role: string, text: string): Record<string, unknown> {
  return { type: "message", message: { role, content: [{ type: "text", text }] } };
}

const SYSTEM_ENTRY = {
  type: "custom",
  customType: "kanthord.pinned_context",
  data: { part: "system_prompt", text: "You are a coder." },
};

const ENTRIES = [
  entry("pinned", 1, SYSTEM_ENTRY),
  entry("work-1", 2, message("user", "Do task one now")),
  entry("reply-1", 3, message("assistant", "ok")),
  entry("work-2", 4, message("user", "Do two")),
  entry("reply-2", 5, message("assistant", "done")),
];

const SPANS = [
  span("session-1", "agent.session", { "kanthord.agent.name": "coder" }),
  span("prompt", "agent.prompt", {
    "kanthord.agent.name": "coder",
    "kanthord.prompt.parts": ["system:coder:a1", "rules:style:b2", "task:work:c3"],
  }),
  span("task-1", "worker.task", { "kanthord.task.id": "T1" }),
  span("task-2", "worker.task", { "kanthord.task.id": "T2" }, { start_time: 3000 }),
  span(
    "turn-1",
    "agent.turn",
    {
      "kanthord.prompt.template": "work",
      "gen_ai.conversation.id": "session-1",
      "kanthord.session.entry_id": "reply-1",
    },
    { parent_span_id: "task-1" },
  ),
  span(
    "turn-2",
    "agent.turn",
    {
      "kanthord.prompt.template": "revision",
      "gen_ai.conversation.id": "session-1",
      "kanthord.session.entry_id": "reply-2",
    },
    { parent_span_id: "task-2", start_time: 3000 },
  ),
];

function selectionOf(openInConversation = vi.fn()): TraceSelection {
  return { openInConversation } as unknown as TraceSelection;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("useAgentPrompt", () => {
  it("lists the prompt parts of the agent in reading order", async () => {
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: ENTRIES, next_cursor: null });

    const { result } = renderHook(() => useAgentPrompt("trace-1", SPANS, selectionOf()));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agents.map((agent) => agent.name)).toEqual(["coder"]);
    expect(result.current.agents[0]?.parts.map((part) => `${part.part} ${part.name}`)).toEqual([
      "system coder",
      "rules style",
      "task work",
    ]);
  });

  it("answers the system prompt entry and its length", async () => {
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: ENTRIES, next_cursor: null });

    const { result } = renderHook(() => useAgentPrompt("trace-1", SPANS, selectionOf()));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agents[0]?.systemPrompt).toEqual({
      entryId: "pinned",
      length: 16,
      text: "You are a coder.",
    });
  });

  it("answers the work prompt entry, its length and the template of each task", async () => {
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: ENTRIES, next_cursor: null });

    const { result } = renderHook(() => useAgentPrompt("trace-1", SPANS, selectionOf()));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.tasks).toEqual([
      {
        taskId: "T1",
        template: "work",
        prompt: { entryId: "work-1", length: 15, text: "Do task one now" },
      },
      {
        taskId: "T2",
        template: "revision",
        prompt: { entryId: "work-2", length: 6, text: "Do two" },
      },
    ]);
  });

  it("reads the entries of the first session only", async () => {
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: ENTRIES, next_cursor: null });
    const spans = [
      ...SPANS,
      span("session-0", "agent.session", { "kanthord.agent.name": "coder" }, { start_time: 500 }),
    ];

    const { result } = renderHook(() => useAgentPrompt("trace-1", spans, selectionOf()));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listSessionEntryPage).toHaveBeenCalledTimes(1);
    expect(vi.mocked(listSessionEntryPage).mock.calls[0]?.slice(0, 3)).toEqual([
      "trace-1",
      "session-0",
      null,
    ]);
  });

  it("reads every page of the entries", async () => {
    vi.mocked(listSessionEntryPage)
      .mockResolvedValueOnce({ items: ENTRIES.slice(0, 2), next_cursor: "c1" })
      .mockResolvedValueOnce({ items: ENTRIES.slice(2), next_cursor: null });

    const { result } = renderHook(() => useAgentPrompt("trace-1", SPANS, selectionOf()));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listSessionEntryPage).toHaveBeenCalledTimes(2);
    expect(result.current.tasks).toHaveLength(2);
  });

  it("opens an entry of the first session in the conversation", async () => {
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: ENTRIES, next_cursor: null });
    const open = vi.fn();

    const { result } = renderHook(() => useAgentPrompt("trace-1", SPANS, selectionOf(open)));
    await waitFor(() => expect(result.current.loading).toBe(false));
    result.current.openInConversation("work-1");

    expect(open).toHaveBeenCalledWith("session-1", "work-1");
  });

  it("reads no entry and records no prompt for a trace without a prompt span", async () => {
    const spans = SPANS.filter((item) => item.operation !== "agent.prompt");

    const { result } = renderHook(() => useAgentPrompt("trace-1", spans, selectionOf()));

    await waitFor(() => expect(result.current.recorded).toBe(false));
    expect(result.current.loading).toBe(false);
    expect(result.current.agents).toEqual([]);
    expect(result.current.tasks).toEqual([]);
    expect(listSessionEntryPage).not.toHaveBeenCalled();
  });

  it("reports the read failure", async () => {
    const { ApiError } = await import("@/api/errors");
    vi.mocked(listSessionEntryPage).mockRejectedValue(new ApiError("unavailable", "Down.", 503));

    const { result } = renderHook(() => useAgentPrompt("trace-1", SPANS, selectionOf()));

    await waitFor(() => expect(result.current.error?.message).toBe("Down."));
  });
});
