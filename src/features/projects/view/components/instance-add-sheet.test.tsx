import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { createWorkerInstance } from "@/api/resources/worker-instances";
import type { WorkerInstanceWriteAnswer } from "@/api/types";

vi.mock("@/api/resources/worker-instances");

import { useInstanceAdd } from "../use-instance-add";
import { InstanceAddSheet } from "./instance-add-sheet";

const onAdded = vi.fn();

function Harness() {
  const add = useInstanceAdd("coder@1", onAdded);
  return (
    <>
      <button type="button" onClick={add.start}>
        Open
      </button>
      <InstanceAddSheet worker="coder@1" add={add} />
    </>
  );
}

function answerOf(name: string, placement: "server" | "container"): WorkerInstanceWriteAnswer {
  return {
    id: `worker_instance_${name}`,
    name,
    worker: "coder@1",
    placement,
    revision: 1,
    public_key: null,
    fingerprint: null,
    created_at: 1,
    ended_at: null,
  };
}

async function openSheet() {
  render(
    <MemoryRouter>
      <Harness />
    </MemoryRouter>,
  );
  await userEvent.click(screen.getByRole("button", { name: "Open" }));
  return screen.findByRole("dialog");
}

describe("InstanceAddSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a server instance and reports its name", async () => {
    vi.mocked(createWorkerInstance).mockResolvedValue(answerOf("coder-3", "server"));
    await openSheet();

    await userEvent.type(screen.getByLabelText("Name"), "coder-3");
    await userEvent.click(screen.getByRole("button", { name: "Add instance" }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith("coder-3"));
    expect(createWorkerInstance).toHaveBeenCalledWith({
      name: "coder-3",
      worker: "coder@1",
      placement: "server",
    });
  });

  it("creates a container instance", async () => {
    vi.mocked(createWorkerInstance).mockResolvedValue(answerOf("builder-1", "container"));
    await openSheet();

    await userEvent.type(screen.getByLabelText("Name"), "builder-1");
    await userEvent.click(screen.getByRole("combobox", { name: "Placement" }));
    await userEvent.click(await screen.findByRole("option", { name: "Container" }));
    await userEvent.click(screen.getByRole("button", { name: "Add instance" }));

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith("builder-1"));
    expect(createWorkerInstance).toHaveBeenCalledWith({
      name: "builder-1",
      worker: "coder@1",
      placement: "container",
    });
  });

  it("links the worker page for the worker placement and sends nothing", async () => {
    await openSheet();

    await userEvent.type(screen.getByLabelText("Name"), "mac-1");
    await userEvent.click(screen.getByRole("combobox", { name: "Placement" }));
    await userEvent.click(await screen.findByRole("option", { name: "Worker" }));

    expect(
      screen.getByRole("link", { name: "Add a worker instance on the worker page" }),
    ).toHaveAttribute("href", "/workers/coder%401");
    expect(screen.queryByRole("button", { name: "Add instance" })).toBeNull();
    expect(createWorkerInstance).not.toHaveBeenCalled();
  });

  it("refuses an invalid name without a request", async () => {
    await openSheet();

    await userEvent.type(screen.getByLabelText("Name"), "Bad Name");
    await userEvent.click(screen.getByRole("button", { name: "Add instance" }));

    expect(
      await screen.findByText(
        "Start with a lowercase letter. Use only lowercase letters, digits and hyphens.",
      ),
    ).toBeTruthy();
    expect(createWorkerInstance).not.toHaveBeenCalled();
  });

  it("shows the refusal of the server and keeps the sheet open", async () => {
    vi.mocked(createWorkerInstance).mockRejectedValue(
      new ApiError(
        "conflict",
        "The server runs the most instances.",
        409,
        "worker.instance.server_limit",
      ),
    );
    await openSheet();

    await userEvent.type(screen.getByLabelText("Name"), "coder-3");
    await userEvent.click(screen.getByRole("button", { name: "Add instance" }));

    expect(await screen.findByText("The server runs the most instances.")).toBeTruthy();
    expect(onAdded).not.toHaveBeenCalled();
  });
});
