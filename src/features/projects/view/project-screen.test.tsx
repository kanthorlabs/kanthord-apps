import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import type { Project } from "@/api/types";

vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/mission");

import { ProjectScreen } from "./project-screen";

const KANTHORD: Project = {
  id: "project_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
  name: "kanthord",
  binding_set_version: 3,
  created_at: Date.UTC(2026, 9, 3, 14, 5),
  workspace_directory:
    "/home/kanthord/.local/state/kanthord/projects/project_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
};

function mount(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/projects/${KANTHORD.id}${search}`]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProjectScreen", () => {
  beforeEach(() => {
    vi.mocked(missionApi.readMission).mockResolvedValue({
      id: "mission_1",
      project_id: KANTHORD.id,
      version: 1,
    });
    vi.mocked(projectsApi.listBindings).mockResolvedValue([]);
  });

  it("shows the information of the project in the path", async () => {
    vi.mocked(projectsApi.readProject).mockResolvedValue(KANTHORD);
    mount();

    expect(await screen.findByRole("heading", { name: "kanthord" })).toBeTruthy();
    expect(projectsApi.readProject).toHaveBeenCalledWith(KANTHORD.id);
    expect(screen.getByText(KANTHORD.id)).toBeTruthy();
    expect(screen.getByText("Workspace Directory")).toBeTruthy();
    expect(screen.getByText(KANTHORD.workspace_directory).className).toContain("font-mono");
    expect(screen.queryByText("Binding set version")).toBeNull();
    expect(screen.getByText("2026-10-03 14:05 UTC")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute(
      "href",
      `/projects/${KANTHORD.id}/edit`,
    );
  });

  it("reloads the project after a binding save", async () => {
    vi.mocked(projectsApi.readProject)
      .mockResolvedValueOnce(KANTHORD)
      .mockResolvedValue({ ...KANTHORD, binding_set_version: 4 });
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({
      version: 3,
      bindings: {
        "general-main": { kind: "worker", config: { worker: "general@1", instance_count: 2 } },
      },
    });
    vi.mocked(projectsApi.writeBindingSet).mockResolvedValue({
      project_id: KANTHORD.id,
      binding_set_version: 4,
      changes: [],
    });
    mount("?tab=bindings");

    await userEvent.click(await screen.findByRole("button", { name: "Edit general-main" }));
    const readsBeforeSave = vi.mocked(projectsApi.readProject).mock.calls.length;
    await userEvent.click(screen.getByRole("button", { name: "Save binding" }));

    await waitFor(() => expect(projectsApi.readProject).toHaveBeenCalledTimes(readsBeforeSave + 1));
  });

  it("reports an unknown project", async () => {
    vi.mocked(projectsApi.readProject).mockRejectedValue(
      new ApiError("not_found", "The project identity does not exist.", 404),
    );
    mount();

    expect(await screen.findByText("The project identity does not exist.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
  });

  it("opens the tab that the link names and switches tabs", async () => {
    vi.mocked(projectsApi.readProject).mockResolvedValue(KANTHORD);
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({ version: 1, bindings: {} });
    mount("?tab=bindings");

    expect(await screen.findByRole("tab", { name: "Bindings", selected: true })).toBeTruthy();
    expect(await screen.findByText("No repositories binding.")).toBeTruthy();

    await userEvent.click(screen.getByRole("tab", { name: "Mission" }));
    expect(screen.getByRole("tab", { name: "Mission", selected: true })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Mission graph" })).toBeTruthy();
  });
});
