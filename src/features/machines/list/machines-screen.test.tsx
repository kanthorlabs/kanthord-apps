import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as machinesApi from "@/api/resources/worker-machines";
import type { WorkerMachineListItem } from "@/api/types";

vi.mock("@/api/resources/worker-machines");

import { MachinesScreen } from "./machines-screen";

const LAB: WorkerMachineListItem = {
  id: "worker_machine_01J9ZQ4XKM3B6V8N2R5T7W0M01",
  name: "lab-01",
  revision: 2,
  public_key: "b".repeat(43),
  fingerprint: "SHA256:Rm4Tq9Vx2Bn7Kc1Lw5Hd8Zs3Fg6Jy0Ua2Ei4Oo7Pp1",
  created_at: 1,
  ended_at: null,
  instance_count: 3,
};

function mount() {
  return render(
    <MemoryRouter>
      <MachinesScreen />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(machinesApi.listWorkerMachines).mockResolvedValue([
    LAB,
    { ...LAB, id: "worker_machine_2", name: "rack-02", revision: 1, instance_count: 0 },
  ]);
});

describe("MachinesScreen", () => {
  it("lists each machine with its revision, short fingerprint and instance count", async () => {
    mount();
    const list = await screen.findByRole("list", { name: "Machines" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText("lab-01")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("(v2)")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("SHA256:Rm4Tq9Vx2Bn7…")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("3")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("(v1)")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("0")).toBeInTheDocument();
  });

  it("links each row to the machine page", async () => {
    mount();
    const list = await screen.findByRole("list", { name: "Machines" });
    expect(within(list).getByRole("button", { name: "Open lab-01" })).toHaveAttribute(
      "href",
      "/machines/lab-01",
    );
    expect(within(list).getByRole("button", { name: "Open rack-02" })).toHaveAttribute(
      "href",
      "/machines/rack-02",
    );
  });

  it("offers Add machine as a link to the form", async () => {
    mount();
    expect(await screen.findByRole("button", { name: "Add machine" })).toHaveAttribute(
      "href",
      "/machines/new",
    );
  });

  it("tells that no machine exists", async () => {
    vi.mocked(machinesApi.listWorkerMachines).mockResolvedValue([]);
    mount();
    expect(
      await screen.findByText("No machines. Create the first one with Add machine."),
    ).toBeInTheDocument();
  });

  it("shows a failed read with Retry", async () => {
    vi.mocked(machinesApi.listWorkerMachines).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    mount();
    expect(await screen.findByText("The daemon did not answer.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps one column with the same information at 390 px", async () => {
    window.innerWidth = 390;
    mount();
    const region = await screen.findByRole("region", { name: "Machines" });
    expect(region).toHaveClass("flex-col");
    expect(screen.getByRole("button", { name: "Add machine" })).toBeInTheDocument();
    expect(within(region).getAllByText("SHA256:Rm4Tq9Vx2Bn7…")).toHaveLength(2);
    expect(within(region).getByRole("button", { name: "Open lab-01" })).toBeInTheDocument();
  });
});
