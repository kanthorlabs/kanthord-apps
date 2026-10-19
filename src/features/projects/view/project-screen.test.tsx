import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import * as workersApi from "@/api/resources/workers";
import type { Project } from "@/api/types";

vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/workers");

import { ProjectScreen } from "./project-screen";

const KANTHORD: Project = {
  id: "project_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
  name: "kanthord",
  binding_set_version: 3,
  created_at: Date.UTC(2026, 9, 3, 14, 5),
  paused_at: null,
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
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({ version: 1, bindings: {} });
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([]);
    vi.mocked(missionApi.listMissionNodes).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerInstances).mockResolvedValue([]);
    vi.mocked(workersApi.listAgents).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([]);
  });

  it("shows the readiness of a new project with a link to each step", async () => {
    vi.mocked(projectsApi.readProject).mockResolvedValue(KANTHORD);
    mount();

    const panel = await screen.findByRole("region", { name: "Readiness" });
    const repository = await within(panel).findByRole("listitem", { name: "Repository binding" });
    expect(within(repository).getByText("Open")).toBeTruthy();
    expect(within(repository).getByRole("button", { name: "Open bindings" })).toHaveAttribute(
      "href",
      `/projects/${KANTHORD.id}?tab=bindings`,
    );
    expect(
      within(within(panel).getByRole("listitem", { name: "Project active" })).getByText("Done"),
    ).toBeTruthy();
    expect(
      within(within(panel).getByRole("listitem", { name: "Plan import" })).getByRole("button", {
        name: "Open mission",
      }),
    ).toHaveAttribute("href", `/projects/${KANTHORD.id}`);
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

  it("shows an active project with the Pause button and no Paused badge", async () => {
    vi.mocked(projectsApi.readProject).mockResolvedValue(KANTHORD);
    mount();

    expect(await screen.findByRole("button", { name: "Pause" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resume" })).toBeNull();
    expect(screen.queryByText("Paused")).toBeNull();
  });

  it("shows a paused project with the Paused badge, its time and the Resume button", async () => {
    vi.mocked(projectsApi.readProject).mockResolvedValue({
      ...KANTHORD,
      paused_at: Date.UTC(2026, 9, 4, 8, 30),
    });
    mount();

    expect(await screen.findByText("Paused")).toBeTruthy();
    expect(screen.getByText("2026-10-04 08:30 UTC")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pause" })).toBeNull();
  });

  it("pauses the project without a confirmation and reloads it", async () => {
    const paused = { ...KANTHORD, paused_at: Date.UTC(2026, 9, 4, 8, 30) };
    vi.mocked(projectsApi.readProject).mockResolvedValueOnce(KANTHORD).mockResolvedValue(paused);
    vi.mocked(projectsApi.pauseProject).mockResolvedValue(paused);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Pause" }));

    expect(projectsApi.pauseProject).toHaveBeenCalledWith(KANTHORD.id);
    expect(await screen.findByRole("button", { name: "Resume" })).toBeTruthy();
    expect(screen.getByText("Paused")).toBeTruthy();
  });

  it("resumes the project and reloads it", async () => {
    const paused = { ...KANTHORD, paused_at: Date.UTC(2026, 9, 4, 8, 30) };
    vi.mocked(projectsApi.readProject).mockResolvedValueOnce(paused).mockResolvedValue(KANTHORD);
    vi.mocked(projectsApi.resumeProject).mockResolvedValue(KANTHORD);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Resume" }));

    expect(projectsApi.resumeProject).toHaveBeenCalledWith(KANTHORD.id);
    expect(await screen.findByRole("button", { name: "Pause" })).toBeTruthy();
    expect(screen.queryByText("Paused")).toBeNull();
  });

  it("keeps the state and reloads nothing when the pause fails", async () => {
    vi.mocked(projectsApi.readProject).mockResolvedValue(KANTHORD);
    vi.mocked(projectsApi.pauseProject).mockRejectedValue(
      new ApiError("not_found", "The project identity does not exist.", 404),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Pause" }));
    const readsBeforeFailure = vi.mocked(projectsApi.readProject).mock.calls.length;
    const pausesBefore = vi.mocked(projectsApi.pauseProject).mock.calls.length;

    await waitFor(() => expect(screen.getByRole("button", { name: "Pause" })).toBeEnabled());
    expect(projectsApi.pauseProject).toHaveBeenCalledTimes(pausesBefore);
    expect(projectsApi.readProject).toHaveBeenCalledTimes(readsBeforeFailure);
  });

  it("reloads the project after a binding save", async () => {
    vi.mocked(projectsApi.readProject)
      .mockResolvedValueOnce(KANTHORD)
      .mockResolvedValue({ ...KANTHORD, binding_set_version: 4 });
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({
      version: 3,
      bindings: {
        "general-main": { kind: "worker", config: { worker: "coder@1", instance_count: 2 } },
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
