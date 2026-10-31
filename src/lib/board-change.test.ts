import { describe, expect, it } from "vitest";

import type { WorkbenchPendingApproval } from "@/api/types";

import { changeAskedOf } from "./board-change";

const PENDING: WorkbenchPendingApproval = {
  tool_call_id: "c1",
  operation_id: "project.create",
  input: { name: "alpha", labels: ["a", "b"], retries: 3, nested: { deep: true } },
};

describe("changeAskedOf", () => {
  it("answers the operation id", () => {
    expect(changeAskedOf(PENDING)?.operationId).toBe("project.create");
  });

  it("answers one row for each input field, in input order", () => {
    expect(changeAskedOf(PENDING)?.rows.map((row) => row.label)).toEqual([
      "name becomes",
      "labels becomes",
      "retries becomes",
      "nested becomes",
    ]);
  });

  it("shows a string value as text", () => {
    expect(changeAskedOf(PENDING)?.rows[0]).toMatchObject({
      field: "name",
      text: "alpha",
      json: false,
    });
  });

  it("shows any other value as JSON", () => {
    const rows = changeAskedOf(PENDING)?.rows ?? [];

    expect(rows[1]).toMatchObject({ text: '[\n  "a",\n  "b"\n]', json: true });
    expect(rows[2]).toMatchObject({ text: "3", json: true });
    expect(rows[3]).toMatchObject({ text: '{\n  "deep": true\n}', json: true });
  });

  it("answers no rows for an empty input", () => {
    expect(changeAskedOf({ ...PENDING, input: {} })?.rows).toEqual([]);
  });

  it("answers null when no call waits", () => {
    expect(changeAskedOf(null)).toBeNull();
  });
});
