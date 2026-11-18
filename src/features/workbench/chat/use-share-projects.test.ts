import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useShareProjects } from "./use-share-projects";

const LISTED = [
  { id: "project_b", name: "Beta" },
  { id: "project_a", name: "Alpha" },
];

describe("useShareProjects", () => {
  it("returns the listed ids and labels an id by its project name", () => {
    const { result } = renderHook(() => useShareProjects(LISTED, null));

    expect(result.current.projectIds).toEqual(["project_b", "project_a"]);
    expect(result.current.lockedIds).toBeNull();
    expect(result.current.labelOf("project_a")).toBe("Alpha");
    expect(result.current.labelOf("project_x")).toBe("project_x");
  });

  it("returns no id before the projects load", () => {
    const { result } = renderHook(() => useShareProjects(null, null));

    expect(result.current.projectIds).toEqual([]);
  });

  it("returns the ids of the locked projects", () => {
    const { result } = renderHook(() =>
      useShareProjects(null, [
        { id: "project_a", name: "Alpha" },
        { id: "project_x", name: null },
      ]),
    );

    expect(result.current.lockedIds).toEqual(["project_a", "project_x"]);
  });
});
