import { describe, expect, it } from "vitest";

import type { WorkbenchInvite } from "@/api/types";
import { lockedProjectsOf, projectCountValid, projectLabelOf } from "./share-invite";

const INVITE: WorkbenchInvite = {
  id: "invite_1",
  invitee_name: "Dana",
  expires_at: 1790000000000,
  projects: [{ id: "project_a", name: "Alpha" }],
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
