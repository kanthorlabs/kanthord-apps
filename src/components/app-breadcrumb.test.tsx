import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { AppBreadcrumb } from "./app-breadcrumb";
import { CrumbLabelsProvider, useCrumbLabel } from "./crumb-labels";

function NamedProject() {
  useCrumbLabel("/projects/project_1", "kanthord");
  return null;
}

function mount(path: string, named = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <CrumbLabelsProvider>
        <AppBreadcrumb />
        {named && <NamedProject />}
      </CrumbLabelsProvider>
    </MemoryRouter>,
  );
}

describe("AppBreadcrumb", () => {
  it("links every crumb but the current page", async () => {
    mount("/projects/project_1/edit", true);

    const trail = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(await within(trail).findByRole("link", { name: "kanthord" })).toHaveAttribute(
      "href",
      "/projects/project_1",
    );
    expect(within(trail).getByRole("link", { name: "Projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(within(trail).getByText("Edit")).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 1, name: "Edit" })).toBeTruthy();
  });

  it("falls back to the path segment before a screen names it", () => {
    mount("/projects/project_1");

    expect(screen.getByRole("heading", { level: 1, name: "project_1" })).toBeTruthy();
  });

  it("names a top-level page from the sidebar", () => {
    mount("/agents");

    expect(screen.getByRole("heading", { level: 1, name: "Agents" })).toBeTruthy();
  });
});
