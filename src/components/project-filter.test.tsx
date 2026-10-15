import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { Project } from "@/api/types";

import { ProjectFilter } from "./project-filter";

function project(id: string, name: string): Project {
  return {
    id,
    name,
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: `/state/${id}`,
  };
}

const PROJECTS = [project("prj-1", "kanthord"), project("prj-2", "atlas")];

describe("ProjectFilter", () => {
  it("shows All projects when no project is picked", () => {
    render(<ProjectFilter projects={PROJECTS} value={null} onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Project" })).toHaveTextContent("All projects");
  });

  it("lists All projects first and every project of the server", async () => {
    const user = userEvent.setup();
    render(<ProjectFilter projects={PROJECTS} value={null} onChange={vi.fn()} />);

    await user.click(screen.getByRole("combobox", { name: "Project" }));

    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "All projects",
      "kanthord",
      "atlas",
    ]);
  });

  it("reports the id of the picked project and null for All projects", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ProjectFilter projects={PROJECTS} value="prj-2" onChange={onChange} />);

    await user.click(screen.getByRole("combobox", { name: "Project" }));
    await user.click(await screen.findByRole("option", { name: "kanthord" }));
    expect(onChange).toHaveBeenLastCalledWith("prj-1");

    await user.click(screen.getByRole("combobox", { name: "Project" }));
    await user.click(await screen.findByRole("option", { name: "All projects" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
