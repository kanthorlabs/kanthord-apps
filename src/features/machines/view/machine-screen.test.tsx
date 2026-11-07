import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as credentialsApi from "@/api/resources/credentials";
import * as gatewayApi from "@/api/resources/gateway";
import * as projectsApi from "@/api/resources/projects";
import * as instancesApi from "@/api/resources/worker-instances";
import * as machinesApi from "@/api/resources/worker-machines";
import type {
  CopyHealth,
  CredentialPlatformList,
  InstanceCredentialCopy,
  LlmCredential,
  Project,
  WorkerInstanceDetail,
  WorkerMachineDetail,
  WorkerMachineInstance,
} from "@/api/types";

vi.mock("@/api/resources/credentials");
vi.mock("@/api/resources/gateway");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/worker-instances");
vi.mock("@/api/resources/worker-machines");

import { MachineScreen } from "./machine-screen";

const PROJECTS: Project[] = [
  {
    id: "prj-a",
    name: "kanthord",
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: "/a",
  },
  {
    id: "prj-b",
    name: "atlas",
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: "/b",
  },
];

const MAC: WorkerMachineInstance = {
  id: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0I01",
  name: "mac-studio",
  worker: "coder@1",
  placement: "worker",
  machine: "lab-01",
  revision: 1,
  public_key: "a".repeat(43),
  fingerprint: "SHA256:4l0bK2qPn8YwVx3JmT7rUe6Hs1Dc9GfZaR5iLoQyWkE",
  created_at: 1,
  ended_at: null,
  connection: { connection_name: "mac-studio.local", connected_at: 1, last_heartbeat_at: 2 },
};

const BOX: WorkerMachineInstance = {
  ...MAC,
  id: "worker_instance_01J9ZQ4XKM3B6V8N2R5T7W0I02",
  name: "box-1",
  worker: "reviewer@1",
  connection: null,
};

const LAB: WorkerMachineDetail = {
  id: "worker_machine_01J9ZQ4XKM3B6V8N2R5T7W0M01",
  name: "lab-01",
  revision: 2,
  public_key: "b".repeat(43),
  fingerprint: "SHA256:Rm4Tq9Vx2Bn7Kc1Lw5Hd8Zs3Fg6Jy0Ua2Ei4Oo7Pp1",
  created_at: Date.UTC(2026, 9, 17, 9, 0),
  ended_at: null,
  instances: [MAC, BOX],
  credentials: [],
};

const REPORTED_AT = Date.UTC(2026, 9, 21, 8, 0);

const NO_REPORT: CopyHealth = {
  status: "unknown",
  capability: "model call",
  failure_reason: "held_by_instance",
  models: null,
  reported_at: null,
  reported_by: null,
};

const ROUTER_COPY: InstanceCredentialCopy = {
  name: "atlas-router",
  holder: "lab-01",
  revision: 2,
  platform: "openai-compatible",
  sealed_current: true,
  health: {
    status: "healthy",
    capability: "model-list read",
    failure_reason: null,
    models: [{ id: "qwen3-coder", owned_by: null, created: null }],
    reported_at: REPORTED_AT,
    reported_by: "mac-studio",
  },
};

const KEY_COPY: InstanceCredentialCopy = {
  name: "lab-key",
  holder: "lab-01",
  revision: 1,
  platform: "anthropic",
  sealed_current: true,
  health: {
    status: "unhealthy",
    capability: "model call",
    failure_reason: "unauthorized",
    models: null,
    reported_at: REPORTED_AT,
    reported_by: "box-1",
  },
};

const SUB_COPY: InstanceCredentialCopy = {
  name: "claude-sub",
  holder: "lab-01",
  revision: 3,
  platform: "anthropic-subscription",
  sealed_current: false,
  health: NO_REPORT,
};

const LIVE_SUB_COPY: InstanceCredentialCopy = {
  ...SUB_COPY,
  sealed_current: true,
  health: { ...NO_REPORT, reported_at: REPORTED_AT, reported_by: "mac-studio" },
};

const PLATFORMS: CredentialPlatformList = {
  items: [
    {
      platform: "anthropic",
      secret_shape: "api_key",
      login_modes: [],
      metadata_fields: [],
      verifiable: true,
    },
    {
      platform: "anthropic-subscription",
      secret_shape: "oauth",
      login_modes: ["browser", "copy_code"],
      metadata_fields: [],
      verifiable: false,
    },
    {
      platform: "openai-compatible",
      secret_shape: "api_key",
      login_modes: [],
      metadata_fields: ["base_url"],
      verifiable: true,
    },
  ],
};

