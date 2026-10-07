import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workersApi from "@/api/resources/workers";
import type { WorkerCatalogItem, WorkerInstanceRecord } from "@/api/types";

vi.mock("@/api/resources/workers");
vi.mock("@/features/projects/project-context", () => ({
  useProjectId: () => "prj-test",
}));

import { WorkersScreen } from "./workers-screen";

const CATALOG_TDD: WorkerCatalogItem = {
  name: "tdd",
  host: "kanthord",
  declared_node_states: ["Available", "Waiting"],
  required_node_format: ["objective"],
};

const INSTANCE_EXECUTING: WorkerInstanceRecord = {
  runtime_identity: "worker_instance_01",
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

describe("WorkersScreen", () => {
  it("lists the catalog workers with their node states and node format", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerInstances).mockResolvedValue([]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("tdd")).toBeDefined());
    expect(screen.getByText("Waiting")).toBeDefined();
    expect(screen.getByText("objective")).toBeDefined();
    expect(screen.getByText("No instances.")).toBeDefined();
    expect(workersApi.listWorkerInstances).toHaveBeenCalledWith("prj-test");
  });

  it("shows the activity, the drain mark and the execution of a live instance", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerInstances).mockResolvedValue([INSTANCE_EXECUTING]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("worker_instance_01")).toBeDefined());
    expect(screen.getByText("executing")).toBeDefined();
    expect(screen.getByText("draining")).toBeDefined();
    expect(screen.getByText("tdd · kanthord · server · execution_01")).toBeDefined();
    expect(screen.getByText("No workers.")).toBeDefined();
  });

  it("retries the catalog read after an error", async () => {
    vi.mocked(workersApi.listWorkerCatalog)
      .mockRejectedValueOnce(new ApiError("unavailable", "The daemon is unavailable.", 503))
      .mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerInstances).mockResolvedValue([]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("The daemon is unavailable.")).toBeDefined());
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("tdd")).toBeDefined());
  });
});
