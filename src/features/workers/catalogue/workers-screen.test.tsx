import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import * as workersApi from "@/api/resources/workers";
import type { WorkerBindingRecord, WorkerCatalogItem, WorkerRegistrationRecord } from "@/api/types";

vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/workers");
vi.mock("@/features/projects/project-context", () => {
  const projects = [{ id: "prj-test" }, { id: "prj-b" }];
  const value = { projects, project: projects[0] };
  return { useProjectId: () => "prj-test", useProject: () => value };
});

import { WorkersScreen } from "./workers-screen";
import { textContent } from "../../../../test/text-content";

const CATALOG_TDD: WorkerCatalogItem = {
  name: "tdd",
  host: "kanthord",
  declared_node_states: ["Available", "Waiting"],
  declared_intents: ["implement"],
};

const REGISTRATION_EXECUTING: WorkerRegistrationRecord = {
  runtime_identity: "worker_registration_01",
  project_id: "prj-test",
  resource_identity: "worker:kanthord:tdd-main",
  worker_name: "tdd",
  host: "kanthord",
  placement: "server",
  activity: "executing",
  draining: true,
  execution_id: "execution_01",
  registered: true,
};

const REGISTRATION_IDLE_WORKER: WorkerRegistrationRecord = {
  runtime_identity: "worker_registration_02",
  project_id: "prj-test",
  resource_identity: "worker:kanthord:reviewer-main",
  worker_name: "reviewer@1",
  host: "kanthord",
  placement: "worker",
  name: "reviewer-1",
  instance: "review-01",
  activity: "idle",
  draining: false,
  registered: true,
};

const REGISTRATION_EXTERNAL: WorkerRegistrationRecord = {
  runtime_identity: "worker_registration_03",
  project_id: "prj-test",
  resource_identity: "worker:kanthord:claude-code-main",
  worker_name: "claude-code@1",
  host: "external-harness",
  name: "harness-1",
  activity: "pulling",
  draining: false,
  registered: true,
};

function workerBinding(
  name: string,
  config: Partial<WorkerBindingRecord["config"]> = {},
): WorkerBindingRecord {
  return {
    id: `binding_${name}`,
    project_id: "prj-test",
    name,
    kind: "worker",
    resource_identity: `worker:kanthord:${name}`,
    revision: 1,
    config: { worker: "tdd", instance_count: 1, ...config },
    created_at: 1,
    removed_at: null,
  };
}

function renderScreen(entry = "/workers") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <WorkersScreen />
    </MemoryRouter>,
  );
}

