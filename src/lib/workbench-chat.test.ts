import { describe, expect, it } from "vitest";

import type { WorkbenchRunSnapshot, WorkbenchSessionEntry } from "@/api/types";
import { agentWorking, chatItemsOf, summaryOf } from "./workbench-chat";

const IDLE: WorkbenchRunSnapshot = {
  streaming_message: null,
  pending_tool_calls: [],
  pending_approval: null,
  run_active: false,
  error_message: null,
};

function message(id: string, body: Record<string, unknown>): WorkbenchSessionEntry {
  return {
    type: "message",
    id,
    parentId: null,
    timestamp: "2026-10-05T09:00:00.000Z",
    message: body,
  };
}

const CALL = { type: "toolCall", id: "call_1", name: "mission.node.list", arguments: { a: 1 } };

describe("chatItemsOf", () => {
  it("keeps user, assistant, tool call and tool result entries in order", () => {
    const items = chatItemsOf(
      [
        message("e1", { role: "user", content: "List the objectives" }),
        message("e2", { role: "assistant", content: [{ type: "text", text: "Reading." }, CALL] }),
        message("e3", {
          role: "toolResult",
          toolCallId: "call_1",
          toolName: "mission.node.list",
          isError: true,
          content: [{ type: "text", text: "refused" }],
        }),
      ],
      IDLE,
    );

    expect(items).toEqual([
      { kind: "user", id: "e1", text: "List the objectives" },
      { kind: "assistant", id: "e2", text: "Reading.", streaming: false },
      {
        kind: "tool-call",
        id: "e2:call_1",
        name: "mission.node.list",
        input: JSON.stringify({ a: 1 }, null, 2),
        state: "done",
      },
      { kind: "tool-result", id: "e3", name: "mission.node.list", text: "refused", isError: true },
    ]);
  });

  it("skips the entries that are no message and the thinking blocks", () => {
    const items = chatItemsOf(
      [
        { type: "model_change", id: "e0", parentId: null, timestamp: "t" },
        message("e1", { role: "assistant", content: [{ type: "thinking", thinking: "hmm" }] }),
      ],
      IDLE,
    );

    expect(items).toEqual([]);
  });

  it("marks a pending tool call as running and the approval call as awaiting approval", () => {
    const entries = [
      message("e2", {
        role: "assistant",
        content: [CALL, { ...CALL, id: "call_2", name: "project.create" }],
      }),
    ];

    const items = chatItemsOf(entries, {
      ...IDLE,
      run_active: true,
      pending_tool_calls: ["call_1"],
      pending_approval: { tool_call_id: "call_2", operation_id: "project.create", input: {} },
    });

    expect(items.map((item) => item.kind === "tool-call" && item.state)).toEqual([
      "running",
      "awaiting-approval",
    ]);
  });

  it("appends the streaming partial message after the entries", () => {
    const items = chatItemsOf([message("e1", { role: "user", content: "Hi" })], {
      ...IDLE,
      run_active: true,
      streaming_message: { role: "assistant", content: [{ type: "text", text: "Hel" }] },
    });

    expect(items.at(-1)).toEqual({
      kind: "assistant",
      id: "streaming",
      text: "Hel",
      streaming: true,
    });
  });
});

describe("summaryOf", () => {
  it("collapses whitespace and cuts a long text", () => {
    expect(summaryOf("a\n  b")).toBe("a b");
    expect(summaryOf("x".repeat(100))).toBe(`${"x".repeat(80)}…`);
  });
});

describe("agentWorking", () => {
  const user = { kind: "user", id: "e1", text: "Hi" } as const;
  const streamed = { kind: "assistant", id: "s", text: "Hel", streaming: true } as const;

  it("shows the agent at work while a run is active and no text streams", () => {
    expect(agentWorking([user], { ...IDLE, run_active: true })).toBe(true);
  });

  it("hides it while text streams, while an approval waits and when no run is active", () => {
    expect(agentWorking([user, streamed], { ...IDLE, run_active: true })).toBe(false);
    expect(
      agentWorking([user], {
        ...IDLE,
        run_active: true,
        pending_approval: { tool_call_id: "c1", operation_id: "o", input: {} },
      }),
    ).toBe(false);
    expect(agentWorking([user], IDLE)).toBe(false);
  });
});
