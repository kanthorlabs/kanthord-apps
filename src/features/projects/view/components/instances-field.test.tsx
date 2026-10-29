import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { WorkerInstanceListItem, WorkerPlacement } from "@/api/types";
import type { Resource } from "@/hooks/use-resource";
import { emptyDraft, type WorkerDraft } from "@/lib/binding-draft";
import { InstancesField } from "./instances-field";

const DRAIN = "A removed instance finishes its execution, then takes no new work of this binding.";

function instanceItem(name: string, placement: WorkerPlacement): WorkerInstanceListItem {
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
    connection: null,
    binding_count: 0,
    holder_mismatch: false,
  };
}

function resourceOf<T>(data: T): Resource<T> {
  return { data, error: null, loading: false, reload: vi.fn() };
}

function draftOf(instances: readonly string[]): WorkerDraft {
  return { ...(emptyDraft("worker") as WorkerDraft), worker: "coder@1", instances };
}

function renderField(
  options: {
    readonly instances?: readonly string[];
    readonly saved?: readonly string[];
    readonly error?: string;
    readonly onAdd?: () => void;
    readonly live?: readonly WorkerInstanceListItem[];
  } = {},
) {
  return render(
    <MemoryRouter>
      <InstancesField
        draft={draftOf(options.instances ?? [])}
        saved={options.saved ?? []}
        error={options.error}
        instances={resourceOf(
          options.live ?? [instanceItem("coder-1", "server"), instanceItem("box-1", "worker")],
        )}
        sharing={resourceOf([])}
        onAdd={options.onAdd ?? vi.fn()}
        onEdit={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("InstancesField", () => {
  it("reads each option as the name and the placement", () => {
    renderField();

    expect(screen.getByRole("button", { name: "coder-1 · server" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "box-1 · worker" })).toBeTruthy();
  });

  it("states that a removed instance finishes its execution", () => {
    renderField({ instances: ["coder-1"], saved: ["coder-1", "box-1"] });

    expect(screen.getByText(DRAIN)).toBeTruthy();
  });

  it("states no drain when the draft removes nothing", () => {
    renderField({ instances: ["coder-1", "box-1"], saved: ["coder-1"] });

    expect(screen.queryByText(DRAIN)).toBeNull();
  });

  it("opens the Add instance sheet beside Instances", async () => {
    const onAdd = vi.fn();
    renderField({ onAdd });

    await userEvent.click(screen.getByRole("button", { name: "Add instance" }));

    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("offers Add instance when the worker holds no live instance", async () => {
    const onAdd = vi.fn();
    renderField({ live: [], onAdd });

    await userEvent.click(screen.getByRole("button", { name: "Add instance" }));

    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("shows the error under Instances", () => {
    renderField({ error: "coder-1 already serves a of another project." });

    expect(screen.getByText("coder-1 already serves a of another project.")).toBeTruthy();
  });
});
