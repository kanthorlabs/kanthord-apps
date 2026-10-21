import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as clientApi from "@/api/client";
import * as gatewayApi from "@/api/resources/gateway";
import * as instancesApi from "@/api/resources/worker-instances";
import * as projectsApi from "@/api/resources/projects";
import * as workersApi from "@/api/resources/workers";
import type { WorkerCatalogEntry, WorkerInstanceListItem } from "@/api/types";

vi.mock("@/api/client", async (original) => ({
  ...(await original<typeof clientApi>()),
  connectionBaseUrl: vi.fn(),
}));
vi.mock("@/api/resources/gateway");
vi.mock("@/api/resources/worker-instances");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/workers");
vi.mock("@/api/resources/scheduler");
vi.mock("@/api/resources/mission");
vi.mock("@/features/projects/project-context", () => ({
  useProjectId: () => "prj-test",
}));

import { WorkerScreen } from "./worker-screen";

const CODER: WorkerCatalogEntry = {
  name: "coder@1",
  host: "kanthord",
  declared_node_states: ["Available"],
  declared_intents: ["implement"],
  method: "steps",
  agent_names: ["swe@1"],
  resource_budget: { turns: 200, wall_time_ms: 3_600_000 },
};

const MAC: WorkerInstanceListItem = {
  id: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0I01",
  name: "mac-studio",
  worker: "coder@1",
  revision: 2,
  public_key: "a".repeat(43),
  fingerprint: "SHA256:4l0bK2qPn8YwVx3JmT7rUe6Hs1Dc9GfZaR5iLoQyWkE",
  created_at: 1,
  ended_at: null,
  connection: { connection_name: "mac-studio.local", connected_at: 1, last_heartbeat_at: 2 },
  binding_count: 1,
  holder_mismatch: true,
};

