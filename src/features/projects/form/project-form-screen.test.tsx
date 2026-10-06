import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as projectsApi from "@/api/resources/projects";
import type { Project } from "@/api/types";

vi.mock("@/api/resources/projects");

const reloadProjects = vi.fn();
vi.mock("@/features/projects/project-context", () => ({
  useProject: () => ({ reload: reloadProjects }),
}));

import { ProjectFormScreen } from "./project-form-screen";

const KANTHORD: Project = {
  id: "project_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
  name: "kanthord",
  bindingSetVersion: 3,
  createdAt: 1,
  workspaceDirectory:
    "/home/kanthord/.local/state/kanthord/projects/project_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
};

function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects/new" element={<ProjectFormScreen />} />
        <Route path="/projects/:projectId/edit" element={<ProjectFormScreen />} />
        <Route path="/projects/:projectId" element={<p>Project view</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectFormScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a project and opens it", async () => {
    vi.mocked(projectsApi.createProject).mockResolvedValue(KANTHORD);
    mount("/projects/new");

    await userEvent.type(await screen.findByLabelText("Name"), "kanthord");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByText("Project view")).toBeTruthy();
    expect(projectsApi.createProject).toHaveBeenCalledWith("kanthord");
    expect(reloadProjects).toHaveBeenCalledOnce();
  });

  it("refuses a name outside the contract pattern before the call", async () => {
    mount("/projects/new");

    await userEvent.type(await screen.findByLabelText("Name"), "Kanthord");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(
      screen.getByText(
        "Start with a lowercase letter. Use only lowercase letters, digits and hyphens.",
      ),
    ).toBeTruthy();
    expect(projectsApi.createProject).not.toHaveBeenCalled();
  });

  it("reports the refusal of the daemon", async () => {
    vi.mocked(projectsApi.createProject).mockRejectedValue(
      new ApiError("conflict", "Another project already uses the requested name.", 409),
    );
    mount("/projects/new");

    await userEvent.type(await screen.findByLabelText("Name"), "kanthord");
    await userEvent.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByText("The project was not created.")).toBeTruthy();
    expect(screen.getByText("Another project already uses the requested name.")).toBeTruthy();
    expect(reloadProjects).not.toHaveBeenCalled();
  });

  it("edits a project from its current values", async () => {
    vi.mocked(projectsApi.readProject).mockResolvedValue(KANTHORD);
    vi.mocked(projectsApi.renameProject).mockResolvedValue({ ...KANTHORD, name: "daemon" });
    mount(`/projects/${KANTHORD.id}/edit`);

    const input = await screen.findByLabelText("Name");
    expect(input).toHaveValue("kanthord");
    await userEvent.clear(input);
    await userEvent.type(input, "daemon");
    await userEvent.click(screen.getByRole("button", { name: "Save project" }));

    expect(await screen.findByText("Project view")).toBeTruthy();
    expect(projectsApi.renameProject).toHaveBeenCalledWith(KANTHORD.id, "daemon");
  });
});
