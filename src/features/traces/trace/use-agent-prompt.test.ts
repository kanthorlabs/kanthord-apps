import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/tracking", () => ({
  listSessionEntryPage: vi.fn(),
}));
vi.mock("@/api/resources/workers", () => ({
  resolveAgentPrompt: vi.fn(),
}));

import { ApiError } from "@/api/errors";
import { listSessionEntryPage } from "@/api/resources/tracking";
import { resolveAgentPrompt } from "@/api/resources/workers";
import type {
  PromptPart,
  PromptResolveAnswer,
  SpanAttributeValue,
  TraceSessionEntry,
  TraceSpan,
} from "@/api/types";

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

function part(overrides: Partial<PromptPart>): PromptPart {
  return {
    layer: 1,
    part: "standard",
    name: "base.md",
    origin: "binary",
    path: null,
    binding_id: null,
    commit: null,
    digest: "a".repeat(64),
    heading: null,
    state: "resolved",
    text: "Standard.",
    ...overrides,
  };
}

const ANSWER: PromptResolveAnswer = {
  parts: [
    part({}),
    part({
      layer: 2,
      part: "repository",
      name: "apps",
      origin: "database",
      binding_id: "binding-1",
      heading: "Repository prompt of repository apps, set in KanthorD:",
      text: "Rules.",
    }),
  ],
  final: "You are a coder.",
  engine_version: "0.4.0",
};

const ENTRIES = [
  entry("pinned", 1, {
    type: "custom",
    customType: "kanthord.pinned_context",
    data: { part: "system_prompt" },
  }),
  entry("work-1", 2, message("user", "Do task one now")),
  entry("reply-1", 3, message("assistant", "ok")),
  entry("work-2", 4, message("user", "Do two")),
  entry("reply-2", 5, message("assistant", "done")),
];

const SPANS = [
  span("session-1", "agent.session", { "kanthord.agent.name": "coder" }),
  span("prompt", "agent.prompt", { "kanthord.agent.name": "coder" }),
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

function mockReads() {
  vi.mocked(listSessionEntryPage).mockResolvedValue({ items: ENTRIES, next_cursor: null });
  vi.mocked(resolveAgentPrompt).mockResolvedValue(ANSWER);
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("useAgentPrompt", () => {
  it("resolves the prompt of each agent of the execution and lists its parts in reading order", async () => {
    mockReads();

    const { result } = renderHook(() =>
      useAgentPrompt("trace-1", "exec-1", SPANS, selectionOf(), null),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(resolveAgentPrompt).toHaveBeenCalledWith("exec-1", "coder");
    expect(result.current.agents.map((agent) => agent.name)).toEqual(["coder"]);
    expect(result.current.agents[0]?.parts.map((item) => item.key)).toEqual([
      "standard:base.md",
      "repository:apps",
    ]);
    expect(result.current.agents[0]?.engineVersion).toBe("0.4.0");
  });

  it("answers the resolved final text and the pinned marker entry as the system prompt", async () => {
    mockReads();

    const { result } = renderHook(() =>
      useAgentPrompt("trace-1", "exec-1", SPANS, selectionOf(), null),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agents[0]?.systemPrompt).toEqual({
      entryId: "pinned",
      length: 16,
      text: "You are a coder.",
    });
  });

  it("answers no system prompt when the final text does not resolve", async () => {
    mockReads();
    vi.mocked(resolveAgentPrompt).mockResolvedValue({
      ...ANSWER,
      parts: [part({ state: "changed", text: null })],
      final: null,
    });

    const { result } = renderHook(() =>
      useAgentPrompt("trace-1", "exec-1", SPANS, selectionOf(), null),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agents[0]?.systemPrompt).toBeNull();
    expect(result.current.agents[0]?.parts[0]?.state).toBe("changed");
  });

  it("marks each part that differs from the earlier execution", async () => {
    mockReads();
    const diffBase = {
      executionId: "exec-0",
      changed: new Map([["coder", new Set(["repository:apps"])]]),
    };

    const { result } = renderHook(() =>
      useAgentPrompt("trace-1", "exec-1", SPANS, selectionOf(), diffBase),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agents[0]?.parts.map((item) => item.changed)).toEqual([false, true]);
    expect(result.current.agents[0]?.diffExecutionId).toBe("exec-0");
  });

  it("answers the work prompt entry, its length and the template of each task", async () => {
    mockReads();

    const { result } = renderHook(() =>
      useAgentPrompt("trace-1", "exec-1", SPANS, selectionOf(), null),
    );

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

  it("reads every page of the entries of the first session", async () => {
    vi.mocked(resolveAgentPrompt).mockResolvedValue(ANSWER);
    vi.mocked(listSessionEntryPage)
      .mockResolvedValueOnce({ items: ENTRIES.slice(0, 2), next_cursor: "c1" })
      .mockResolvedValueOnce({ items: ENTRIES.slice(2), next_cursor: null });

    const { result } = renderHook(() =>
      useAgentPrompt("trace-1", "exec-1", SPANS, selectionOf(), null),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listSessionEntryPage).toHaveBeenCalledTimes(2);
    expect(vi.mocked(listSessionEntryPage).mock.calls[0]?.slice(0, 3)).toEqual([
      "trace-1",
      "session-1",
      null,
    ]);
    expect(result.current.tasks).toHaveLength(2);
  });

  it("opens an entry of the first session in the conversation", async () => {
    mockReads();
    const open = vi.fn();

    const { result } = renderHook(() =>
      useAgentPrompt("trace-1", "exec-1", SPANS, selectionOf(open), null),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    result.current.openInConversation("work-1");

    expect(open).toHaveBeenCalledWith("session-1", "work-1");
  });

  it("reads nothing for a trace without a prompt span", async () => {
    const spans = SPANS.filter((item) => item.operation !== "agent.prompt");

    const { result } = renderHook(() =>
      useAgentPrompt("trace-1", "exec-1", spans, selectionOf(), null),
    );

    await waitFor(() => expect(result.current.recorded).toBe(false));
    expect(result.current.loading).toBe(false);
    expect(result.current.agents).toEqual([]);
    expect(listSessionEntryPage).not.toHaveBeenCalled();
    expect(resolveAgentPrompt).not.toHaveBeenCalled();
  });

  it("resolves nothing for a trace that names no execution", async () => {
    mockReads();

    const { result } = renderHook(() =>
      useAgentPrompt("trace-1", null, SPANS, selectionOf(), null),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.resolvable).toBe(false);
    expect(result.current.agents).toEqual([]);
    expect(resolveAgentPrompt).not.toHaveBeenCalled();
  });

  it("answers the resolve refusal of one agent on that agent", async () => {
    mockReads();
    vi.mocked(resolveAgentPrompt).mockRejectedValue(
      new ApiError("not_found", "No prompt record.", 404, "agent.prompt.record_absent"),
    );

    const { result } = renderHook(() =>
      useAgentPrompt("trace-1", "exec-1", SPANS, selectionOf(), null),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.agents[0]?.error?.detail).toBe("agent.prompt.record_absent");
    expect(result.current.error).toBeNull();
  });

  it("reports the read failure of the entries", async () => {
    vi.mocked(resolveAgentPrompt).mockResolvedValue(ANSWER);
    vi.mocked(listSessionEntryPage).mockRejectedValue(new ApiError("unavailable", "Down.", 503));

    const { result } = renderHook(() =>
      useAgentPrompt("trace-1", "exec-1", SPANS, selectionOf(), null),
    );

    await waitFor(() => expect(result.current.error?.message).toBe("Down."));
  });
});
