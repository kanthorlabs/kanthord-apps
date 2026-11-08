import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as footprintApi from "@/api/resources/footprint";
import * as instancesApi from "@/api/resources/worker-instances";
import type {
  FootprintCandidate,
  FootprintKindRead,
  FootprintStat,
  WorkerInstanceListItem,
  WorkerPlacement,
} from "@/api/types";

vi.mock("@/api/resources/footprint");
vi.mock("@/api/resources/worker-instances");

import { FootprintKindScreen } from "./footprint-kind-screen";

const NOW = Date.now();
const DAY_MS = 86_400_000;
const MIB = 1_048_576;

function stat(fields: Partial<FootprintStat>): FootprintStat {
  return {
    kind: "trace",
    instance_name: null,
    item_key: null,
    instance_names: [],
    measured_at: NOW - 60_000,
    stale: false,
    measure_error: null,
    count: 3,
    bytes: 3 * MIB,
    wal_bytes: null,
    free_bytes: null,
    total_bytes: null,
    oldest_at: null,
    newest_at: null,
    growth_per_day: null,
    days_to_floor: null,
    thresholds: [],
    alert: { state: "ok", alert_id: null },
    delete_operation: null,
    rules: [],
    candidates: null,
    ...fields,
  };
}

function candidate(key: string, fields: Partial<FootprintCandidate> = {}): FootprintCandidate {
  return {
    key,
    at: NOW - 40 * DAY_MS,
    bytes: MIB,
    project_id: null,
    node_id: null,
    execution_id: null,
    refusal: null,
    kept: false,
    ...fields,
  };
}

