import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as projectsApi from "@/api/resources/projects";
import * as workersApi from "@/api/resources/workers";
import type { WorkerBindingRecord, WorkerCatalogItem, WorkerRegistrationRecord } from "@/api/types";

vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/workers");
vi.mock("@/features/projects/project-context", () => ({
  useProjectId: () => "prj-test",
}));

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

describe("WorkersScreen", () => {
  beforeEach(() => {
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([]);
  });

  it("lists the catalog workers with their node states and declared works", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("tdd")).toBeDefined());
    expect(screen.getByText("Waiting")).toBeDefined();
    expect(screen.getByText("Declared intents")).toBeDefined();
    expect(screen.getByText("implement")).toBeDefined();
    expect(screen.queryByText("examine")).toBeNull();
    expect(screen.getByText("No registrations.")).toBeDefined();
    expect(workersApi.listWorkerRegistrations).toHaveBeenCalledWith("prj-test");
  });

  it("shows the activity, the drain mark and the execution of a live registration", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([REGISTRATION_EXECUTING]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("worker_registration_01")).toBeDefined());
    expect(screen.getByText("executing")).toBeDefined();
    expect(screen.getByText("draining")).toBeDefined();
    expect(screen.getByText(textContent("tdd · kanthord · server · execution_01"))).toBeDefined();
    expect(screen.getByText("No workers.")).toBeDefined();
  });

  it("shows the worker placement and no drain mark for an idle worker registration", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([REGISTRATION_IDLE_WORKER]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("reviewer-1")).toBeDefined());
    expect(screen.getByText("idle")).toBeDefined();
    expect(screen.queryByText("draining")).toBeNull();
    expect(screen.getByText(textContent("reviewer@1 · kanthord · worker"))).toBeDefined();
  });

  it("shows no placement for an external-harness registration", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([REGISTRATION_EXTERNAL]);
    render(<WorkersScreen />);

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
    render(<WorkersScreen />);

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
      workerBinding("tdd-main", { instance_count: 2, placement: "server" }),
      workerBinding("reviewer-main", { instance_count: 3, placement: "worker" }),
    ]);
    render(<WorkersScreen />);

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
      workerBinding("reviewer-main", { instance_count: 1, placement: "worker" }),
    ]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("0 of 1 live")).toBeDefined());
  });

  it("shows the missing count and the wait for a worker placement binding with a gap", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("reviewer-main", { instance_count: 2, placement: "worker" }),
    ]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("0 of 2 live")).toBeDefined());
    expect(
      screen.getByText(
        textContent(
          "2 instances are missing. The worker placement waits for the worker instance, which a later version adds. Until then, the server refuses the registration of a worker at this placement and hands it no credential. Use the server placement.",
        ),
      ),
    ).toBeDefined();
    expect(screen.queryByText(/kanthord auth jwt generate/)).toBeNull();
  });

  it("states one missing instance in the singular", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([REGISTRATION_IDLE_WORKER]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("reviewer-main", { instance_count: 2, placement: "worker" }),
    ]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("1 of 2 live")).toBeDefined());
    expect(screen.getByText(/^1 instance is missing\./)).toBeDefined();
  });

  it("shows the slot limit cause for a server placement binding with a gap", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("tdd-main", { instance_count: 2, placement: "server" }),
    ]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("0 of 2 live")).toBeDefined());
    expect(
      screen.getByText(
        textContent(
          "The server starts these instances. A lasting shortfall means the worker.server_slot_limit cap. See the server log for worker.pool.slot_limit.",
        ),
      ),
    ).toBeDefined();
    expect(screen.queryByText(/kanthord auth jwt generate/)).toBeNull();
  });

  it("shows the container log hint for a container placement binding with a gap", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("tdd-main", { instance_count: 2, placement: "container" }),
    ]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("0 of 2 live")).toBeDefined());
    expect(screen.getByText(textContent("tdd · container"))).toBeDefined();
    expect(
      screen.getByText(
        textContent(
          "The server starts these instances, each in its own container. Read workers/<client_id>/stderr.log in the state directory of the server.",
        ),
      ),
    ).toBeDefined();
    expect(screen.queryByText(/kanthord auth jwt generate/)).toBeNull();
  });

  it("shows no steps for a worker placement binding with all instances live", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([REGISTRATION_IDLE_WORKER]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("reviewer-main", { instance_count: 1, placement: "worker" }),
    ]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("1 of 1 live")).toBeDefined());
    expect(screen.queryByText(/kanthord auth jwt generate/)).toBeNull();
    expect(screen.queryByText(/worker.server_slot_limit/)).toBeNull();
  });

  it("shows a disabled mark for a binding with an instance count of 0", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      workerBinding("reviewer-main", { instance_count: 0, placement: "worker" }),
    ]);
    render(<WorkersScreen />);

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
    render(<WorkersScreen />);

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
      workerBinding("reviewer-main", { instance_count: 2, placement: "worker" }),
    ]);
    render(<WorkersScreen />);

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
      workerBinding("reviewer-main", { instance_count: 2, placement: "worker" }),
    ]);
    render(<WorkersScreen />);

    await waitFor(() => expect(workersApi.listWorkerRegistrations).toHaveBeenCalled());
    expect(screen.queryByText("0 of 2 live")).toBeNull();
    resolveCatalog([CATALOG_TDD]);
    await waitFor(() => expect(screen.getByText("0 of 2 live")).toBeDefined());
    expect(screen.getByText(/^2 instances are missing\./)).toBeDefined();
  });

  it("shows the empty state when the project has no worker binding", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerRegistrations).mockResolvedValue([]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("No worker bindings.")).toBeDefined());
  });
});
