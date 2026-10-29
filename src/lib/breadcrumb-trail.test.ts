import { describe, expect, it } from "vitest";

import { breadcrumbTrail, crumbHref } from "./breadcrumb-trail";

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

  it("names the instances segment of a worker", () => {
    expect(breadcrumbTrail("/workers/coder%401/instances/mac-studio", labelOf)).toEqual([
      { path: "/workers", label: "workers" },
      { path: "/workers/coder%401", label: "coder@1" },
      { path: "/workers/coder%401/instances", label: "Instances" },
      { path: "/workers/coder%401/instances/mac-studio", label: "mac-studio" },
    ]);
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

describe("crumbHref", () => {
  it("keeps the project of the search", () => {
    expect(crumbHref("/workers/coder%401", "?project=prj%20b&tab=x")).toBe(
      "/workers/coder%401?project=prj%20b",
    );
  });

  it("adds no query without a project", () => {
    expect(crumbHref("/workers", "")).toBe("/workers");
    expect(crumbHref("/workers", "?tab=x")).toBe("/workers");
    expect(crumbHref("/workers", "?project=")).toBe("/workers");
  });
});
