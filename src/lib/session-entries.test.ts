import { describe, expect, it } from "vitest";

import type { TraceSessionEntry } from "@/api/types";

import { entryView, toolCallIn } from "./session-entries";

function entry(type: string, raw: Record<string, unknown>): TraceSessionEntry {
  return {
    trace_id: "trace_1",
    session_id: "session_1",
    entry_id: "entry_1",
    parent_entry_id: null,
    sequence: 1,
    entry_type: type,
    entry_time: 1,
    tool_call_id: null,
    truncated: false,
    entry: raw,
    created_at: 1,
  };
}

function message(raw: Record<string, unknown>): TraceSessionEntry {
  return entry("message", { type: "message", message: raw });
}

describe("entryView", () => {
  it("reads a user message with string content", () => {
    expect(entryView(message({ role: "user", content: "hello" }))).toEqual({
      kind: "user",
      text: "hello",
    });
  });

  it("joins the text parts of a user message", () => {
    const view = entryView(
      message({
        role: "user",
        content: [
          { type: "text", text: "one" },
          { type: "image", data: "x" },
          { type: "text", text: "two" },
        ],
      }),
    );
    expect(view).toEqual({ kind: "user", text: "one\ntwo" });
  });

  it("reads an assistant message with text, thinking, two tool calls and usage", () => {
    const view = entryView(
      message({
        role: "assistant",
        model: "model-x",
        content: [
          { type: "thinking", thinking: "plan" },
          { type: "text", text: "doing" },
          { type: "toolCall", id: "c1", name: "bash", arguments: { cmd: "ls" } },
          { type: "toolCall", id: "c2", name: "read", arguments: { path: "a" } },
        ],
        usage: { input: 100, cacheRead: 50, cacheWrite: 10, output: 20, cost: { total: 0.02 } },
      }),
    );
    expect(view).toEqual({
      kind: "assistant",
      text: "doing",
      thinking: ["plan"],
      toolCalls: [
        { id: "c1", name: "bash", arguments: { cmd: "ls" } },
        { id: "c2", name: "read", arguments: { path: "a" } },
      ],
      model: "model-x",
      inputTokens: 160,
      outputTokens: 20,
      costUsd: 0.02,
    });
  });

  it("gives null for the usage numbers of an assistant message without usage", () => {
    const view = entryView(message({ role: "assistant", content: [] }));
    expect(view).toEqual({
      kind: "assistant",
      text: "",
      thinking: [],
      toolCalls: [],
      model: null,
      inputTokens: null,
      outputTokens: null,
      costUsd: null,
    });
  });

  it("reads a tool result with isError", () => {
    const view = entryView(
      message({
        role: "toolResult",
        toolCallId: "c1",
        toolName: "bash",
        isError: true,
        content: [{ type: "text", text: "boom\nstack line" }],
      }),
    );
    expect(view).toEqual({
      kind: "tool_result",
      toolCallId: "c1",
      toolName: "bash",
      isError: true,
      text: "boom\nstack line",
      firstLine: "boom",
    });
  });

  it("reads a tool result that is not an error", () => {
    const view = entryView(
      message({ role: "toolResult", toolCallId: "c1", toolName: "bash", content: [] }),
    );
    expect(view).toMatchObject({ kind: "tool_result", isError: false, text: "", firstLine: "" });
  });

  it("reads a system message with two sections", () => {
    const view = entryView(
      message({
        role: "system",
        content: "base",
        sections: { Rules: "be brief", Tools: "bash", Empty: null },
      }),
    );
    expect(view).toEqual({
      kind: "system",
      source: "pi",
      text: "base",
      sections: [
        { name: "Rules", text: "be brief" },
        { name: "Tools", text: "bash" },
      ],
    });
  });

  it("reads a pinned system prompt as system", () => {
    const view = entryView(
      entry("custom", {
        type: "custom",
        customType: "kanthord.pinned_context",
        data: { part: "system_prompt", text: "You are an agent." },
      }),
    );
    expect(view).toEqual({
      kind: "system",
      source: "pinned",
      text: "",
      sections: [{ name: "System prompt", text: "You are an agent." }],
    });
  });

  it("maps compaction, model change and thinking level change", () => {
    expect(entryView(entry("compaction", { type: "compaction" }))).toEqual({ kind: "compaction" });
    expect(entryView(entry("model_change", { type: "model_change", modelId: "m2" }))).toEqual({
      kind: "model_change",
      model: "m2",
    });
    expect(entryView(entry("model_change", { type: "model_change" }))).toEqual({
      kind: "model_change",
      model: null,
    });
    expect(
      entryView(
        entry("thinking_level_change", { type: "thinking_level_change", thinkingLevel: "high" }),
      ),
    ).toEqual({ kind: "thinking_level_change", level: "high" });
  });

  it.each([
    ["an unknown type", entry("session", { type: "session" })],
    ["an empty entry", entry("message", {})],
    ["a message without a role", message({ content: "x" })],
    ["a message with an unknown role", message({ role: "robot", content: "x" })],
    ["a user message without content", message({ role: "user" })],
    ["a message that is a string", entry("message", { type: "message", message: "text" })],
    ["a custom entry of another type", entry("custom", { type: "custom", customType: "other" })],
    [
      "a pinned entry with an unknown part",
      entry("custom", {
        type: "custom",
        customType: "kanthord.pinned_context",
        data: { part: "x", text: "t" },
      }),
    ],
    [
      "a pinned entry without data",
      entry("custom", { type: "custom", customType: "kanthord.pinned_context" }),
    ],
  ])("maps %s to other with the entry type", (_name, input) => {
    expect(entryView(input)).toEqual({ kind: "other", type: input.entry_type });
  });
});

describe("toolCallIn", () => {
  const assistant = entryView(
    message({
      role: "assistant",
      content: [
        { type: "toolCall", id: "c1", name: "bash", arguments: { cmd: "ls" } },
        { type: "toolCall", id: "c2", name: "read", arguments: {} },
      ],
    }),
  );

  it("answers the tool call with the identity", () => {
    expect(toolCallIn(assistant, "c2")).toEqual({ id: "c2", name: "read", arguments: {} });
  });

  it("answers null for an unknown identity", () => {
    expect(toolCallIn(assistant, "c9")).toBeNull();
  });

  it("answers null for a view that is not an assistant view", () => {
    expect(toolCallIn({ kind: "user", text: "hi" }, "c1")).toBeNull();
  });
});
