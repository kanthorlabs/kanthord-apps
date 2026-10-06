import { describe, expect, it } from "vitest";

import { breadcrumbTrail } from "./breadcrumb-trail";

const LABELS: Readonly<Record<string, string>> = {
  "/": "Overview",
  "/projects": "Projects",
  "/projects/project_1": "kanthord",
};

const labelOf = (path: string) => LABELS[path];

describe("breadcrumbTrail", () => {
  it("names the root", () => {
    expect(breadcrumbTrail("/", labelOf)).toEqual([{ path: "/", label: "Overview" }]);
  });

  it("builds one crumb per segment with the registered labels", () => {
    expect(breadcrumbTrail("/projects/project_1/edit", labelOf)).toEqual([
      { path: "/projects", label: "Projects" },
      { path: "/projects/project_1", label: "kanthord" },
      { path: "/projects/project_1/edit", label: "Edit" },
    ]);
  });

  it("names a new page and decodes an unregistered segment", () => {
    expect(breadcrumbTrail("/projects/new", labelOf).at(-1)?.label).toBe("New");
    expect(breadcrumbTrail("/agents/swe%401", labelOf).at(-1)?.label).toBe("swe@1");
  });

  it("names the workbench of an agent", () => {
    expect(breadcrumbTrail("/agents/swe%401/workbench", labelOf)).toEqual([
      { path: "/agents", label: "agents" },
      { path: "/agents/swe%401", label: "swe@1" },
      { path: "/agents/swe%401/workbench", label: "Workbench" },
    ]);
  });

  it("keeps a segment that does not decode", () => {
    expect(breadcrumbTrail("/agents/%E0", labelOf).at(-1)?.label).toBe("%E0");
  });
});
