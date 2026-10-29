import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as clientApi from "@/api/client";
import * as gatewayApi from "@/api/resources/gateway";
import * as instancesApi from "@/api/resources/worker-instances";
import * as projectsApi from "@/api/resources/projects";
import * as workersApi from "@/api/resources/workers";
import type {
  PlacementStatus,
  WorkerCatalogEntry,
  WorkerInstanceListItem,
  WorkerRegistrationRecord,
} from "@/api/types";

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
  placement: "worker",
  revision: 2,
  public_key: "a".repeat(43),
  fingerprint: "SHA256:4l0bK2qPn8YwVx3JmT7rUe6Hs1Dc9GfZaR5iLoQyWkE",
  created_at: 1,
  ended_at: null,
  connection: { connection_name: "mac-studio.local", connected_at: 1, last_heartbeat_at: 2 },
  binding_count: 1,
  holder_mismatch: true,
};

const CODER_ONE: WorkerInstanceListItem = {
  ...MAC,
  id: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0I02",
  name: "coder-1",
  placement: "server",
  revision: 1,
  public_key: null,
  fingerprint: null,
  connection: null,
  binding_count: 1,
  holder_mismatch: false,
};

const BOX_ONE: WorkerInstanceListItem = {
  ...MAC,
  id: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0I03",
  name: "box-1",
  revision: 1,
  holder_mismatch: false,
};

function containerStatus(overrides: Partial<PlacementStatus> = {}): readonly PlacementStatus[] {
  return [
    {
      placement: "container",
      available: true,
      reason: null,
      detail: null,
      container_runtime: "podman",
      ...overrides,
    },
  ];
}

async function openSheet() {
  await userEvent.click(await screen.findByRole("button", { name: "Add instance" }));
  return screen.findByRole("dialog", { name: "Add instance" });
}

async function openWorkerSheet() {
  const sheet = await openSheet();
  await userEvent.click(within(sheet).getByRole("radio", { name: "Worker" }));
  return sheet;
}

