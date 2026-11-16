import { describe, expect, it } from "vitest";

import type { WorkbenchSessionListItem } from "@/api/types";
import { sessionsNewestFirst, sessionTitle } from "./workbench-sessions";

function item(id: string, modified: number, patch: Partial<WorkbenchSessionListItem> = {}) {
  return {
    id,
    host_session_id: null,
    agent_name: "swe@1",
    display_name: "SWE",
    name: null,
    created: 0,
    modified,
    message_count: 1,
    first_message: "",
    run_active: false,
    forked_from: null,
    pending_approval: null,
    participants: [],
    ...patch,
  };
}

describe("sessionsNewestFirst", () => {
  it("orders by modified, newest first, without changing the input", () => {
    const input = [item("a", 1), item("c", 3), item("b", 2)];

    expect(sessionsNewestFirst(input).map((entry) => entry.id)).toEqual(["c", "b", "a"]);
    expect(input.map((entry) => entry.id)).toEqual(["a", "c", "b"]);
  });
});

describe("sessionsNewestFirst with participants", () => {
  it("orders hosts by their modified and keeps the nested participants", () => {
    const guest = item("guest", 9, {
      host_session_id: "a",
      display_name: "RE",
      agent_name: "re@1",
    });
    const input = [item("a", 5, { participants: [guest] }), item("b", 7)];

    const sorted = sessionsNewestFirst(input);

    expect(sorted.map((entry) => entry.id)).toEqual(["b", "a"]);
    expect(sorted[1]?.participants).toEqual([guest]);
  });
});

describe("sessionTitle", () => {
  it("prefers the name, then the first message, then a fixed label", () => {
    expect(sessionTitle(item("a", 1, { name: "Plan", first_message: "Hello" }))).toBe("Plan");
    expect(sessionTitle(item("a", 1, { first_message: "Hello" }))).toBe("Hello");
    expect(sessionTitle(item("a", 1))).toBe("Empty Session");
    expect(sessionTitle(item("a", 1, { message_count: 1, first_message: "" }))).toBe(
      "Empty Session",
    );
  });
});
