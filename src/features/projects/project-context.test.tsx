import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import * as projectsApi from "@/api/resources/projects";
import type { Project } from "@/api/types";
import { Button } from "@/components/ui/button";

vi.mock("@/api/resources/projects");

import { ProjectProvider, useProject } from "./project-context";

const KANTHORD: Project = {
  id: "project_1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  workspace_directory: "/home/kanthord/.local/state/kanthord/projects/project_1",
};
const BILLING: Project = {
  id: "project_2",
  name: "billing",
  binding_set_version: 1,
  created_at: 2,
  workspace_directory: "/home/kanthord/.local/state/kanthord/projects/project_2",
};

function Probe() {
  const { projects, project, reload } = useProject();
  return (
    <>
      <p>Listed: {projects.length}</p>
      <p>Current: {project?.name ?? "none"}</p>
      <Button onClick={reload}>Reload</Button>
    </>
  );
}

describe("ProjectProvider", () => {
  it("keeps the current project when a reload lists a new project first", async () => {
    vi.mocked(projectsApi.listProjects)
      .mockResolvedValueOnce([KANTHORD])
      .mockResolvedValueOnce([BILLING, KANTHORD]);
    render(
      <ProjectProvider>
        <Probe />
      </ProjectProvider>,
    );

    expect(await screen.findByText("Current: kanthord")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Reload" }));

    expect(await screen.findByText("Listed: 2")).toBeTruthy();
    expect(screen.getByText("Current: kanthord")).toBeTruthy();
  });
});