describe("WorkersScreen", () => {
  beforeEach(() => {
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([]);
  });

  it("lists the catalog workers with their node states and declared works", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    renderScreen();

    await waitFor(() => expect(screen.getByText("tdd")).toBeDefined());
    expect(screen.getByText("Waiting")).toBeDefined();
    expect(screen.getByText("Declared intents")).toBeDefined();
    expect(screen.getByText("implement")).toBeDefined();
    expect(screen.queryByText("examine")).toBeNull();
    expect(screen.getByText("No registrations.")).toBeDefined();
    expect(workersApi.listWorkerRegistrations).toHaveBeenCalledWith("prj-test");
  });

  it("links each catalog worker to its worker page and counts its live registrations", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([
      CATALOG_TDD,
      { ...CATALOG_TDD, name: "reviewer@1" },
    ]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([
      REGISTRATION_EXECUTING,
      { ...REGISTRATION_EXECUTING, runtime_identity: "worker_registration_04" },
      REGISTRATION_IDLE_WORKER,
    ]);
    renderScreen();

    expect(await screen.findByRole("button", { name: "Open reviewer@1" })).toHaveAttribute(
      "href",
      "/workers/reviewer%401?project=prj-test",
    );
    expect(screen.getByRole("button", { name: "Open tdd" })).toHaveAttribute(
      "href",
      "/workers/tdd?project=prj-test",
    );
    expect(screen.getByText("2 live registrations in this project")).toBeDefined();
    expect(screen.getByText("1 live registration in this project")).toBeDefined();
  });

  it("reads the project of the query", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    renderScreen("/workers?project=prj-b");

    expect(await screen.findByRole("button", { name: "Open tdd" })).toHaveAttribute(
      "href",
      "/workers/tdd?project=prj-b",
    );
    expect(projectsApi.listWorkerBindings).toHaveBeenCalledWith("prj-b");
    expect(workersApi.listWorkerRegistrations).toHaveBeenCalledWith("prj-b");
  });

  it("keeps the project of the query on the link of a missing instance", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("reviewer-main", { worker_instances: ["review-01"] }),
    ]);
    renderScreen("/workers?project=prj-b");

    expect(await screen.findByRole("link", { name: "Open the worker page" })).toHaveAttribute(
      "href",
      "/workers/tdd?project=prj-b",
    );
  });

  it("shows the activity, the drain mark and the execution of a live registration", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([REGISTRATION_EXECUTING]);
    renderScreen();

    await waitFor(() => expect(screen.getByText("worker_registration_01")).toBeDefined());
    expect(screen.getByText("executing")).toBeDefined();
    expect(screen.getByText("draining")).toBeDefined();
    expect(screen.getByText(textContent("tdd · kanthord · server · execution_01"))).toBeDefined();
    expect(screen.getByText("No workers.")).toBeDefined();
  });

  it("shows the worker placement and no drain mark for an idle worker registration", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([REGISTRATION_IDLE_WORKER]);
    renderScreen();

    await waitFor(() => expect(screen.getByText("reviewer-1")).toBeDefined());
    expect(screen.getByText("idle")).toBeDefined();
    expect(screen.queryByText("draining")).toBeNull();
    expect(screen.getByText(textContent("reviewer@1 · kanthord · worker"))).toBeDefined();
  });

  it("shows no placement for an external-harness registration", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([REGISTRATION_EXTERNAL]);
    renderScreen();

    await waitFor(() => expect(screen.getByText("harness-1")).toBeDefined());
    expect(screen.getByText("pulling")).toBeDefined();
    expect(screen.queryByText("draining")).toBeNull();
    expect(screen.getByText(textContent("claude-code@1 · external-harness"))).toBeDefined();
  });

  it("retries the catalog read after an error", async () => {
    vi.mocked(workersApi.listWorkerCatalog)
      .mockRejectedValueOnce(new ApiError("unavailable", "The daemon is unavailable.", 503))
      .mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    renderScreen();

    await waitFor(() => expect(screen.getAllByText("The daemon is unavailable.")).toHaveLength(2));
    await userEvent.click(screen.getAllByRole("button", { name: "Retry" })[0]!);
    await waitFor(() => expect(screen.getByText("tdd")).toBeDefined());
    expect(screen.queryByText("The daemon is unavailable.")).toBeNull();
  });

  it("shows the revision, the expected and the live count of each worker binding", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([
      REGISTRATION_EXECUTING,
      { ...REGISTRATION_EXECUTING, runtime_identity: "worker_registration_04" },
      REGISTRATION_IDLE_WORKER,
    ]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("tdd-main", { worker_instances: ["tdd-1", "tdd-2"] }),
      workerBinding("reviewer-main", {
        worker_instances: ["review-01", "review-02", "review-03"],
      }),
    ]);
    renderScreen();

    await waitFor(() => expect(screen.getByText("tdd-main")).toBeDefined());
    expect(screen.getByText("2 of 2 live")).toBeDefined();
    expect(screen.getByText("1 of 3 live")).toBeDefined();
    expect(screen.getAllByText("(v1)")).toHaveLength(2);
    expect(projectsApi.listWorkerBindings).toHaveBeenCalledWith("prj-test");
  });

  it("does not count a registration of another project with the same binding name", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([
      { ...REGISTRATION_IDLE_WORKER, project_id: "prj-other" },
    ]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("reviewer-main", { worker_instances: ["review-01"] }),
    ]);
    renderScreen();

    await waitFor(() => expect(screen.getByText("0 of 1 live")).toBeDefined());
  });

  it("names the listed instances that hold no live registration", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("reviewer-main", {
        worker_instances: ["review-01", "review-02"],
      }),
    ]);
    renderScreen();

    await waitFor(() => expect(screen.getByText("0 of 2 live")).toBeDefined());
    expect(
      screen.getByText(
        textContent(
          "2 instances missing. Start kanthord serve worker --instance <name> on the host of each listed instance that is not registered: review-01, review-02. Open the worker page",
        ),
      ),
    ).toBeDefined();
    expect(screen.getByRole("link", { name: "Open the worker page" })).toHaveAttribute(
      "href",
      "/workers/tdd?project=prj-test",
    );
    expect(screen.queryByText(/kanthord auth jwt generate/)).toBeNull();
  });

  it("states one missing instance in the singular", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([REGISTRATION_IDLE_WORKER]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("reviewer-main", {
        worker_instances: ["review-01", "review-02"],
      }),
    ]);
    renderScreen();

    await waitFor(() => expect(screen.getByText("1 of 2 live")).toBeDefined());
    expect(screen.getByText(/^1 instance missing\./)).toHaveTextContent(
      /not registered: review-02\. Open the worker page$/,
    );
  });

  it("removes a worker binding through the binding guard at the version it read", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("tdd-main", { worker_instances: ["tdd-1", "tdd-2"] }),
    ]);
    vi.mocked(projectsApi.readBindingSet).mockResolvedValue({
      version: 9,
      bindings: {
        "tdd-main": {
          kind: "worker",
          config: { worker: "tdd", worker_instances: ["tdd-1", "tdd-2"] },
        },
      },
    });
    vi.mocked(projectsApi.writeBindingSet).mockResolvedValue({
      project_id: "prj-test",
      binding_set_version: 10,
      changes: [],
      stale_pins: [],
    });
    vi.mocked(missionApi.readMission).mockResolvedValue({
      id: "mission-1",
      project_id: "prj-test",
      version: 1,
    });
    vi.mocked(missionApi.exportMissionJson).mockResolvedValue({
      mission_id: "mission-1",
      entries: [],
    } as unknown as Awaited<ReturnType<typeof missionApi.exportMissionJson>>);
    renderScreen();

    await userEvent.click(await screen.findByRole("button", { name: "Remove tdd-main" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByRole("button", { name: "Make unavailable instead" })).toBeDefined();
    expect(await within(dialog).findByText("No current mission node names it.")).toBeDefined();
    expect(projectsApi.writeBindingSet).not.toHaveBeenCalled();
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove binding" }));
    await waitFor(() =>
      expect(projectsApi.writeBindingSet).toHaveBeenCalledWith(expect.any(String), 9, {}),
    );
  });

  it("shows no steps for a worker placement binding with all instances live", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([REGISTRATION_IDLE_WORKER]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("reviewer-main", { worker_instances: ["review-01"] }),
    ]);
    renderScreen();

    await waitFor(() => expect(screen.getByText("1 of 1 live")).toBeDefined());
    expect(screen.queryByText(/kanthord auth jwt generate/)).toBeNull();
    expect(screen.queryByText(/worker.server_slot_limit/)).toBeNull();
  });

  it("shows a disabled mark for a binding at the worker placement with no instance", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("reviewer-main", { worker_instances: [] }),
    ]);
    renderScreen();

    await waitFor(() => expect(screen.getByText("0 of 0 live")).toBeDefined());
    expect(screen.getByText("disabled")).toBeDefined();
    expect(screen.queryByText(/kanthord auth jwt generate/)).toBeNull();
  });

  it("shows no placement and no steps for an external-harness worker binding", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([
      {
        name: "claude-code@1",
        host: "external-harness",
        declared_node_states: ["Available"],
        declared_intents: ["implement"],
      },
    ]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("claude-code-main", { worker: "claude-code@1", instance_count: 1 }),
    ]);
    renderScreen();

    await waitFor(() => expect(screen.getByText("0 of 1 live")).toBeDefined());
    expect(screen.getAllByText("claude-code@1").length).toBeGreaterThan(0);
    expect(screen.queryByText(/kanthord auth jwt generate/)).toBeNull();
    expect(screen.queryByText(/ · worker$/)).toBeNull();
  });

  it("shows the catalog error and no hint when the catalog read fails", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockRejectedValue(
      new ApiError("unavailable", "The daemon is unavailable.", 503),
    );
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("reviewer-main", {
        worker_instances: ["review-01", "review-02"],
      }),
    ]);
    renderScreen();

    await waitFor(() => expect(screen.getAllByText("The daemon is unavailable.")).toHaveLength(2));
    expect(screen.queryByText("0 of 2 live")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Retry" })).toHaveLength(2);
  });

  it("shows a loading state for the bindings until the catalog loads", async () => {
    let resolveCatalog: (items: WorkerCatalogItem[]) => void = () => undefined;
    vi.mocked(workersApi.listWorkerCatalog).mockReturnValue(
      new Promise((resolve) => {
        resolveCatalog = resolve;
      }),
    );
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("reviewer-main", {
        worker_instances: ["review-01", "review-02"],
      }),
    ]);
    renderScreen();

    await waitFor(() => expect(workersApi.listWorkerRegistrations).toHaveBeenCalled());
    expect(screen.queryByText("0 of 2 live")).toBeNull();
    resolveCatalog([CATALOG_TDD]);
    await waitFor(() => expect(screen.getByText("0 of 2 live")).toBeDefined());
    expect(screen.getByText(/^2 instances missing\./)).toBeDefined();
  });

  it("shows the empty state when the project has no worker binding", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    renderScreen();

    await waitFor(() => expect(screen.getByText("No worker bindings.")).toBeDefined());
  });
});