function rowOf(list: HTMLElement, name: string): HTMLElement {
  const row = within(list)
    .getAllByRole("listitem")
    .find((item) => within(item).queryByText(name) !== null);
  if (row === undefined) throw new Error(`No row for ${name}`);
  return row;
}

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
  vi.mocked(projectsApi.listProjects).mockResolvedValue([]);
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

  it("links the worker to its traces", async () => {
    mount();
    expect(await screen.findByRole("button", { name: "Traces" })).toHaveAttribute(
      "href",
      "/traces?worker_name=coder%401",
    );
  });

  it("opens the instance page from a row", async () => {
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Open mac-studio" }));
    expect(await screen.findByText("Instance page")).toBeInTheDocument();
  });

  it("offers Detach and a disabled Archive on an instance that a binding lists", async () => {
    mount();
    expect(await screen.findByRole("button", { name: "Detach mac-studio" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Archive mac-studio" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("offers Archive with Stop the live execution on an unlisted instance with a live execution", async () => {
    const registration: WorkerRegistrationRecord = {
      runtime_identity: "worker_registration_1",
      project_id: "prj-test",
      resource_identity: "worker:kanthord:coder@1",
      worker_name: "coder@1",
      instance: "coder-1",
      activity: "executing",
      draining: true,
      execution_id: "execution_a",
      registered: true,
      host: "kanthord",
      placement: "server",
    };
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([
      { ...CODER_ONE, binding_count: 0 },
    ]);
    vi.mocked(workersApi.listAllWorkerRegistrations).mockResolvedValue([registration]);
    vi.mocked(instancesApi.readWorkerInstance).mockResolvedValue({
      ...CODER_ONE,
      revision: 4,
      bindings: [],
      registrations: [registration],
      credentials: [],
    });
    vi.mocked(instancesApi.archiveWorkerInstance).mockResolvedValue({ ...CODER_ONE, ended_at: 9 });
    mount();
    const archive = await screen.findByRole("button", { name: "Archive coder-1" });
    expect(archive).not.toHaveAttribute("aria-disabled", "true");
    await userEvent.click(archive);
    const dialog = await screen.findByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Archive coder-1" });
    expect(confirm).toBeDisabled();
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Stop the live execution" }),
    );
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(instancesApi.archiveWorkerInstance).toHaveBeenCalledWith("coder-1", 4, {
        force: true,
      }),
    );
  });

  it("asks which binding to detach from when several bindings list the instance", async () => {
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([{ ...MAC, binding_count: 2 }]);
    vi.mocked(instancesApi.readWorkerInstance).mockResolvedValue({
      ...MAC,
      bindings: [
        { project_id: "prj-test", binding: "mac-main" },
        { project_id: "prj-b", binding: "mac-b" },
      ],
      registrations: [],
      credentials: [],
    });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Detach mac-studio" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      await within(dialog).findByRole("radio", { name: "All 2 bindings" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "mac-main of prj-test" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(projectsApi.writeBindingSet).not.toHaveBeenCalled();
  });

  it("moves the focus to Keep when the choice step closes", async () => {
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([{ ...MAC, binding_count: 2 }]);
    vi.mocked(instancesApi.readWorkerInstance).mockResolvedValue({
      ...MAC,
      bindings: [
        { project_id: "prj-test", binding: "mac-main" },
        { project_id: "prj-b", binding: "mac-b" },
      ],
      registrations: [],
      credentials: [],
    });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Detach mac-studio" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(await within(dialog).findByRole("radio", { name: "All 2 bindings" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Keep mac-studio" })).toHaveFocus(),
    );
  });

  it("keeps the focus on Archive when the read again finds a listing binding", async () => {
    vi.mocked(instancesApi.listWorkerInstances)
      .mockResolvedValueOnce([{ ...MAC, binding_count: 0 }])
      .mockResolvedValue([MAC]);
    vi.mocked(instancesApi.readWorkerInstance).mockResolvedValue({
      ...MAC,
      bindings: [{ project_id: "prj-test", binding: "mac-main" }],
      registrations: [],
      credentials: [],
    });
    mount();
    const archive = await screen.findByRole("button", { name: "Archive mac-studio" });
    await userEvent.click(archive);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Archive mac-studio" })).toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Archive mac-studio" })).toHaveFocus(),
    );
  });

  it("offers Remove on each binding row", async () => {
    vi.mocked(projectsApi.listWorkerBindings).mockResolvedValue([
      {
        id: "binding_1",
        project_id: "prj-test",
        name: "mac-main",
        kind: "worker",
        resource_identity: "worker:mac-main",
        revision: 1,
        config: { worker: "coder@1", worker_instances: ["mac-studio"] },
        created_at: 1,
        removed_at: null,
      },
    ]);
    mount();
    expect(await screen.findByRole("button", { name: "Remove mac-main" })).toBeEnabled();
  });

  it("lists an empty worker open, with no advanced trigger", async () => {
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([]);
    mount();
    expect(await screen.findByRole("heading", { name: "Instances" })).toBeInTheDocument();
    expect(screen.getByText("No instances.")).toBeInTheDocument();
    expect(screen.getByText("Add one to give this worker capacity.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add instance" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Advanced/ })).toBeNull();
  });

  it("lists the instances of every placement with a placement badge and no advanced trigger", async () => {
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([CODER_ONE, BOX_ONE]);
    mount();
    const list = await screen.findByRole("list", { name: "Instances" });
    const server = rowOf(list, "coder-1");
    const worker = rowOf(list, "box-1");
    expect(within(server).getByText("(v1)")).toBeInTheDocument();
    expect(within(server).getByText("server")).toBeInTheDocument();
    expect(within(worker).getByText("(v1)")).toBeInTheDocument();
    expect(within(worker).getByText("worker")).toBeInTheDocument();
    expect(within(server).getByText("Idle")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Advanced/ })).toBeNull();
  });

  it("shows the fingerprint and the connection at the worker placement only", async () => {
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([CODER_ONE, BOX_ONE]);
    mount();
    const list = await screen.findByRole("list", { name: "Instances" });
    const server = rowOf(list, "coder-1");
    const worker = rowOf(list, "box-1");
    expect(within(worker).getByText("SHA256:4l0bK2qPn8Yw…")).toBeInTheDocument();
    expect(within(worker).getByText("Connected · mac-studio.local")).toBeInTheDocument();
    expect(within(server).queryByText("Fingerprint")).toBeNull();
    expect(within(server).queryByText(/SHA256/)).toBeNull();
    expect(within(server).queryByText(/Connected|Not connected/)).toBeNull();
  });

  it("says that a server instance with no binding still runs", async () => {
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([
      { ...CODER_ONE, binding_count: 0 },
      BOX_ONE,
    ]);
    mount();
    const list = await screen.findByRole("list", { name: "Instances" });
    const notice = "Runs with no binding. Archive it to stop it.";
    expect(within(rowOf(list, "coder-1")).getByText(notice)).toBeInTheDocument();
    expect(within(rowOf(list, "box-1")).queryByText(notice)).toBeNull();
  });

  it("says that a container instance with no binding still runs", async () => {
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([
      { ...CODER_ONE, name: "pod-1", placement: "container", binding_count: 0 },
      BOX_ONE,
    ]);
    mount();
    const list = await screen.findByRole("list", { name: "Instances" });
    const notice = "Runs with no binding. Archive it to stop it.";
    expect(within(rowOf(list, "pod-1")).getByText(notice)).toBeInTheDocument();
    expect(within(rowOf(list, "box-1")).queryByText(notice)).toBeNull();
  });

  it("says nothing about a listed server instance", async () => {
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([CODER_ONE]);
    mount();
    await screen.findByRole("list", { name: "Instances" });
    expect(screen.queryByText("Runs with no binding. Archive it to stop it.")).toBeNull();
  });

  it("offers three placements in order and preselects Server", async () => {
    vi.mocked(workersApi.listWorkerPlacements).mockResolvedValue(containerStatus());
    mount();
    const sheet = await openSheet();
    const radios = within(sheet).getAllByRole("radio");
    expect(radios).toHaveLength(3);
    const names = ["Server", "Container", "Worker"];
    names.forEach((name, index) =>
      expect(within(sheet).getByRole("radio", { name })).toBe(radios[index]),
    );
    expect(within(sheet).getByRole("radio", { name: "Server" })).toBeChecked();
    expect(
      within(sheet).getByText("Built in. Runs the instance as a thread of the server."),
    ).toBeInTheDocument();
    expect(
      await within(sheet).findByText(
        "Runs the instance in its own container on the server host with Podman.",
      ),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText(
        "Runs the instance as a kanthord serve worker process on a machine that you manage.",
      ),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText("The instance keeps this choice. Add another instance to change it."),
    ).toBeInTheDocument();
  });

  it("drops the runtime from the container text when the runtime is unknown", async () => {
    vi.mocked(workersApi.listWorkerPlacements).mockResolvedValue(
      containerStatus({ container_runtime: null }),
    );
    mount();
    const sheet = await openSheet();
    expect(
      await within(sheet).findByText("Runs the instance in its own container on the server host."),
    ).toBeInTheDocument();
  });

  it("turns Container off while the placement list loads", async () => {
    vi.mocked(workersApi.listWorkerPlacements).mockReturnValue(new Promise(() => {}));
    mount();
    const sheet = await openSheet();
    expect(within(sheet).getByRole("radio", { name: "Container" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(sheet).getByText("Checking the server host…")).toBeInTheDocument();
  });

  it("turns Container off when the placement list fails", async () => {
    vi.mocked(workersApi.listWorkerPlacements).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    mount();
    const sheet = await openSheet();
    expect(
      await within(sheet).findByText(
        "Off. The check of the server host failed. Open this sheet again.",
      ),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole("radio", { name: "Container" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("turns Container off with the text of runtime_absent", async () => {
    vi.mocked(workersApi.listWorkerPlacements).mockResolvedValue(
      containerStatus({
        available: false,
        reason: "runtime_absent",
        container_runtime: null,
      }),
    );
    mount();
    const sheet = await openSheet();
    expect(
      await within(sheet).findByText(
        "Off. Install Podman or Docker on the server host, then open this sheet again.",
      ),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole("radio", { name: "Container" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("keeps Container on and adds the detail on runtime_failed", async () => {
    vi.mocked(workersApi.listWorkerPlacements).mockResolvedValue(
      containerStatus({
        available: false,
        reason: "runtime_failed",
        detail: "podman info exited with 125",
      }),
    );
    mount();
    const sheet = await openSheet();
    expect(
      await within(sheet).findByText(
        /Runs the instance in its own container on the server host with Podman\. podman info exited with 125\. Fix the container runtime of the server user, then open this sheet again\./,
      ),
    ).toBeInTheDocument();
    expect(within(sheet).getByRole("radio", { name: "Container" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("creates a server instance with no key input and no copy block", async () => {
    vi.mocked(instancesApi.createWorkerInstance).mockResolvedValue({
      ...CODER_ONE,
      name: "srv-01",
    });
    mount();
    const sheet = await openSheet();
    expect(within(sheet).queryByRole("combobox", { name: "Where does it run?" })).toBeNull();
    expect(within(sheet).queryByLabelText("Address")).toBeNull();
    await userEvent.type(within(sheet).getByLabelText("Name"), "srv-01");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create instance" }));

    await waitFor(() =>
      expect(instancesApi.createWorkerInstance).toHaveBeenCalledWith({
        name: "srv-01",
        worker: "coder@1",
        placement: "server",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Add instance" })).toBeNull());
    expect(screen.queryByText("The instance configuration shows only once.")).toBeNull();
  });

  it("creates a container instance with the container placement", async () => {
    vi.mocked(workersApi.listWorkerPlacements).mockResolvedValue(containerStatus());
    vi.mocked(instancesApi.createWorkerInstance).mockResolvedValue({
      ...CODER_ONE,
      name: "ctr-01",
      placement: "container",
    });
    mount();
    const sheet = await openSheet();
    await waitFor(() =>
      expect(within(sheet).getByRole("radio", { name: "Container" })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );
    await userEvent.click(within(sheet).getByRole("radio", { name: "Container" }));
    await userEvent.type(within(sheet).getByLabelText("Name"), "ctr-01");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create instance" }));

    await waitFor(() =>
      expect(instancesApi.createWorkerInstance).toHaveBeenCalledWith({
        name: "ctr-01",
        worker: "coder@1",
        placement: "container",
      }),
    );
  });

  it("shows the limit under Placement on a server_limit refusal", async () => {
    vi.mocked(instancesApi.createWorkerInstance).mockRejectedValue(
      new ApiError("conflict", "Refused.", 409, "worker.instance.server_limit", { limit: 16 }),
    );
    mount();
    const sheet = await openSheet();
    await userEvent.type(within(sheet).getByLabelText("Name"), "srv-17");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create instance" }));
    expect(
      await within(sheet).findByText(
        "This server runs 16 server instances, the limit. Archive one, or raise worker.server_instance_limit.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the reason text under Placement on a placement_unavailable refusal", async () => {
    vi.mocked(workersApi.listWorkerPlacements).mockResolvedValue(containerStatus());
    vi.mocked(instancesApi.createWorkerInstance).mockRejectedValue(
      new ApiError("conflict", "Refused.", 409, "worker.instance.placement_unavailable", {
        placement: "container",
        reason: "runtime_rootful",
      }),
    );
    mount();
    const sheet = await openSheet();
    await waitFor(() =>
      expect(within(sheet).getByRole("radio", { name: "Container" })).not.toHaveAttribute(
        "aria-disabled",
        "true",
      ),
    );
    await userEvent.click(within(sheet).getByRole("radio", { name: "Container" }));
    await userEvent.type(within(sheet).getByLabelText("Name"), "ctr-01");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create instance" }));
    expect(
      await within(sheet).findByText(
        "Podman runs as root on this host. Use rootless Podman or rootless Docker.",
      ),
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
    const sheet = await openWorkerSheet();
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
        placement: "worker",
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
    const sheet = await openWorkerSheet();
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
    const sheet = await openWorkerSheet();
    await waitFor(() => expect(workersApi.listWorkerPlacements).toHaveBeenCalled());
    await userEvent.click(within(sheet).getByRole("combobox", { name: "Where does it run?" }));
    await userEvent.click(await screen.findByRole("option", { name: "Container on this host" }));
    await waitFor(() =>
      expect(within(sheet).getByLabelText("Address")).toHaveValue("http://kanthord:31415"),
    );
  });

  it("shows the Podman steps of a container by default", async () => {
    vi.mocked(instancesApi.createWorkerInstance).mockResolvedValue({
      ...MAC,
      name: "box-01",
      revision: 1,
      instance_configuration: "eyJuYW1lIjoiYm94LTAxIn0",
    });
    mount();
    const sheet = await openWorkerSheet();
    await userEvent.type(within(sheet).getByLabelText("Name"), "box-01");
    await userEvent.click(within(sheet).getByRole("combobox", { name: "Where does it run?" }));
    await userEvent.click(await screen.findByRole("option", { name: "Container on this host" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Create instance" }));

    expect(
      await within(sheet).findByText("Run the instance: Container on this host with Podman"),
    ).toBeInTheDocument();
    expect(
      within(sheet).getByText("podman secret create kanthord-worker-box-01 -"),
    ).toBeInTheDocument();
    expect(within(sheet).queryByText(/--env-file/)).not.toBeInTheDocument();
  });

  it("shows the Docker steps of a container on a Docker choice", async () => {
    vi.mocked(instancesApi.createWorkerInstance).mockResolvedValue({
      ...MAC,
      name: "box-01",
      revision: 1,
      instance_configuration: "eyJuYW1lIjoiYm94LTAxIn0",
    });
    mount();
    const sheet = await openWorkerSheet();
    await userEvent.type(within(sheet).getByLabelText("Name"), "box-01");
    await userEvent.click(within(sheet).getByRole("combobox", { name: "Where does it run?" }));
    await userEvent.click(await screen.findByRole("option", { name: "Linux (systemd)" }));
    expect(
      within(sheet).queryByRole("combobox", { name: "Container runtime" }),
    ).not.toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("combobox", { name: "Where does it run?" }));
    await userEvent.click(await screen.findByRole("option", { name: "Container on this host" }));
    const runtime = within(sheet).getByRole("combobox", { name: "Container runtime" });
    expect(runtime).toHaveTextContent("Podman");
    await userEvent.click(runtime);
    await userEvent.click(await screen.findByRole("option", { name: "Docker" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Create instance" }));

    expect(
      await within(sheet).findByText("Run the instance: Container on this host with Docker"),
    ).toBeInTheDocument();
    expect(within(sheet).getByText(/--env-file box-01\.env/)).toBeInTheDocument();
    expect(within(sheet).getByText("rm box-01.env")).toBeInTheDocument();
    expect(within(sheet).queryByText(/podman secret create/)).not.toBeInTheDocument();
  });

  it("refuses a reserved name before the call and maps a taken name to the field", async () => {
    vi.mocked(instancesApi.createWorkerInstance).mockRejectedValue(
      new ApiError("conflict", "The name is taken.", 409, "worker.instance.name_conflict"),
    );
    mount();
    const sheet = await openWorkerSheet();
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

describe("WorkerScreen polling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("reads the instances again every 15 s and shows a new connection", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([{ ...MAC, connection: null }]);
    mount();
    const list = await screen.findByRole("list", { name: "Instances" });
    expect(within(list).getAllByText("Not connected").length).toBeGreaterThan(0);
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([MAC]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_100);
    });

    expect(within(list).getByText("Connected · mac-studio.local")).toBeInTheDocument();
  });

  it("shows a failed poll above the last instances and clears it on the next poll", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mount();
    const list = await screen.findByRole("list", { name: "Instances" });
    vi.mocked(instancesApi.listWorkerInstances).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_100);
    });

    expect(screen.getByText("The daemon did not answer.")).toBeInTheDocument();
    expect(within(list).getByText("Connected · mac-studio.local")).toBeInTheDocument();
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([MAC]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_100);
    });

    expect(screen.queryByText("The daemon did not answer.")).not.toBeInTheDocument();
    expect(within(list).getByText("Connected · mac-studio.local")).toBeInTheDocument();
  });
});
