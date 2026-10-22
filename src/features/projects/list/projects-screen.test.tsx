import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import type { MissionNodeRecord, NodeState, Project } from "@/api/types";

vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/mission");

import { ProjectsScreen } from "./projects-screen";

const KANTHORD: Project = {
  id: "project_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
  name: "kanthord",
  binding_set_version: 3,
  created_at: Date.UTC(2026, 9, 3, 14, 5),
  paused_at: null,
  workspace_directory:
    "/home/kanthord/.local/state/kanthord/projects/project_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
};
const BILLING: Project = { ...KANTHORD, id: "project_01J9ZQ4XKM3B6V8N2R5T7W0YAB", name: "billing" };

function mount() {
  return render(
    <MemoryRouter initialEntries={["/projects"]}>
      <Routes>
        <Route path="/projects" element={<ProjectsScreen />} />
        <Route path="/projects/new" element={<p>New project form</p>} />
        <Route path="/projects/:projectId" element={<p>Project view</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function node(state: NodeState): MissionNodeRecord {
  return { id: `node_${state}`, state, retired_at: null } as MissionNodeRecord;
}

beforeEach(() => {
  vi.mocked(missionApi.readMission).mockImplementation(async (projectId) => ({
    id: `mission_${projectId}`,
    project_id: projectId,
    version: 1,
  }));
  vi.mocked(missionApi.listMissionNodes).mockResolvedValue([]);
});

describe("ProjectsScreen", () => {
  it("lists the projects of one page", async () => {
    vi.mocked(projectsApi.listProjectPage).mockResolvedValue({
      items: [KANTHORD, BILLING],
      next_cursor: null,
    });
    mount();

    const list = await screen.findByRole("list", { name: "Projects" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]!).queryByText(KANTHORD.id)).toBeNull();
    expect(within(items[0]!).getByText("2026-10-03 14:05 UTC")).toBeTruthy();
  });

  it("marks a paused project with the Paused badge", async () => {
    vi.mocked(projectsApi.listProjectPage).mockResolvedValue({
      items: [{ ...KANTHORD, paused_at: Date.UTC(2026, 9, 4, 8, 30) }, BILLING],
      next_cursor: null,
    });
    mount();

    const items = within(await screen.findByRole("list", { name: "Projects" })).getAllByRole(
      "listitem",
    );
    expect(within(items[0]!).getByText("Paused")).toBeTruthy();
    expect(within(items[1]!).queryByText("Paused")).toBeNull();
  });

  it("resumes a paused project from its row after it reads the project again", async () => {
    const paused = { ...KANTHORD, paused_at: Date.UTC(2026, 9, 4, 8, 30) };
    vi.mocked(projectsApi.listProjectPage)
      .mockResolvedValueOnce({ items: [paused, BILLING], next_cursor: null })
      .mockResolvedValue({ items: [KANTHORD, BILLING], next_cursor: null });
    vi.mocked(projectsApi.readProject).mockResolvedValue(paused);
    vi.mocked(projectsApi.resumeProject).mockResolvedValue(KANTHORD);
    mount();

    const list = await screen.findByRole("list", { name: "Projects" });
    await userEvent.click(within(list).getByRole("button", { name: "Resume kanthord" }));

    expect(projectsApi.readProject).toHaveBeenCalledWith(KANTHORD.id);
    expect(projectsApi.resumeProject).toHaveBeenCalledWith(KANTHORD.id);
    expect(await within(list).findByRole("button", { name: "Pause kanthord" })).toBeTruthy();
    expect(within(list).getByRole("button", { name: "Pause billing" })).toBeTruthy();
  });

  it("pauses an active project from its row", async () => {
    vi.mocked(projectsApi.listProjectPage).mockResolvedValue({
      items: [KANTHORD],
      next_cursor: null,
    });
    vi.mocked(projectsApi.readProject).mockResolvedValue(KANTHORD);
    vi.mocked(projectsApi.pauseProject).mockResolvedValue({ ...KANTHORD, paused_at: 5 });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Pause kanthord" }));

    expect(projectsApi.pauseProject).toHaveBeenCalledWith(KANTHORD.id);
  });

  it("writes nothing when another actor already resumed the project", async () => {
    const paused = { ...KANTHORD, paused_at: Date.UTC(2026, 9, 4, 8, 30) };
    vi.mocked(projectsApi.listProjectPage).mockResolvedValue({
      items: [paused],
      next_cursor: null,
    });
    vi.mocked(projectsApi.readProject).mockClear().mockResolvedValue(KANTHORD);
    vi.mocked(projectsApi.resumeProject).mockClear();
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Resume kanthord" }));

    expect(projectsApi.readProject).toHaveBeenCalledWith(KANTHORD.id);
    expect(projectsApi.resumeProject).not.toHaveBeenCalled();
  });

  it("opens a project from its row", async () => {
    vi.mocked(projectsApi.listProjectPage).mockResolvedValue({
      items: [KANTHORD],
      next_cursor: null,
    });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Open kanthord" }));

    expect(screen.getByText("Project view")).toBeTruthy();
  });

  it("reads the next page at the cursor", async () => {
    vi.mocked(projectsApi.listProjectPage)
      .mockResolvedValueOnce({ items: [KANTHORD], next_cursor: "c-1" })
      .mockResolvedValueOnce({ items: [BILLING], next_cursor: null });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Next" }));

    expect(await screen.findByRole("button", { name: "Open billing" })).toBeTruthy();
    expect(projectsApi.listProjectPage).toHaveBeenLastCalledWith("c-1");
  });

  it("offers the new project form", async () => {
    vi.mocked(projectsApi.listProjectPage).mockResolvedValue({ items: [], next_cursor: null });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "New project" }));

    expect(screen.getByText("New project form")).toBeTruthy();
  });

  it("reports a failed read", async () => {
    vi.mocked(projectsApi.listProjectPage).mockRejectedValue(
      new ApiError("unavailable", "The daemon did not answer.", 503),
    );
    mount();

    expect(await screen.findByText("The daemon did not answer.")).toBeTruthy();
  });

  it("shows the mission state of each project as badges and progress", async () => {
    vi.mocked(projectsApi.listProjectPage).mockResolvedValue({
      items: [KANTHORD, BILLING],
      next_cursor: null,
    });
    vi.mocked(missionApi.listMissionNodes).mockImplementation(async (missionId) =>
      missionId === `mission_${KANTHORD.id}`
        ? [
            node("Blocked"),
            node("Paused"),
            node("External.Failed"),
            node("Executing"),
            node("Completed"),
            node("Completed"),
          ]
        : [],
    );
    mount();

    const list = await screen.findByRole("list", { name: "Projects" });
    const [first, second] = within(list).getAllByRole("listitem");
    expect(await within(first!).findByText("2 of 6 nodes completed")).toBeTruthy();
    expect(within(first!).getByText("Blocked or paused · 2")).toBeTruthy();
    expect(within(first!).getByText("Running · 1")).toBeTruthy();
    expect(within(second!).getByText("No nodes")).toBeTruthy();
    expect(within(second!).queryByText(/Blocked or paused/)).toBeNull();
  });

  it("names a mission read that failed on its row", async () => {
    vi.mocked(projectsApi.listProjectPage).mockResolvedValue({
      items: [KANTHORD],
      next_cursor: null,
    });
    vi.mocked(missionApi.readMission).mockRejectedValue(
      new ApiError("unavailable", "The daemon failed.", 503),
    );
    mount();

    expect(await screen.findByText("Could not be read: The daemon failed.")).toBeTruthy();
  });
});