const ROUTER_CREDENTIAL: LlmCredential = {
  name: "atlas-router",
  platform: "openai-compatible",
  holder: "lab-01",
  sealed_to: LAB.fingerprint,
  sealed_current: true,
  revisions: [
    {
      id: "r-router",
      revision: 2,
      metadata: { base_url: "https://router.example/v1", models: [{ id: "qwen3-coder" }] },
      created_at: 1,
      ended_at: null,
    },
  ],
  agent_providers: [],
};

function rowOf(credentials: HTMLElement, name: string): HTMLElement {
  const row = within(credentials)
    .getAllByRole("listitem")
    .find((item) => item.textContent?.includes(name));
  expect(row).toBeDefined();
  return row!;
}

function detailOf(
  instance: WorkerMachineInstance,
  bindings: WorkerInstanceDetail["bindings"],
): WorkerInstanceDetail {
  return { ...instance, bindings, registrations: [], credentials: [] };
}

function mount() {
  return render(
    <MemoryRouter initialEntries={["/machines/lab-01"]}>
      <Routes>
        <Route path="/machines/:machineName" element={<MachineScreen />} />
        <Route path="/machines" element={<p>Machine list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function serveBindings(bindings: Readonly<Record<string, WorkerInstanceDetail["bindings"]>>) {
  vi.mocked(instancesApi.readWorkerInstance).mockImplementation(async (name) =>
    detailOf(name === "box-1" ? BOX : MAC, bindings[name] ?? []),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(machinesApi.readWorkerMachine).mockResolvedValue(LAB);
  vi.mocked(projectsApi.listProjects).mockResolvedValue(PROJECTS);
  vi.mocked(gatewayApi.readServerVersion).mockResolvedValue("28.0.1");
  vi.mocked(credentialsApi.listCredentialPlatforms).mockResolvedValue(PLATFORMS);
  vi.mocked(credentialsApi.listAllCredentials).mockResolvedValue([]);
  vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([]);
  vi.mocked(machinesApi.listWorkerMachines).mockResolvedValue([]);
  serveBindings({});
});

describe("MachineScreen", () => {
  it("shows the header with the revision, the short fingerprint and the created time", async () => {
    mount();
    expect(await screen.findByRole("heading", { name: "lab-01" })).toBeInTheDocument();
    expect(screen.getByText("(v2)")).toBeInTheDocument();
    expect(screen.getByText("SHA256:Rm4Tq9Vx2Bn7…")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
    expect(screen.queryByText("Archived")).not.toBeInTheDocument();
    expect(machinesApi.readWorkerMachine).toHaveBeenCalledWith("lab-01");
  });

  it("lists the instances with the worker, the connection line and a link to each page", async () => {
    mount();
    const list = await screen.findByRole("list", { name: "Instances" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText("mac-studio")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("coder@1")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("Connected · mac-studio.local")).toBeInTheDocument();
    expect(within(rows[0]!).getByRole("button", { name: "Open mac-studio" })).toHaveAttribute(
      "href",
      "/workers/coder%401/instances/mac-studio",
    );
    expect(within(rows[1]!).getByText("Not connected")).toBeInTheDocument();
    expect(within(rows[1]!).getByRole("button", { name: "Open box-1" })).toHaveAttribute(
      "href",
      "/workers/reviewer%401/instances/box-1",
    );
  });

  it("tells that no instance names the machine and offers Archive", async () => {
    vi.mocked(machinesApi.readWorkerMachine).mockResolvedValue({ ...LAB, instances: [] });
    mount();
    expect(await screen.findByText("No instance names this machine.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeEnabled();
  });

  it("shows a failed read with Retry and a link to the list", async () => {
    vi.mocked(machinesApi.readWorkerMachine).mockRejectedValue(
      new ApiError("not_found", "The machine does not exist.", 404, "worker.machine.not_found"),
    );
    mount();
    expect(await screen.findByText("The machine does not exist.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open machines" })).toHaveAttribute(
      "href",
      "/machines",
    );
  });

  it("holds Reset key and Archive in the danger zone", async () => {
    mount();
    await screen.findByRole("heading", { name: "lab-01" });
    const zone = screen.getByRole("region", { name: "Danger zone" });
    expect(within(zone).getByRole("button", { name: "Reset key" })).toBeEnabled();
    expect(within(zone).getByRole("button", { name: "Archive" })).toBeInTheDocument();
  });

  it("shows no danger zone for an archived machine", async () => {
    vi.mocked(machinesApi.readWorkerMachine).mockResolvedValue({ ...LAB, ended_at: 5 });
    mount();
    expect(await screen.findAllByText("Archived")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Reset key" })).not.toBeInTheDocument();
  });
});

describe("MachineScreen Reset key", () => {
  async function openReset() {
    await userEvent.click(await screen.findByRole("button", { name: "Reset key" }));
    return screen.findByRole("alertdialog");
  }

  async function chooseKind(dialog: HTMLElement, name: string) {
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Where does it run?" }));
    await userEvent.click(await screen.findByRole("option", { name }));
  }

  it("lists the instances and states the recovery text", async () => {
    mount();
    const dialog = await openReset();
    const list = within(dialog).getByRole("list", { name: "Instances of the machine" });
    expect(within(list).getByRole("link", { name: "mac-studio" })).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "box-1" })).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "Each instance of this machine then fails to open the machine credentials. Deliver the new configuration with the machine copy block of the host kind. Then sign in again for each machine credential, and rotate each API key at its provider.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Reset key" })).toBeDisabled();
  });

  it("shows the machine copy block of the chosen host kind before the confirmation", async () => {
    mount();
    const dialog = await openReset();
    expect(within(dialog).queryByText(/Deliver the machine configuration/)).not.toBeInTheDocument();
    await chooseKind(dialog, "Container on this host");
    expect(
      within(dialog).getByText("podman secret create --replace kanthord-machine-lab-01 -"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Remove and run each instance container again with its copy block."),
    ).toBeInTheDocument();
    expect(machinesApi.rotateWorkerMachineKey).not.toHaveBeenCalled();
  });

  it("sends expected_revision and shows the new configuration once with the copy block", async () => {
    vi.mocked(machinesApi.rotateWorkerMachineKey).mockResolvedValue({
      ...LAB,
      revision: 3,
      machine_configuration: "eyJuZXciOnRydWV9",
    });
    mount();
    const dialog = await openReset();
    await chooseKind(dialog, "Container on this host");
    await userEvent.click(within(dialog).getByRole("button", { name: "Reset key" }));
    await waitFor(() =>
      expect(machinesApi.rotateWorkerMachineKey).toHaveBeenCalledWith("lab-01", 2),
    );
    expect(await within(dialog).findByText("eyJuZXciOnRydWV9")).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Copy the machine configuration" }),
    ).toBeVisible();
    expect(
      within(dialog).getByText("The machine configuration shows only once."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("podman secret create --replace kanthord-machine-lab-01 -"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Remove and run each instance container again with its copy block."),
    ).toBeInTheDocument();
  });

  it("shows the Docker rewrite and the recreate text", async () => {
    vi.mocked(machinesApi.rotateWorkerMachineKey).mockResolvedValue({
      ...LAB,
      revision: 3,
      machine_configuration: "eyJuZXciOnRydWV9",
    });
    mount();
    const dialog = await openReset();
    await chooseKind(dialog, "Container on this host");
    await userEvent.click(within(dialog).getByRole("combobox", { name: "Container runtime" }));
    await userEvent.click(await screen.findByRole("option", { name: "Docker" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Reset key" }));
    expect(await within(dialog).findByText(/Rewrite kanthord-machine-lab-01\.env\./)).toBeVisible();
    expect(
      within(dialog).getByText(
        "Then recreate each instance container through the instance copy block of an instance Reset key, because the instance env file is gone.",
      ),
    ).toBeInTheDocument();
  });

  it("keeps no configuration after Done and reads the machine again", async () => {
    vi.mocked(machinesApi.rotateWorkerMachineKey).mockResolvedValue({
      ...LAB,
      revision: 3,
      machine_configuration: "eyJuZXciOnRydWV9",
    });
    mount();
    const dialog = await openReset();
    await chooseKind(dialog, "Linux (systemd)");
    await userEvent.click(within(dialog).getByRole("button", { name: "Reset key" }));
    await userEvent.click(await within(dialog).findByRole("button", { name: "Done" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.queryByText("eyJuZXciOnRydWV9")).not.toBeInTheDocument();
    expect(machinesApi.readWorkerMachine).toHaveBeenCalledTimes(2);
  });

  it("shows the live revision of a revision conflict and reads the machine again", async () => {
    vi.mocked(machinesApi.rotateWorkerMachineKey).mockRejectedValue(
      new ApiError("conflict", "Conflict.", 409, "worker.machine.revision_conflict", {
        revision: 4,
      }),
    );
    mount();
    const dialog = await openReset();
    await chooseKind(dialog, "Linux (systemd)");
    await userEvent.click(within(dialog).getByRole("button", { name: "Reset key" }));
    expect(
      await within(dialog).findByText(
        /The machine changed after this page read it\. The live revision is 4\./,
      ),
    ).toBeInTheDocument();
    expect(machinesApi.readWorkerMachine).toHaveBeenCalledTimes(2);
  });
});

describe("MachineScreen Archive", () => {
  it("stays disabled while a live instance names the machine and lists the instances", async () => {
    mount();
    const zone = await screen.findByRole("region", { name: "Danger zone" });
    const archive = within(zone).getByRole("button", { name: "Archive" });
    expect(archive).toHaveAttribute("aria-disabled", "true");
    const list = within(zone).getByRole("list", { name: "Live instances" });
    expect(within(list).getByRole("link", { name: "mac-studio" })).toBeInTheDocument();
    expect(within(list).getByRole("link", { name: "box-1" })).toBeInTheDocument();
  });

  it("ignores an archived instance", async () => {
    vi.mocked(machinesApi.readWorkerMachine).mockResolvedValue({
      ...LAB,
      instances: [{ ...MAC, ended_at: 9 }],
    });
    mount();
    expect(await screen.findByRole("button", { name: "Archive" })).toBeEnabled();
    expect(screen.queryByRole("list", { name: "Live instances" })).not.toBeInTheDocument();
  });

  it("archives with expected_revision after a confirmation and returns to the list", async () => {
    vi.mocked(machinesApi.readWorkerMachine).mockResolvedValue({ ...LAB, instances: [] });
    vi.mocked(machinesApi.archiveWorkerMachine).mockResolvedValue({ ...LAB, ended_at: 9 });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Archive lab-01" }));
    await waitFor(() => expect(machinesApi.archiveWorkerMachine).toHaveBeenCalledWith("lab-01", 2));
    expect(await screen.findByText("Machine list")).toBeInTheDocument();
  });

  it("shows the instances of an in_use refusal", async () => {
    vi.mocked(machinesApi.readWorkerMachine).mockResolvedValue({ ...LAB, instances: [] });
    vi.mocked(machinesApi.archiveWorkerMachine).mockRejectedValue(
      new ApiError("conflict", "In use.", 409, "worker.machine.in_use", {
        instances: ["late-1"],
      }),
    );
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Archive" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Archive lab-01" }));
    expect(
      await within(dialog).findByText(
        "A live instance names the machine. Archive each instance first. Instances: late-1.",
      ),
    ).toBeInTheDocument();
  });
});

describe("MachineScreen reach notice", () => {
  it("names both projects when the instances serve two projects", async () => {
    serveBindings({
      "mac-studio": [{ project_id: "prj-a", binding: "mac-main" }],
      "box-1": [{ project_id: "prj-b", binding: "box-main" }],
    });
    mount();
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "lab-01 serves kanthord and atlas through its instances. A tool of either project can read the machine key and its credentials.",
      ),
    );
    expect(instancesApi.readWorkerInstance).toHaveBeenCalledWith("mac-studio");
    expect(instancesApi.readWorkerInstance).toHaveBeenCalledWith("box-1");
  });

  it("shows no notice for one project", async () => {
    serveBindings({
      "mac-studio": [{ project_id: "prj-a", binding: "mac-main" }],
      "box-1": [{ project_id: "prj-a", binding: "box-main" }],
    });
    mount();
    await waitFor(() => expect(projectsApi.listProjects).toHaveBeenCalled());
    await screen.findByRole("heading", { name: "lab-01" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a failed read of the projects with Retry", async () => {
    vi.mocked(projectsApi.listProjects).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    mount();
    expect(await screen.findByText("The daemon did not answer.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(projectsApi.listProjects).toHaveBeenCalledTimes(2));
  });
});

describe("MachineScreen at 390 px", () => {
  it("keeps one column with the same information and actions", async () => {
    window.innerWidth = 390;
    mount();
    const heading = await screen.findByRole("heading", { name: "lab-01" });
    expect(heading.closest("section")?.parentElement).toHaveClass("flex-col");
    expect(screen.getByText("SHA256:Rm4Tq9Vx2Bn7…")).toBeVisible();
    expect(screen.getByRole("list", { name: "Instances" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Reset key" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Archive" })).toBeVisible();
  });
});

describe("MachineScreen Credentials", () => {
  function serveCopies(copies: readonly InstanceCredentialCopy[]) {
    vi.mocked(machinesApi.readWorkerMachine).mockResolvedValue({ ...LAB, credentials: copies });
  }

  it("lists each copy with its line, its health line and the four actions", async () => {
    serveCopies([ROUTER_COPY, KEY_COPY, LIVE_SUB_COPY]);
    mount();
    expect(await screen.findByRole("heading", { name: "Credentials" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add credential" })).toBeEnabled();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    expect(within(credentials).getAllByRole("listitem")).toHaveLength(3);
    const router = rowOf(credentials, "atlas-router");
    expect(router).toHaveTextContent("atlas-router · openai-compatible (v2)");
    expect(router).toHaveTextContent("Reported by mac-studio at 2026-10-21 08:00 UTC.");
    expect(router).not.toHaveTextContent("Own copy");
    expect(await within(router).findByRole("button", { name: "Edit models" })).toBeEnabled();
    expect(within(router).getByRole("button", { name: "Rotate" })).toBeEnabled();
    const key = rowOf(credentials, "lab-key");
    expect(key).toHaveTextContent(
      "The provider refused the API key or the access token. Rotate the copy with a correct key, or sign in again. The instance checks the copy again after the write. Reported by box-1 at 2026-10-21 08:00 UTC.",
    );
    expect(within(key).getByRole("button", { name: "Rotate" })).toBeEnabled();
    expect(
      await within(rowOf(credentials, "claude-sub")).findByRole("button", {
        name: "Sign in again",
      }),
    ).toBeInTheDocument();
  });

  it("tells that no instance reported a copy since the server start", async () => {
    serveCopies([{ ...ROUTER_COPY, health: NO_REPORT }]);
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    expect(rowOf(credentials, "atlas-router")).toHaveTextContent(
      "No report from lab-01 for this revision since the server start.",
    );
  });

  it("tells that no copy exists", async () => {
    mount();
    expect(await screen.findByText("No credential copies.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add credential" })).toBeEnabled();
  });

  it("offers no copy action and no Add credential on an archived machine", async () => {
    vi.mocked(machinesApi.readWorkerMachine).mockResolvedValue({
      ...LAB,
      ended_at: 5,
      credentials: [KEY_COPY],
    });
    mount();
    await screen.findByRole("list", { name: "Credentials" });
    expect(screen.queryByRole("button", { name: "Add credential" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rotate" })).not.toBeInTheDocument();
  });

  it("adds a copy with the machine as holder", async () => {
    vi.mocked(credentialsApi.createCredential).mockResolvedValue({
      ...ROUTER_CREDENTIAL,
      name: "claude-key",
    });
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Add credential" }));
    const sheet = await screen.findByRole("dialog", { name: "Add credential" });
    expect(sheet).toHaveTextContent("held by lab-01");
    await userEvent.type(within(sheet).getByLabelText("Name"), "claude-key");
    await userEvent.click(within(sheet).getByRole("combobox", { name: "Platform" }));
    await userEvent.click(await screen.findByRole("option", { name: "anthropic" }));
    await userEvent.type(within(sheet).getByLabelText("API Key"), "sk-1");
    await userEvent.click(within(sheet).getByRole("button", { name: "Create credential" }));
    await waitFor(() =>
      expect(credentialsApi.createCredential).toHaveBeenCalledWith("llm", {
        name: "claude-key",
        platform: "anthropic",
        metadata: null,
        secret: { key: "sk-1" },
        holders: ["lab-01"],
      }),
    );
  });

  it("lists the other machines and the worker instances in Also seal to", async () => {
    vi.mocked(machinesApi.listWorkerMachines).mockResolvedValue([
      {
        id: LAB.id,
        name: "lab-01",
        revision: 2,
        public_key: LAB.public_key,
        fingerprint: LAB.fingerprint,
        created_at: 1,
        ended_at: null,
        instance_count: 2,
      },
      {
        id: "worker_machine_02",
        name: "rack-02",
        revision: 1,
        public_key: LAB.public_key,
        fingerprint: LAB.fingerprint,
        created_at: 1,
        ended_at: null,
        instance_count: 0,
      },
    ]);
    vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([
      { ...MAC, binding_count: 0, holder_mismatch: false },
    ]);
    mount();
    await userEvent.click(await screen.findByRole("button", { name: "Add credential" }));
    const sheet = await screen.findByRole("dialog", { name: "Add credential" });
    await userEvent.type(within(sheet).getByLabelText("Name"), "claude-key");
    await userEvent.click(within(sheet).getByRole("combobox", { name: "Platform" }));
    await userEvent.click(await screen.findByRole("option", { name: "anthropic" }));
    const machines = await within(sheet).findByRole("group", { name: "Also seal to Machines" });
    expect(within(machines).getByRole("button", { name: "rack-02" })).toBeInTheDocument();
    expect(within(machines).queryByRole("button", { name: "lab-01" })).not.toBeInTheDocument();
    expect(
      within(await within(sheet).findByRole("group", { name: "Also seal to coder@1" })).getByRole(
        "button",
        { name: "mac-studio" },
      ),
    ).toBeInTheDocument();
  });

  it("rotates a copy with the machine as holder", async () => {
    serveCopies([KEY_COPY]);
    vi.mocked(credentialsApi.rotateCredential).mockResolvedValue({
      ...ROUTER_CREDENTIAL,
      name: "lab-key",
    });
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    await userEvent.click(await within(credentials).findByRole("button", { name: "Rotate" }));
    const sheet = await screen.findByRole("dialog", { name: "Rotate lab-key" });
    expect(sheet).toHaveTextContent("held by lab-01");
    await userEvent.type(within(sheet).getByLabelText("API Key"), "sk-2");
    await userEvent.click(within(sheet).getByRole("button", { name: "Rotate secret" }));
    await waitFor(() =>
      expect(credentialsApi.rotateCredential).toHaveBeenCalledWith(
        "llm",
        "lab-key",
        { expected_revision: 1, secret: { key: "sk-2" } },
        "lab-01",
      ),
    );
  });

  it("edits the models of a copy with the machine as holder", async () => {
    serveCopies([ROUTER_COPY]);
    vi.mocked(credentialsApi.readCredential).mockResolvedValue(ROUTER_CREDENTIAL);
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    await userEvent.click(await within(credentials).findByRole("button", { name: "Edit models" }));
    expect(credentialsApi.readCredential).toHaveBeenCalledWith("llm", "atlas-router", "lab-01");
    expect(
      await screen.findByRole("dialog", { name: "Edit metadata of atlas-router on lab-01" }),
    ).toBeInTheDocument();
  });

  it("opens the sign-in panel on a copy that is not live and signs in on the machine", async () => {
    serveCopies([SUB_COPY]);
    vi.mocked(credentialsApi.startCredentialLogin).mockResolvedValue({
      session_id: "login_session_2",
      address: "https://claude.ai/oauth/authorize",
      code: null,
      expires_at: 99,
    });
    vi.mocked(credentialsApi.readCredentialLoginStatus).mockResolvedValue({
      session_id: "login_session_2",
      state: "pending",
      last_message: null,
      failure_reason: null,
    });
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    await userEvent.click(
      await within(credentials).findByRole("button", { name: "Sign in again" }),
    );
    const sheet = await screen.findByRole("dialog", { name: "Sign in again to claude-sub" });
    expect(sheet).toHaveTextContent("copy-code mode");
    await userEvent.click(within(sheet).getByRole("button", { name: "Start sign-in" }));
    await waitFor(() =>
      expect(credentialsApi.startCredentialLogin).toHaveBeenCalledWith({
        platform: "anthropic-subscription",
        name: "claude-sub",
        mode: "copy_code",
        holder: "lab-01",
      }),
    );
    expect(await within(sheet).findByLabelText("Paste code")).toBeInTheDocument();
  });

  it("explains the refusal of a sign-in when no instance of the machine is connected", async () => {
    serveCopies([SUB_COPY]);
    vi.mocked(credentialsApi.startCredentialLogin).mockRejectedValue(
      new ApiError(
        "conflict",
        "The worker instance holds no current connection.",
        409,
        "credential.login.instance_unavailable",
        { holder: "lab-01" },
      ),
    );
    mount();
    const credentials = await screen.findByRole("list", { name: "Credentials" });
    await userEvent.click(
      await within(credentials).findByRole("button", { name: "Sign in again" }),
    );
    const sheet = await screen.findByRole("dialog", { name: "Sign in again to claude-sub" });
    await userEvent.click(within(sheet).getByRole("button", { name: "Start sign-in" }));
    expect(
      await within(sheet).findByText(
        "No instance of lab-01 is connected. Start one instance of the machine, then sign in again.",
      ),
    ).toBeInTheDocument();
  });
});
