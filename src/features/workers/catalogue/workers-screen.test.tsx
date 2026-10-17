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
import { textContent } from "../../../../test/text-content";

const CATALOG_TDD: WorkerCatalogItem = {
  name: "tdd",
  host: "kanthord",
  declared_node_states: ["Available", "Waiting"],
  declared_works: ["implement"],
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

const INSTANCE_IDLE_WORKER: WorkerInstanceRecord = {
  runtime_identity: "worker_instance_02",
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

const INSTANCE_EXTERNAL: WorkerInstanceRecord = {
  runtime_identity: "worker_instance_03",
  project_id: "prj-test",
  resource_identity: "worker:kanthord:claude-code-main",
  worker_name: "claude-code@1",
  host: "external-harness",
  name: "harness-1",
  activity: "pulling",
  draining: false,
  registered: true,
};

describe("WorkersScreen", () => {
  it("lists the catalog workers with their node states and declared works", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([CATALOG_TDD]);
    vi.mocked(workersApi.listWorkerInstances).mockResolvedValue([]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("tdd")).toBeDefined());
    expect(screen.getByText("Waiting")).toBeDefined();
    expect(screen.getByText("Declared works")).toBeDefined();
    expect(screen.getByText("implement")).toBeDefined();
    expect(screen.queryByText("examine")).toBeNull();
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
    expect(screen.getByText(textContent("tdd · kanthord · server · execution_01"))).toBeDefined();
    expect(screen.getByText("No workers.")).toBeDefined();
  });

  it("shows the worker placement and no drain mark for an idle worker instance", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerInstances).mockResolvedValue([INSTANCE_IDLE_WORKER]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("reviewer-1")).toBeDefined());
    expect(screen.getByText("idle")).toBeDefined();
    expect(screen.queryByText("draining")).toBeNull();
    expect(screen.getByText(textContent("reviewer@1 · kanthord · worker"))).toBeDefined();
  });

  it("shows no placement for an external-harness instance", async () => {
    vi.mocked(workersApi.listWorkerCatalog).mockResolvedValue([]);
    vi.mocked(workersApi.listWorkerInstances).mockResolvedValue([INSTANCE_EXTERNAL]);
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
    vi.mocked(workersApi.listWorkerInstances).mockResolvedValue([]);
    render(<WorkersScreen />);

    await waitFor(() => expect(screen.getByText("The daemon is unavailable.")).toBeDefined());
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(screen.getByText("tdd")).toBeDefined());
  });
});
