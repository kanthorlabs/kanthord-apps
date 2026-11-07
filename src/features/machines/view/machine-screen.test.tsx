import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as gatewayApi from "@/api/resources/gateway";
import * as projectsApi from "@/api/resources/projects";
import * as instancesApi from "@/api/resources/worker-instances";
import * as machinesApi from "@/api/resources/worker-machines";
import type {
  Project,
  WorkerInstanceDetail,
  WorkerMachineDetail,
  WorkerMachineInstance,
} from "@/api/types";

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
};

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
