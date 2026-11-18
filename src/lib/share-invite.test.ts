import { describe, expect, it } from "vitest";

import type { WorkbenchInvite } from "@/api/types";
import {
  grantSummaryOf,
  groupCheckStateOf,
  lockedProjectsOf,
  projectCountValid,
  projectLabelOf,
  refusedIdsOf,
  withGroupChecked,
  withRefusedIds,
} from "./share-invite";

const INVITE: WorkbenchInvite = {
  id: "invite_1",
  invitee_name: "Dana",
  expires_at: 1790000000000,
  projects: [{ id: "project_a", name: "Alpha" }],
  granted_operations: [],
};

describe("projectCountValid", () => {
  it.each([
    [0, false],
    [1, true],
    [50, true],
    [51, false],
  ])("answers %i projects with %s", (count, valid) => {
    expect(projectCountValid(count)).toBe(valid);
  });
});

describe("projectLabelOf", () => {
  it("names a listed project and falls back to the id", () => {
    const listed = [{ id: "project_a", name: "Alpha" }];

    expect(projectLabelOf(listed, "project_a")).toBe("Alpha");
    expect(projectLabelOf(listed, "project_z")).toBe("project_z");
  });
});

describe("lockedProjectsOf", () => {
  it("returns null when the answer holds no project ids", () => {
    expect(lockedProjectsOf(null, [INVITE])).toBeNull();
  });

  it("takes the set from the ids and the names from the invites", () => {
    expect(lockedProjectsOf(["project_a", "project_b"], [INVITE])).toEqual([
      { id: "project_a", name: "Alpha" },
      { id: "project_b", name: null },
    ]);
  });
});

describe("grant helpers", () => {
  const OPERATIONS = [
    { operation_id: "a", guard_class: "reversible", description: "A" },
    { operation_id: "b", guard_class: "reversible", description: "B" },
  ] as const;

  it("returns no summary for an empty grant", () => {
    expect(grantSummaryOf([])).toBeNull();
  });

  it("counts a grant by guard class and omits an empty class", () => {
    const reversible = { operation_id: "a", guard_class: "reversible" } as const;
    const judged = { operation_id: "c", guard_class: "judged" } as const;

    expect(grantSummaryOf([reversible, reversible, judged])).toBe(
      "Without approval: 2 reversible, 1 judged",
    );
    expect(grantSummaryOf([judged])).toBe("Without approval: 1 judged");
  });

  it("reports none, some and all for a group", () => {
    expect(groupCheckStateOf(OPERATIONS, [])).toBe("none");
    expect(groupCheckStateOf(OPERATIONS, ["a", "x"])).toBe("some");
    expect(groupCheckStateOf(OPERATIONS, ["b", "a"])).toBe("all");
  });

  it("checks and unchecks a group and keeps the other ids", () => {
    expect(withGroupChecked(["x"], OPERATIONS, true)).toEqual(["x", "a", "b"]);
    expect(withGroupChecked(["x", "a", "b"], OPERATIONS, false)).toEqual(["x"]);
  });

  it("appends the refused ids to the line and keeps the code", () => {
    expect(withRefusedIds({ code: "c", message: "No." }, ["a", "b"])).toEqual({
      code: "c",
      message: "No. Refused: a, b.",
    });
    expect(withRefusedIds({ code: "c", message: "No." }, undefined)).toEqual({
      code: "c",
      message: "No.",
    });
    expect(refusedIdsOf([1, "a"])).toEqual(["a"]);
  });
});