function instance(name: string, placement: WorkerPlacement): WorkerInstanceListItem {
  return {
    id: `worker_instance_${name}`,
    name,
    worker: "coder@1",
    placement,
    machine: null,
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

const SESSION = stat({
  kind: "session",
  instance_name: "mac-studio",
  delete_operation: "worker.instance.session.delete",
  rules: ["older_than"],
});

const BACKUP = stat({
  kind: "database_backup",
  delete_operation: "footprint.backup.delete",
  rules: ["older_than"],
});

function serve(read: FootprintKindRead) {
  vi.mocked(footprintApi.readFootprintKind).mockResolvedValue(read);
}

function serveCandidates(items: readonly FootprintCandidate[]) {
  vi.mocked(footprintApi.listFootprintCandidatePage).mockResolvedValue({
    items,
    next_cursor: null,
    total_count: items.length,
    total_bytes: items.length * MIB,
    bytes_estimated: false,
  });
}

function mount(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/footprint/:kind" element={<FootprintKindScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(footprintApi.createFootprintCleanup).mockReset();
  vi.mocked(instancesApi.listWorkerInstances).mockResolvedValue([
    instance("mac-studio", "worker"),
    instance("coder-1", "server"),
    instance("builder-1", "container"),
  ]);
  vi.mocked(footprintApi.listFootprintItemPage).mockResolvedValue({ items: [], next_cursor: null });
  serveCandidates([]);
});

describe("FootprintKindScreen", () => {
  it("builds the rule picker from the rules of the kind with the age field", async () => {
    serve({
      stats: [
        stat({
          kind: "environment",
          delete_operation: "project.environment.delete",
          rules: ["unbound", "superseded"],
        }),
      ],
      tables: null,
    });
    mount("/footprint/environment");

    await userEvent.click(await screen.findByRole("combobox", { name: "Rule" }));
    const options = (await screen.findAllByRole("option")).map((option) => option.textContent);
    expect(options).toEqual([
      "Not bound to a project",
      "Superseded by a newer one",
      "Pick from every item",
    ]);
    expect(screen.queryByLabelText("Older than (days)")).not.toBeInTheDocument();
  });

  it("reads the candidates with the default age of 30 days", async () => {
    serve({ stats: [SESSION], tables: null });
    mount("/footprint/session?instance=mac-studio");

    expect(await screen.findByLabelText("Older than (days)")).toHaveValue("30");
    await waitFor(() =>
      expect(footprintApi.listFootprintCandidatePage).toHaveBeenCalledWith(
        "session",
        { instance_name: "mac-studio", rule: { name: "older_than", older_than_days: 30 } },
        null,
        50,
      ),
    );
  });

  it("selects all candidates of the rule", async () => {
    const items = [
      candidate("execution_01J9ZQ4XKM3B6V8N2R5T7W0AB1"),
      candidate("execution_01J9ZQ4XKM3B6V8N2R5T7W0AB2"),
    ];
    serve({ stats: [SESSION], tables: null });
    serveCandidates(items);
    vi.mocked(footprintApi.listAllFootprintCandidates).mockResolvedValue(items);
    mount("/footprint/session?instance=mac-studio");

    await userEvent.click(await screen.findByRole("button", { name: "Select all 2" }));

    expect(await screen.findByText("2 items selected")).toBeInTheDocument();
    for (const box of screen.getAllByRole("checkbox")) expect(box).toBeChecked();
  });

  it("shows a refused key with its reason and no checkbox", async () => {
    serve({ stats: [SESSION], tables: null });
    vi.mocked(footprintApi.listFootprintItemPage).mockResolvedValue({
      items: [candidate("execution_01J9ZQ4XKM3B6V8N2R5T7W0AB1", { refusal: "live" })],
      next_cursor: null,
    });
    mount("/footprint/session?instance=mac-studio");

    await userEvent.click(await screen.findByRole("combobox", { name: "Rule" }));
    await userEvent.click(await screen.findByRole("option", { name: "Pick from every item" }));

    expect(await screen.findByText("In use by a running execution.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows a kept backup with no checkbox", async () => {
    serve({ stats: [BACKUP], tables: null });
    vi.mocked(footprintApi.listFootprintItemPage).mockResolvedValue({
      items: [
        candidate("kanthord.db.bak-20260901T101500"),
        candidate("kanthord.db.bak-20261020T120000", { kept: true }),
      ],
      next_cursor: null,
    });
    mount("/footprint/database_backup");

    await userEvent.click(await screen.findByRole("combobox", { name: "Rule" }));
    await userEvent.click(await screen.findByRole("option", { name: "Pick from every item" }));

    expect(await screen.findByText("Kept: the newest backup of this file.")).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(1);
    expect(
      screen.getByRole("checkbox", { name: "Select kanthord.db.bak-20260901T101500" }),
    ).toBeInTheDocument();
  });

  it("links the breakdown rows to their owner paths", async () => {
    serve({
      stats: [stat({ kind: "operational_database" })],
      tables: [
        {
          name: "mission_evidence",
          bytes: MIB,
          oldest_at: null,
          delete_operation: "mission.evidence.delete",
        },
        {
          name: "intake_inbound_event",
          bytes: MIB,
          oldest_at: NOW,
          delete_operation: "intake.inbound.event.delete",
        },
        {
          name: "intake_outbound_request",
          bytes: null,
          oldest_at: null,
          delete_operation: "intake.outbound.request.delete",
        },
      ],
    });
    mount("/footprint/operational_database");

    const tables = await screen.findByRole("list", { name: "Tables" });
    expect(within(tables).getByRole("link", { name: "Open Projects" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(
      within(tables).getByText("Delete inbound events with kanthord intake event delete."),
    ).toBeInTheDocument();
    expect(
      within(tables).getByText("Delete outbound requests with kanthord intake outbound delete."),
    ).toBeInTheDocument();
    expect(within(tables).getByText("Not measured")).toBeInTheDocument();
  });

  it("names the owner path of log", async () => {
    serve({ stats: [stat({ kind: "log", item_key: "kanthord.log" })], tables: null });
    mount("/footprint/log");

    expect(
      await screen.findByText("The operator rotates kanthord.log. KanthorD rotates no log."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clean up" })).not.toBeInTheDocument();
  });

  it("names the owner path of slot_residue at each placement", async () => {
    serve({
      stats: [
        stat({ kind: "slot_residue", instance_name: "coder-1" }),
        stat({ kind: "slot_residue", instance_name: "builder-1" }),
        stat({ kind: "slot_residue", instance_name: "mac-studio" }),
      ],
      tables: null,
    });
    mount("/footprint/slot_residue");

    expect(
      await screen.findByText("The operator removes the files in <unit>/tmp on the host."),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Archive the instance to remove its slot.")).toHaveLength(1);
  });

  it("keeps Clean up visible and disabled with no selection and for a stale host", async () => {
    serve({ stats: [{ ...SESSION, stale: true }], tables: null });
    serveCandidates([candidate("execution_01J9ZQ4XKM3B6V8N2R5T7W0AB1")]);
    mount("/footprint/session?instance=mac-studio");

    const action = await screen.findByRole("button", { name: "Clean up" });
    expect(action).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText(
        "The measurement of this host is stale. Clean up waits for the next report of the host.",
      ),
    ).toBeInTheDocument();
  });

  it("sends rule null for a cleanup picked from every item", async () => {
    const key = "kanthord.db.bak-20260901T101500";
    serve({ stats: [BACKUP], tables: null });
    vi.mocked(footprintApi.listFootprintItemPage).mockResolvedValue({
      items: [candidate(key)],
      next_cursor: null,
    });
    mount("/footprint/database_backup");

    await userEvent.click(await screen.findByRole("combobox", { name: "Rule" }));
    await userEvent.click(await screen.findByRole("option", { name: "Pick from every item" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: `Select ${key}` }));
    await userEvent.click(screen.getByRole("button", { name: "Clean up" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete 1 item" }));

    await waitFor(() =>
      expect(footprintApi.createFootprintCleanup).toHaveBeenCalledWith({
        kind: "database_backup",
        instance_name: null,
        rule: null,
        keys: [key],
      }),
    );
  });

  it("disables Clean up above 1000 keys and names the safer path of the rule", async () => {
    const items = Array.from({ length: 1001 }, (_, index) =>
      candidate(`execution_01J9ZQ4XKM3B6V8N2R5T7W${String(index).padStart(4, "0")}`),
    );
    serve({ stats: [SESSION], tables: null });
    serveCandidates(items.slice(0, 2));
    vi.mocked(footprintApi.listAllFootprintCandidates).mockResolvedValue(items);
    mount("/footprint/session?instance=mac-studio");

    await userEvent.click(await screen.findByRole("button", { name: "Select all 2" }));

    expect(await screen.findByText("1001 items selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clean up" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(
      screen.getByText(
        "Select at most 1000 items. Narrow the set with a larger age, for example 60 days.",
      ),
    ).toBeInTheDocument();
  });

  it("leaves a stale instance out of the preset", async () => {
    const trace = stat({
      kind: "trace",
      delete_operation: "tracking.trace.delete",
      rules: ["older_than"],
    });
    vi.mocked(footprintApi.readFootprintKind).mockImplementation(async (kind) => ({
      stats:
        kind === "session"
          ? [SESSION, { ...SESSION, instance_name: "coder-1", stale: true }]
          : [trace],
      tables: null,
    }));
    vi.mocked(footprintApi.listAllFootprintCandidates).mockResolvedValue([]);
    mount("/footprint/trace");

    await userEvent.click(
      await screen.findByRole("button", { name: "Executions older than 30 days" }),
    );

    await waitFor(() =>
      expect(footprintApi.listAllFootprintCandidates).toHaveBeenCalledWith("session", {
        instance_name: "mac-studio",
        rule: { name: "older_than", older_than_days: 30 },
      }),
    );
    expect(footprintApi.listAllFootprintCandidates).not.toHaveBeenCalledWith(
      "session",
      expect.objectContaining({ instance_name: "coder-1" }),
    );
  });

  it("opens the dialog with the consequence after a selection", async () => {
    serve({ stats: [SESSION], tables: null });
    serveCandidates([candidate("execution_01J9ZQ4XKM3B6V8N2R5T7W0AB1")]);
    mount("/footprint/session?instance=mac-studio");

    const disabled = await screen.findByRole("button", { name: "Clean up" });
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Select execution_01J9ZQ4XKM3B6V8N2R5T7W0AB1" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Clean up" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Delete 1 agent session?")).toBeInTheDocument();
    expect(footprintApi.createFootprintCleanup).not.toHaveBeenCalled();
  });
});
