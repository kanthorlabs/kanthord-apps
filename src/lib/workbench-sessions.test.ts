import { describe, expect, it } from "vitest";

import type { WorkbenchSessionListItem } from "@/api/types";
import { sessionsNewestFirst, sessionTitle } from "./workbench-sessions";

function item(id: string, modified: number, patch: Partial<WorkbenchSessionListItem> = {}) {
  return {
    id,
    agent_name: "swe@1",
    name: null,
    created: 0,
    modified,
    message_count: 1,
    first_message: "",
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

describe("sessionTitle", () => {
  it("prefers the name, then the first message, then a fixed label", () => {
    expect(sessionTitle(item("a", 1, { name: "Plan", first_message: "Hello" }))).toBe("Plan");
    expect(sessionTitle(item("a", 1, { first_message: "Hello" }))).toBe("Hello");
    expect(sessionTitle(item("a", 1))).toBe("Empty Session");
  });
});
