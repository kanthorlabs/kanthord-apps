import { describe, expect, it } from "vitest";

import type { WorkbenchSessionListItem } from "@/api/types";

import { scopeRequestChatPathOf, scopeRequestItemsOf } from "./scope-request-attention";

function listItem(id: string, patch: Partial<WorkbenchSessionListItem>): WorkbenchSessionListItem {
  return {
    id,
    host_session_id: null,
    agent_name: "swe@1",
    display_name: "SWE",
    name: "Account recovery",
    created: 1,
    modified: 500,
    message_count: 2,
    first_message: "Start",
    run_active: false,
    forked_from: null,
    pending_approval: null,
    scope_requests: 0,
    participants: [],
    ...patch,
  };
}

describe("scopeRequestItemsOf", () => {
  it("builds one item per conversation with open requests", () => {
    const items = scopeRequestItemsOf([
      listItem("session_a", { scope_requests: 2 }),
      listItem("session_b", { scope_requests: 0 }),
    ]);

    expect(items).toEqual([
      {
        id: "scope_request:session_a",
        group: "decisions",
        kind: "scope_request",
        subject: "Account recovery",
        at: 500,
        sessionId: "session_a",
        count: 2,
      },
    ]);
    expect(scopeRequestChatPathOf(items[0]!)).toBe("/workbench/session_a");
  });

  it("builds nothing for no list", () => {
    expect(scopeRequestItemsOf(null)).toEqual([]);
  });
});
