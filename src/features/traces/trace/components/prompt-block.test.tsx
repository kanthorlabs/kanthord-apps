import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/tracking", () => ({
  listSessionEntryPage: vi.fn(),
}));

import { listSessionEntryPage } from "@/api/resources/tracking";
import type { SpanAttributeValue, TraceSessionEntry, TraceSpan } from "@/api/types";

import type { TraceSelection } from "../use-trace-selection";
import { PromptBlock } from "./prompt-block";

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

const ENTRIES = [
  entry("pinned", 1, {
    type: "custom",
    customType: "kanthord.pinned_context",
    data: { part: "system_prompt", text: "You are a coder." },
  }),
  entry("work-1", 2, message("user", "Do task one now")),
  entry("reply-1", 3, message("assistant", "ok")),
];

const SPANS = [
  span("session-1", "agent.session", { "kanthord.agent.name": "coder" }),
  span("prompt", "agent.prompt", {
    "kanthord.agent.name": "coder",
    "kanthord.prompt.parts": ["system:coder:a1", "rules:style:b2"],
  }),
  span("task-1", "worker.task", { "kanthord.task.id": "T1" }),
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
];

function selectionOf(openInConversation = vi.fn()): TraceSelection {
  return { openInConversation } as unknown as TraceSelection;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("PromptBlock", () => {
  it("shows the system prompt, the layers and the work prompt of each task", async () => {
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: ENTRIES, next_cursor: null });

    render(<PromptBlock traceId="trace-1" spans={SPANS} selection={selectionOf()} />);

    expect(await screen.findByText("System prompt 16 chars")).toBeInTheDocument();
    expect(screen.getByText("system coder")).toBeInTheDocument();
    expect(screen.getByText("rules style")).toBeInTheDocument();
    expect(screen.getByText("Work prompt T1 15 chars")).toBeInTheDocument();
    expect(screen.getByText("Template work")).toBeInTheDocument();
  });

  it("shows and hides the work prompt text", async () => {
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: ENTRIES, next_cursor: null });
    const user = userEvent.setup();
    render(<PromptBlock traceId="trace-1" spans={SPANS} selection={selectionOf()} />);
    const group = await screen.findByRole("list", { name: "Work prompts" });

    await user.click(within(group).getByRole("button", { name: "Show" }));

    expect(await within(group).findByText("Do task one now")).toBeInTheDocument();
    await user.click(within(group).getByRole("button", { name: "Hide" }));
    await waitFor(() => expect(within(group).queryByText("Do task one now")).toBeNull());
  });

  it("opens the work prompt in the conversation", async () => {
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: ENTRIES, next_cursor: null });
    const open = vi.fn();
    const user = userEvent.setup();
    render(<PromptBlock traceId="trace-1" spans={SPANS} selection={selectionOf(open)} />);
    const group = await screen.findByRole("list", { name: "Work prompts" });

    await user.click(within(group).getByRole("button", { name: "Open in conversation" }));

    expect(open).toHaveBeenCalledWith("session-1", "work-1");
  });

  it("says that the trace has no prompt record", () => {
    const spans = SPANS.filter((item) => item.operation !== "agent.prompt");

    render(<PromptBlock traceId="trace-1" spans={spans} selection={selectionOf()} />);

    expect(screen.getByText("No prompt record for this trace.")).toBeInTheDocument();
  });
});
