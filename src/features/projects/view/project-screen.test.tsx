import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import * as workersApi from "@/api/resources/workers";
import type { EnvironmentState, EnvironmentStatus, Project } from "@/api/types";

vi.mock("@/api/resources/credentials");
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

function environment(
  status: EnvironmentStatus,
  overrides: Partial<EnvironmentState> = {},
): EnvironmentState {
  return {
    binding_id: "binding_engine",
    binding_name: "engine",
    resource_identity: "resource_1",
    target: "image",
    source: "repository",
    status,
    digest: null,
    tag: null,
    run_started_at: Date.now() - 150_000,
    step_started_at: Date.now() - 150_000,
    reason: null,
    reason_started_at: null,
    failure: null,
    checks: [],
    repairs: 0,
    repairing: false,
    ...overrides,
  };
}

function failedEnvironment(overrides: Partial<EnvironmentState> = {}): EnvironmentState {
  return environment("failed", {
    failure: {
      class: "command_absent",
      origin: "onboarding",
      execution_id: null,
      command: "pnpm",
      exit_code: null,
      tail: "",
      reproduce: "",
      ended_at: Date.now(),
    },
    ...overrides,
  });
}

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
  afterEach(() => {
    window.innerWidth = 1024;
  });

  beforeEach(() => {
    vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([]);
    vi.mocked(missionApi.readMission).mockResolvedValue({
      id: "mission_1",
      project_id: KANTHORD.id,
      version: 1,
    });
    vi.mocked(projectsApi.listBindings).mockResolvedValue([]);
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({ version: 1, bindings: {} });
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([]);
    vi.mocked(missionApi.listMissionNodes).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    vi.mocked(workersApi.listAgents).mockResolvedValue([]);
    vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([]);
    vi.mocked(credentialsApi.listCredentialPage).mockResolvedValue({
      items: [],
      next_cursor: null,
    });
    vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue({ items: [] });
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([]);
  });

  it("shows the readiness of a new project with a link to each step", async () => {
    vi.mocked(projectsApi.readProject).mockResolvedValue(KANTHORD);
    mount();

    const panel = await screen.findByRole("region", { name: "Readiness" });
    const repository = await within(panel).findByRole("listitem", { name: "Repository binding" });
    expect(within(repository).getByText("Open")).toBeTruthy();
    expect(within(panel).queryByRole("listitem", { name: "Project active" })).toBeNull();
    expect(within(repository).getByRole("button", { name: "Open bindings" })).toHaveAttribute(
      "href",
      `/projects/${KANTHORD.id}?tab=bindings`,
    );
    await userEvent.click(within(panel).getByRole("button", { name: /done step/ }));
    expect(
      within(await within(panel).findByRole("listitem", { name: "Project active" })).getByText(
        "Done",
      ),
    ).toBeTruthy();
    expect(
      within(within(panel).getByRole("listitem", { name: "Plan import" })).getByRole("button", {
        name: "Open mission",
      }),
    ).toHaveAttribute("href", `/projects/${KANTHORD.id}`);
    expect(within(panel).getByRole("button", { name: "Hide done steps" })).toBeTruthy();
  });

  it("shows the information of the project in the path", async () => {
    vi.mocked(projectsApi.readProject).mockResolvedValue(KANTHORD);
    mount();

    expect(await screen.findByRole("heading", { name: "kanthord" })).toBeTruthy();
    expect(projectsApi.readProject).toHaveBeenCalledWith(KANTHORD.id);
    expect(screen.queryByText(KANTHORD.id)).toBeNull();
    await userEvent.click(
      within(screen.getByRole("region", { name: "Project" })).getByRole("button", {
        name: "Details",
      }),
    );
    expect(await screen.findByText(KANTHORD.id)).toBeTruthy();
    expect(screen.getByText("Workspace Directory")).toBeTruthy();
    expect(screen.getByText(KANTHORD.workspace_directory).className).toContain("font-mono");
    expect(screen.queryByText("Binding set version")).toBeNull();
    expect(screen.getByText("2026-10-03 14:05 UTC")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Edit" })).toHaveAttribute(
      "href",
      `/projects/${KANTHORD.id}/edit`,
    );
  });

  it("links to the trace list filtered to the project", async () => {
    vi.mocked(projectsApi.readProject).mockResolvedValue(KANTHORD);
    mount();

    expect(await screen.findByRole("button", { name: "Traces" })).toHaveAttribute(
      "href",
      `/traces?project_id=${KANTHORD.id}`,
    );
  });

  it("links to the timeline of the project", async () => {
    vi.mocked(projectsApi.readProject).mockResolvedValue(KANTHORD);
    mount();

    expect(await screen.findByRole("button", { name: "Timeline" })).toHaveAttribute(
      "href",
      `/timeline?project_id=${KANTHORD.id}`,
    );
  });

  it("shows an active project with the Pause button and no Paused badge", async () => {
    vi.mocked(projectsApi.readProject).mockResolvedValue(KANTHORD);
    mount();

    expect(await screen.findByRole("button", { name: "Pause kanthord" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Resume kanthord" })).toBeNull();
    expect(screen.queryByText("Paused")).toBeNull();
  });

  it("shows a paused project with the Paused badge, its time and the Resume button", async () => {
    vi.mocked(projectsApi.readProject).mockResolvedValue({
      ...KANTHORD,
      paused_at: Date.UTC(2026, 9, 4, 8, 30),
    });
    mount();

    expect(await screen.findByText("Paused")).toBeTruthy();
    expect(screen.getByText("since 2026-10-04 08:30 UTC")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Resume kanthord" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pause kanthord" })).toBeNull();
  });

  it("pauses the project after the confirmation and reloads it", async () => {
    const paused = { ...KANTHORD, paused_at: Date.UTC(2026, 9, 4, 8, 30) };
    vi.mocked(projectsApi.readProject)
      .mockResolvedValueOnce(KANTHORD)
      .mockResolvedValueOnce(KANTHORD)
      .mockResolvedValue(paused);
    vi.mocked(projectsApi.pauseProject).mockResolvedValue(paused);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Pause kanthord" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Pause kanthord?" });
    expect(projectsApi.pauseProject).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Pause project" }));

    expect(await screen.findByRole("button", { name: "Resume kanthord" })).toBeTruthy();
    expect(projectsApi.pauseProject).toHaveBeenCalledWith(KANTHORD.id);
    expect(screen.getByText("Paused")).toBeTruthy();
  });

  it("resumes the project and reloads it", async () => {
    const paused = { ...KANTHORD, paused_at: Date.UTC(2026, 9, 4, 8, 30) };
    vi.mocked(projectsApi.readProject)
      .mockResolvedValueOnce(paused)
      .mockResolvedValueOnce(paused)
      .mockResolvedValue(KANTHORD);
    vi.mocked(projectsApi.resumeProject).mockResolvedValue(KANTHORD);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Resume kanthord" }));

    expect(await screen.findByRole("button", { name: "Pause kanthord" })).toBeTruthy();
    expect(projectsApi.resumeProject).toHaveBeenCalledWith(KANTHORD.id);
    expect(screen.queryByText("Paused")).toBeNull();
  });

  it("keeps the state and reloads nothing when the pause fails", async () => {
    vi.mocked(projectsApi.readProject).mockResolvedValue(KANTHORD);
    vi.mocked(projectsApi.pauseProject).mockRejectedValue(
      new ApiError("not_found", "The project identity does not exist.", 404),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Pause kanthord" }));
    await userEvent.click(await screen.findByRole("button", { name: "Pause project" }));
    const readsBeforeFailure = vi.mocked(projectsApi.readProject).mock.calls.length;
    const pausesBefore = vi.mocked(projectsApi.pauseProject).mock.calls.length;

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Pause kanthord" })).toBeEnabled(),
    );
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

  describe("environment bar", () => {
    beforeEach(() => {
      vi.mocked(projectsApi.readProject).mockResolvedValue(KANTHORD);
    });

    it("shows a building state with its badge, step line, progress and Details link", async () => {
      vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([environment("building")]);
      mount();

      const bar = await screen.findByRole("alert", { name: "Environment" });
      expect(within(bar).getByText("Building")).toBeTruthy();
      expect(bar).toHaveTextContent("engine · Building the image · 2 min");
      expect(within(bar).getByRole("progressbar")).toHaveAccessibleName("Environment step 2 of 3");
      expect(within(bar).getByRole("button", { name: "Details" })).toHaveAttribute(
        "href",
        `/projects/${KANTHORD.id}?tab=bindings&environment=engine`,
      );
      expect(projectsApi.listProjectEnvironments).toHaveBeenCalledWith(KANTHORD.id);
    });

    it("announces the text of the bar as a polite live region", async () => {
      vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([environment("building")]);
      mount();

      const bar = await screen.findByRole("alert", { name: "Environment" });
      const live = within(bar).getByText("Building").closest("[aria-live]");
      expect(live).toHaveAttribute("aria-live", "polite");
      expect(live).toHaveTextContent("engine · Building the image");
    });

    it("encodes the binding name in the Details link", async () => {
      vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([
        environment("building", { binding_name: "api & web" }),
      ]);
      mount();

      const bar = await screen.findByRole("alert", { name: "Environment" });
      expect(within(bar).getByRole("button", { name: "Details" })).toHaveAttribute(
        "href",
        `/projects/${KANTHORD.id}?tab=bindings&environment=api%20%26%20web`,
      );
    });

    it("shows a failed state with its class and command and no progress", async () => {
      vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([failedEnvironment()]);
      mount();

      const bar = await screen.findByRole("alert", { name: "Environment" });
      expect(within(bar).getByText("Failed")).toBeTruthy();
      expect(bar).toHaveTextContent("engine · Failed: command_absent · pnpm");
      expect(within(bar).queryByRole("progressbar")).toBeNull();
    });

    it("shows the repair line of a failed state that env@1 repairs", async () => {
      vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([
        failedEnvironment({ repairing: true, repairs: 1 }),
      ]);
      mount();

      const bar = await screen.findByRole("alert", { name: "Environment" });
      expect(within(bar).getByText("Failed")).toBeTruthy();
      expect(bar).toHaveTextContent("engine · Repairing with env@1 · repair 1 of 3");
      expect(within(bar).queryByRole("progressbar")).toBeNull();
    });

    it("shows the reason of a pending state", async () => {
      vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([
        environment("pending", { reason: "The base branch main is absent." }),
      ]);
      mount();

      const bar = await screen.findByRole("alert", { name: "Environment" });
      expect(within(bar).getByText("Pending")).toBeTruthy();
      expect(bar).toHaveTextContent("Waiting: The base branch main is absent.");
    });

    it("adds the count of the other states that are not ready", async () => {
      vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([
        environment("building", { binding_id: "b1", binding_name: "one" }),
        failedEnvironment({ binding_id: "b2", binding_name: "two" }),
        environment("proving", { binding_id: "b3", binding_name: "three" }),
        environment("ready", { binding_id: "b4", binding_name: "four" }),
      ]);
      mount();

      const bar = await screen.findByRole("alert", { name: "Environment" });
      expect(bar).toHaveTextContent("two · Failed: command_absent · pnpm");
      expect(within(bar).getByText("and 2 more")).toBeTruthy();
    });

    it("keeps the bar when the tab changes to Bindings", async () => {
      vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([environment("building")]);
      mount();

      await screen.findByRole("alert", { name: "Environment" });
      await userEvent.click(screen.getByRole("tab", { name: "Bindings" }));

      expect(screen.getByRole("tab", { name: "Bindings", selected: true })).toBeTruthy();
      expect(screen.getByRole("alert", { name: "Environment" })).toHaveTextContent(
        "engine · Building the image",
      );
    });

    it("shows no bar when every state is ready at the first read", async () => {
      vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([
        environment("ready"),
        environment("none", { binding_id: "b2", binding_name: "other" }),
      ]);
      mount();

      await screen.findByRole("heading", { name: "kanthord" });
      await waitFor(() => expect(projectsApi.listProjectEnvironments).toHaveBeenCalled());
      expect(screen.queryByRole("alert", { name: "Environment" })).toBeNull();
    });

    it("shows the queue wait of a run that has not started and no elapsed time", async () => {
      vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([
        environment("building", { run_started_at: null, step_started_at: null }),
      ]);
      mount();

      const bar = await screen.findByRole("alert", { name: "Environment" });
      expect(bar).toHaveTextContent("engine · Waiting for another run");
      expect(bar).not.toHaveTextContent(/\d+ (s|min)/);
    });

    it("keeps one row at 1280 px with the Details text", async () => {
      vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([environment("building")]);
      mount();

      const bar = await screen.findByRole("alert", { name: "Environment" });
      const details = within(bar).getByRole("button", { name: "Details" });
      expect(details).toHaveTextContent("Details");
      expect(within(bar).getByText(/· 2 min/).className).toContain("md:inline");
      expect(within(bar).getByText(/· 2 min/).className).toContain("hidden");
    });

    it("shows Details as an icon button and keeps the step line in the badge row below md", async () => {
      window.innerWidth = 390;
      vi.mocked(projectsApi.listProjectEnvironments).mockResolvedValue([environment("building")]);
      mount();

      const bar = await screen.findByRole("alert", { name: "Environment" });
      const details = await within(bar).findByRole("button", { name: "Details" });
      expect(details.textContent).toBe("");
      expect(details.className).toContain("size-9");
      const badge = within(bar).getByText("Building");
      const row = badge.parentElement;
      expect(row?.className).toContain("flex");
      expect(row?.className).toContain("min-w-0");
      expect(row?.className).toContain("items-center");
      const stepLine = within(bar).getByText(/Building the image/);
      expect(stepLine.parentElement).toBe(row);
      expect(stepLine.className).toContain("truncate");
      expect(stepLine.className).toContain("min-w-0");
      expect(within(bar).getByText(/· 2 min/).className).toContain("hidden");
    });
  });
});