function mount() {
  return render(
    <MemoryRouter initialEntries={["/workers/coder%401"]}>
      <Routes>
        <Route path="/workers/:workerName" element={<WorkerScreen />} />
        <Route path="/workers/:workerName/instances/:instanceName" element={<p>Instance page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(workersApi.readWorkerCatalogEntry).mockResolvedValue(CODER);
  vi.mocked(workersApi.listAllWorkerRegistrations).mockResolvedValue([]);
  vi.mocked(workersApi.listWorkerPlacements).mockResolvedValue([]);
  vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([MAC]);
  vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([]);
  vi.mocked(gatewayApi.readServerVersion).mockResolvedValue("28.0.1");
  vi.mocked(clientApi.connectionBaseUrl).mockReturnValue("http://192.168.1.10:31415");
});

describe("WorkerScreen", () => {
  it("lists the instances of the worker with their connection and a missing copy", async () => {
    mount();
    const list = await screen.findByRole("list", { name: "Instances" });
    expect(within(list).getByText("mac-studio")).toBeInTheDocument();
    expect(within(list).getByText("(v2)")).toBeInTheDocument();
    expect(within(list).getByText("Connected · mac-studio.local")).toBeInTheDocument();
    expect(within(list).getByText("Credential copy missing")).toBeInTheDocument();
    expect(within(list).getByText("SHA256:4l0bK2qPn8Yw…")).toBeInTheDocument();
    expect(within(list).getByText("Idle")).toBeInTheDocument();
    expect(instancesApi.listWorkerInstances).toHaveBeenCalledWith("coder@1");
  });

  it("opens the instance page from a row", async () => {
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Open mac-studio" }));
    expect(await screen.findByText("Instance page")).toBeInTheDocument();
  });

  it("states the next step when the worker has no instance", async () => {
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([]);
    mount();
    expect(await screen.findByText("No instances.")).toBeInTheDocument();
    expect(
      screen.getByText("Add one to run this worker at the worker placement."),
    ).toBeInTheDocument();
  });

  it("creates an instance and shows its configuration and the steps of the host kind once", async () => {
    vi.mocked(instancesApi.createWorkerInstance).mockResolvedValue({
      ...MAC,
      name: "lan-01",
      revision: 1,
      instance_configuration: "eyJuYW1lIjoibGFuLTAxIn0",
    });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Add instance" }));
    const sheet = await screen.findByRole("dialog", { name: "Add instance" });
    expect(within(sheet).getByRole("button", { name: "Create instance" })).toBeDisabled();
    await userEvent.type(within(sheet).getByLabelText("Name"), "lan-01");
    await userEvent.click(within(sheet).getByRole("combobox", { name: "Where does it run?" }));
    await userEvent.click(await screen.findByRole("option", { name: "Linux (systemd)" }));
    expect(within(sheet).getByLabelText("Address")).toHaveValue("http://192.168.1.10:31415");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create instance" }));

    await waitFor(() =>
      expect(instancesApi.createWorkerInstance).toHaveBeenCalledWith({
        name: "lan-01",
        worker: "coder@1",
        endpoint: "http://192.168.1.10:31415",
      }),
    );
    expect(await within(sheet).findByText("eyJuYW1lIjoibGFuLTAxIn0")).toBeInTheDocument();
    expect(
      within(sheet).getByText("The instance configuration shows only once."),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText(/systemctl --user enable --now kanthord-worker@lan-01/),
    ).toBeInTheDocument();
    expect(within(sheet).getByText(/release 28\.0\.1/)).toBeInTheDocument();
    expect(within(sheet).queryByText(/podman secret create/)).not.toBeInTheDocument();
  });

  it("leaves the address empty with a hint for a loopback dashboard", async () => {
    vi.mocked(clientApi.connectionBaseUrl).mockReturnValue("http://127.0.0.1:31415");
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Add instance" }));
    const sheet = await screen.findByRole("dialog", { name: "Add instance" });
    await userEvent.click(within(sheet).getByRole("combobox", { name: "Where does it run?" }));
    await userEvent.click(await screen.findByRole("option", { name: "macOS (foreground)" }));
    expect(within(sheet).getByLabelText("Address")).toHaveValue("");
    expect(within(sheet).getByText(/loopback address/)).toBeInTheDocument();
  });

  it("fills the container network address when the server runs in a container", async () => {
    vi.mocked(workersApi.listWorkerPlacements).mockResolvedValue([
      {
        placement: "container",
        available: false,
        reason: "server_in_container",
        detail: null,
        container_runtime: null,
      },
    ]);
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Add instance" }));
    const sheet = await screen.findByRole("dialog", { name: "Add instance" });
    await waitFor(() => expect(workersApi.listWorkerPlacements).toHaveBeenCalled());
    await userEvent.click(within(sheet).getByRole("combobox", { name: "Where does it run?" }));
    await userEvent.click(await screen.findByRole("option", { name: "Container on this host" }));
    await waitFor(() =>
      expect(within(sheet).getByLabelText("Address")).toHaveValue("http://kanthord:31415"),
    );
  });

  it("refuses a reserved name before the call and maps a taken name to the field", async () => {
    vi.mocked(instancesApi.createWorkerInstance).mockRejectedValue(
      new ApiError("conflict", "The name is taken.", 409, "worker.instance.name_conflict"),
    );
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Add instance" }));
    const sheet = await screen.findByRole("dialog", { name: "Add instance" });
    await userEvent.type(within(sheet).getByLabelText("Name"), "server");
    await userEvent.click(within(sheet).getByRole("combobox", { name: "Where does it run?" }));
    await userEvent.click(await screen.findByRole("option", { name: "Container" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Create instance" }));
    expect(
      await within(sheet).findByText("The name server is reserved. Choose another name."),
    ).toBeInTheDocument();
    expect(instancesApi.createWorkerInstance).not.toHaveBeenCalled();

    await userEvent.clear(within(sheet).getByLabelText("Name"));
    await userEvent.type(within(sheet).getByLabelText("Name"), "box-01");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create instance" }));
    expect(
      await within(sheet).findByText(
        "The name box-01 is taken by a live or an archived instance. Choose another name.",
      ),
    ).toBeInTheDocument();
  });

  it("shows no Instances section for a worker of an external harness", async () => {
    vi.mocked(workersApi.readWorkerCatalogEntry).mockResolvedValue({
      name: "claude-code@1",
      host: "external-harness",
      declared_node_states: ["Available"],
      declared_intents: ["implement"],
      harness: "claude-code",
      resource_budget: { wall_time_ms: 3_600_000 },
    });
    mount();
    expect(await screen.findByRole("heading", { name: "Bindings" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Instances" })).not.toBeInTheDocument();
  });
});
