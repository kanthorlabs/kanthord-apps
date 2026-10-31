import { describe, expect, it } from "vitest";

import type { Project } from "@/api/types";

import { filterMessageOf, filterNameOf, pickedProjectIdOf, projectNameOf } from "./board-filter";
import { BOARD_TABS } from "./board-tabs";

const ATLAS: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};
const BETA: Project = { ...ATLAS, id: "prj-2", name: "beta" };
const PROJECTS = [ATLAS, BETA];

describe("projectNameOf", () => {
  it("returns the name of the project", () => {
    expect(projectNameOf(PROJECTS, "prj-2")).toBe("beta");
  });

  it("returns null for no project or an unknown project", () => {
    expect(projectNameOf(PROJECTS, null)).toBeNull();
    expect(projectNameOf(PROJECTS, "prj-9")).toBeNull();
  });
});

describe("filterNameOf", () => {
  it("returns the name of the picked project", () => {
    expect(filterNameOf(PROJECTS, "prj-1")).toBe("atlas");
  });

  it("names all projects when no project is picked", () => {
    expect(filterNameOf(PROJECTS, null)).toBe("All projects");
  });
});

describe("pickedProjectIdOf", () => {
  it("returns the id of the project that the value names", () => {
    expect(pickedProjectIdOf(PROJECTS, "prj-2")).toBe("prj-2");
  });

  it("returns null for the all value and for no value", () => {
    expect(pickedProjectIdOf(PROJECTS, "all")).toBeNull();
    expect(pickedProjectIdOf(PROJECTS, undefined)).toBeNull();
  });
});

describe("filterMessageOf", () => {
  it("counts the acts of the tab and of all tabs", () => {
    const [tab] = BOARD_TABS;
    if (tab === undefined) throw new Error("No tab.");
    expect(filterMessageOf("atlas", tab, 1, 3)).toBe(
      `atlas: 1 act in ${tab.name}, 3 acts in all tabs.`,
    );
  });
});
