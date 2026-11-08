import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as gatewayApi from "@/api/resources/gateway";
import * as machinesApi from "@/api/resources/worker-machines";
import type { WorkerMachineWriteAnswer } from "@/api/types";

vi.mock("@/api/resources/gateway");
vi.mock("@/api/resources/worker-machines");

import { MachineFormScreen } from "./machine-form-screen";

const CREATED: WorkerMachineWriteAnswer = {
  id: "worker_machine_01J9ZQ4XKM3B6V8N2R5T7W0M01",
  name: "m-01",
  revision: 1,
  public_key: "b".repeat(43),
  fingerprint: "SHA256:Rm4Tq9Vx2Bn7Kc1Lw5Hd8Zs3Fg6Jy0Ua2Ei4Oo7Pp1",
  created_at: 1,
  ended_at: null,
  machine_configuration: "eyJtYWNoaW5lIjoibS0wMSJ9",
};

function mount() {
  return render(
    <MemoryRouter initialEntries={["/machines/new"]}>
      <Routes>
        <Route path="/machines/new" element={<MachineFormScreen />} />
        <Route path="/machines/:machineName" element={<p>Machine page</p>} />
        <Route path="/machines" element={<p>Machine list</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function chooseKind(name: string) {
  await userEvent.click(await screen.findByRole("combobox", { name: "Where does it run?" }));
  await userEvent.click(await screen.findByRole("option", { name }));
}

async function fillAndSubmit(name: string, kind: string) {
  await userEvent.type(await screen.findByLabelText("Name"), name);
  await chooseKind(kind);
  await userEvent.click(screen.getByRole("button", { name: "Create machine" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(gatewayApi.readServerVersion).mockResolvedValue("28.0.1");
  vi.mocked(machinesApi.createWorkerMachine).mockResolvedValue(CREATED);
});

describe("MachineFormScreen", () => {
  it("sends the name only and shows the configuration once with Copy and the notice", async () => {
    mount();
    await fillAndSubmit("m-01", "Linux (systemd)");
    await waitFor(() =>
      expect(machinesApi.createWorkerMachine).toHaveBeenCalledWith({ name: "m-01" }),
    );
    expect(await screen.findByText("eyJtYWNoaW5lIjoibS0wMSJ9")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy the machine configuration" })).toBeVisible();
    expect(screen.getByText("The machine configuration shows only once.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("shows the machine copy block of the host kind", async () => {
    mount();
    await fillAndSubmit("m-01", "Linux (systemd)");
    expect(
      await screen.findByText(
        /Install kanthord first, by steps 1 and 2 of the instance copy block/,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("kanthord worker machine join")).toBeInTheDocument();
    expect(screen.getByText(/release 28\.0\.1/)).toBeInTheDocument();
  });

  it("shows the Podman secret block of a container", async () => {
    mount();
    await fillAndSubmit("m-01", "Container on this host");
    expect(
      await screen.findByText("podman secret create kanthord-machine-m-01 -"),
    ).toBeInTheDocument();
  });

  it("shows the env file block of a Docker container", async () => {
    mount();
    await userEvent.type(await screen.findByLabelText("Name"), "m-01");
    await chooseKind("Container on this host");
    await userEvent.click(screen.getByRole("combobox", { name: "Container runtime" }));
    await userEvent.click(await screen.findByRole("option", { name: "Docker" }));
    await userEvent.click(screen.getByRole("button", { name: "Create machine" }));
    expect(
      await screen.findByText("(umask 077 && cat > kanthord-machine-m-01.env)"),
    ).toBeInTheDocument();
  });

  it("keeps no configuration after Done", async () => {
    mount();
    await fillAndSubmit("m-01", "macOS (foreground)");
    await userEvent.click(await screen.findByRole("button", { name: "Done" }));
    expect(await screen.findByText("Machine page")).toBeInTheDocument();
    expect(screen.queryByText("eyJtYWNoaW5lIjoibS0wMSJ9")).not.toBeInTheDocument();
  });

  it("refuses a reserved name before the request", async () => {
    mount();
    await fillAndSubmit("work", "Linux (systemd)");
    expect(
      await screen.findByText("The name work is reserved. Choose another name."),
    ).toBeInTheDocument();
    expect(machinesApi.createWorkerMachine).not.toHaveBeenCalled();
  });

  it("refuses a name that breaks the form before the request", async () => {
    mount();
    await fillAndSubmit("Mac", "Linux (systemd)");
    expect(
      await screen.findByText(
        "Start with a lowercase letter. Use only lowercase letters, digits and hyphens.",
      ),
    ).toBeInTheDocument();
    expect(machinesApi.createWorkerMachine).not.toHaveBeenCalled();
  });

  it("keeps Create machine off until the name and the host kind are set", async () => {
    mount();
    const create = await screen.findByRole("button", { name: "Create machine" });
    expect(create).toBeDisabled();
    expect(
      screen.getByText("Fill Name and Where does it run? to create the machine."),
    ).toBeVisible();
    await userEvent.type(screen.getByLabelText("Name"), "m-01");
    await chooseKind("Linux (systemd)");
    expect(create).toBeEnabled();
  });

  it("maps a taken name to the Name field", async () => {
    vi.mocked(machinesApi.createWorkerMachine).mockRejectedValue(
      new ApiError("conflict", "Taken.", 409, "worker.machine.name_conflict"),
    );
    mount();
    await fillAndSubmit("m-01", "Linux (systemd)");
    expect(
      await screen.findByText(
        "The name is taken by a machine or an instance, live or archived. Choose another name.",
      ),
    ).toBeInTheDocument();
  });

  it("shows another refusal above the form", async () => {
    vi.mocked(machinesApi.createWorkerMachine).mockRejectedValue(
      new ApiError("refused", "Bad key.", 400, "worker.machine.key_invalid"),
    );
    mount();
    await fillAndSubmit("m-01", "Linux (systemd)");
    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("The machine was not created.")).toBeInTheDocument();
    expect(
      within(alert).getByText("The public key is not a valid X25519 key."),
    ).toBeInTheDocument();
  });

  it("reports a missing configuration in the answer", async () => {
    vi.mocked(machinesApi.createWorkerMachine).mockResolvedValue({
      ...CREATED,
      machine_configuration: undefined,
    });
    mount();
    await fillAndSubmit("m-01", "Linux (systemd)");
    expect(await screen.findByText(/answered no machine configuration/)).toBeInTheDocument();
  });

  it("keeps one column at 390 px", async () => {
    window.innerWidth = 390;
    mount();
    const form = await screen.findByRole("form", { name: "Add machine" });
    expect(form.firstElementChild).toHaveClass("flex-col");
    expect(within(form).getByLabelText("Name")).toBeVisible();
    expect(within(form).getByRole("button", { name: "Cancel" })).toBeVisible();
  });
});
