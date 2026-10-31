import { describe, expect, it } from "vitest";

import type { WorkbenchSessionListItem } from "@/api/types";

import { approvalChatPathOf, approvalFactOf, approvalItemsOf } from "./approval-attention";

function session(patch: Partial<WorkbenchSessionListItem> = {}): WorkbenchSessionListItem {
  return {
    id: "workbench_session_A",
    agent_name: "swe@1",
    name: null,
    created: 1,
    modified: 500,
    message_count: 2,
    first_message: "Create the project account-recovery",
    run_active: true,
    pending_approval: { tool_call_id: "call_1", operation_id: "project.create" },
    ...patch,
  };
}

describe("approvalItemsOf", () => {
  it("derives one tool_approval decision for a session that waits for an approval", () => {
    const items = approvalItemsOf([session()]);

    expect(items).toEqual([
      {
        id: "tool_approval:workbench_session_A",
        group: "decisions",
        kind: "tool_approval",
        subject: "Create the project account-recovery",
        at: 500,
        sessionId: "workbench_session_A",
        toolCallId: "call_1",
        agent: "swe@1",
        operationId: "project.create",
      },
    ]);
  });

  it("titles the item with the session name when it has one", () => {
    expect(approvalItemsOf([session({ name: "Recovery flow" })])[0]?.subject).toBe("Recovery flow");
  });

  it("skips a session with no pending approval", () => {
    expect(approvalItemsOf([session({ pending_approval: null })])).toEqual([]);
  });

  it("skips a pending approval of a session whose run ended", () => {
    expect(approvalItemsOf([session({ run_active: false })])).toEqual([]);
  });

  it("derives no item before the sessions are read", () => {
    expect(approvalItemsOf(null)).toEqual([]);
  });

  it("derives one item for each waiting session", () => {
    const items = approvalItemsOf([
      session(),
      session({ id: "workbench_session_B" }),
      session({ id: "workbench_session_C", pending_approval: null }),
    ]);

    expect(items.map((item) => item.sessionId)).toEqual([
      "workbench_session_A",
      "workbench_session_B",
    ]);
  });
});

describe("approval texts", () => {
  it("states the operation as a fact", () => {
    const [item] = approvalItemsOf([session()]);

    expect(item && approvalFactOf(item)).toBe("operation project.create");
  });

  it("opens the chat of the session", () => {
    const [item] = approvalItemsOf([session()]);

    expect(item && approvalChatPathOf(item)).toBe("/workbench/workbench_session_A");
  });
});
