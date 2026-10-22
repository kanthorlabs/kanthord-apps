import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pauseProject, readProject, resumeProject } from "@/api/resources/projects";
import type { Project } from "@/api/types";

import { ProjectPauseButton } from "./project-pause-button";

vi.mock("@/api/resources/projects", () => ({
  pauseProject: vi.fn(),
  readProject: vi.fn(),
  resumeProject: vi.fn(),
}));

function project(pausedAt: number | null): Project {
  return {
    id: "prj-1",
    name: "atlas",
    binding_set_version: 1,
    created_at: 1,
    paused_at: pausedAt,
    workspace_directory: "/state/prj-1",
  };
}

beforeEach(() => {
  vi.mocked(readProject).mockReset().mockResolvedValue(project(null));
  vi.mocked(pauseProject).mockReset().mockResolvedValue(project(5));
  vi.mocked(resumeProject).mockReset().mockResolvedValue(project(null));
});

describe("ProjectPauseButton", () => {
  it("names the project and the effect of the pause in the dialog", async () => {
    render(<ProjectPauseButton project={project(null)} onChanged={vi.fn()} />);

    await userEvent.click(screen.getByRole("button", { name: "Pause atlas" }));

    const dialog = await screen.findByRole("alertdialog", { name: "Pause atlas?" });
    expect(within(dialog).getByText(/until a resume/).textContent).toBe(
      "No worker claims a new node of atlas until a resume. Each running execution continues to its end. The pause changes no node state, no job and no binding.",
    );
  });

  it("writes nothing when the human cancels the dialog", async () => {
    const onChanged = vi.fn();
    render(<ProjectPauseButton project={project(null)} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: "Pause atlas" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep the project active" }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(readProject).not.toHaveBeenCalled();
    expect(pauseProject).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("reads the project again and pauses it when the human confirms", async () => {
    const onChanged = vi.fn();
    render(<ProjectPauseButton project={project(null)} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: "Pause atlas" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Pause project" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(readProject).toHaveBeenCalledWith("prj-1");
    expect(pauseProject).toHaveBeenCalledWith("prj-1");
  });

  it("resumes a paused project in one click with no dialog", async () => {
    vi.mocked(readProject).mockResolvedValue(project(5));
    const onChanged = vi.fn();
    render(<ProjectPauseButton project={project(5)} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("button", { name: "Resume atlas" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(resumeProject).toHaveBeenCalledWith("prj-1");
  });
});
