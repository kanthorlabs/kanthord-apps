import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/tracking", () => ({
  listSessionEntryPage: vi.fn(),
  readSessionEntry: vi.fn(),
  readTraceText: vi.fn(),
}));

import { listSessionEntryPage, readSessionEntry } from "@/api/resources/tracking";
import type { TraceSessionEntry, TraceSpan } from "@/api/types";

import { useSpanDetail } from "./use-span-detail";

function span(
  spanId: string,
  operation: string,
  parent: string | null,
  attributes: TraceSpan["attributes"],
): TraceSpan {
  return {
    trace_id: "trace-1",
    span_id: spanId,
    parent_span_id: parent,
    producer: "worker",
    origin: "observed",
    operation,
    start_time: 0,
    end_time: null,
    status: "Unset",
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: 0,
  };
}

function assistantEntry(entryId: string, command: string): TraceSessionEntry {
  return {
    trace_id: "trace-1",
    session_id: "session",
    entry_id: entryId,
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

const TURN = span("turn", "agent.turn", null, {
  "gen_ai.conversation.id": "session",
  "kanthord.session.entry_id": "turn-entry",
});

function tool(attributes: TraceSpan["attributes"]): TraceSpan {
  return span("tool", "agent.tool", "turn", {
    "gen_ai.conversation.id": "session",
    "gen_ai.tool.call.id": "call-1",
    ...attributes,
  });
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("useSpanDetail tool arguments", () => {
  it("reads the arguments from the entry that the tool span names", async () => {
    vi.mocked(readSessionEntry).mockResolvedValue(assistantEntry("tool-entry", "ls"));
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: [], next_cursor: null });
    const own = tool({ "kanthord.session.entry_id": "tool-entry" });

    const { result } = renderHook(() => useSpanDetail("trace-1", own, [TURN, own]));

    await waitFor(() => expect(result.current.toolArguments?.status).toBe("ready"));
    expect(readSessionEntry).toHaveBeenCalledWith("trace-1", "session", "tool-entry");
    expect(readSessionEntry).not.toHaveBeenCalledWith("trace-1", "session", "turn-entry");
  });

  it("reads the arguments through the turn when the tool span names no entry", async () => {
    vi.mocked(readSessionEntry).mockResolvedValue(assistantEntry("turn-entry", "ls"));
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: [], next_cursor: null });
    const bare = tool({});

    const { result } = renderHook(() => useSpanDetail("trace-1", bare, [TURN, bare]));

    await waitFor(() => expect(result.current.toolArguments?.status).toBe("ready"));
    expect(readSessionEntry).toHaveBeenCalledWith("trace-1", "session", "turn-entry");
  });
});
