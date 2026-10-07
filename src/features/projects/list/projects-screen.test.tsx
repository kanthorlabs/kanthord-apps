import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as projectsApi from "@/api/resources/projects";
import type { Project } from "@/api/types";

vi.mock("@/api/resources/projects");

import { ProjectsScreen } from "./projects-screen";

const KANTHORD: Project = {
  id: "project_01J9ZQ4XKM3B6V8N2R5T7W0YAC",
  name: "kanthord",
  binding_set_version: 3,
  created_at: Date.UTC(2026, 9, 3, 14, 5),
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
    expect(within(items[0]!).getByText(KANTHORD.id)).toBeTruthy();
    expect(within(items[0]!).getByText("2026-10-03 14:05 UTC")).toBeTruthy();
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
});
