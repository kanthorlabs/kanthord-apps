import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as footprintApi from "@/api/resources/footprint";
import type { FootprintAlert, FootprintStat } from "@/api/types";

vi.mock("@/api/resources/footprint");

import { FootprintScreen } from "./footprint-screen";

const NOW = Date.now();
const MINUTE_MS = 60_000;
const GIB = 1_073_741_824;

function stat(fields: Partial<FootprintStat>): FootprintStat {
  return {
    kind: "trace",
    instance_name: null,
    item_key: null,
    instance_names: [],
    measured_at: NOW - 4 * MINUTE_MS,
    stale: false,
    measure_error: null,
    count: 10,
    bytes: GIB,
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

const ALERT: FootprintAlert = {
  alert_id: "alert_01J9ZQ4XKM3B6V8N2R5T7W0AB1",
  kind: "disk",
  instance_name: "mac-studio",
  item_key: "16777231",
  threshold: { measure: "days_to_floor", value: 30, free_ratio: 0.1 },
  value: 26.7,
  fired_at: NOW - 20 * MINUTE_MS,
  resolved_at: null,
  acknowledged_by: null,
  acknowledged_at: null,
  acknowledged_until: null,
  state: "firing",
};

function serve(stats: readonly FootprintStat[]) {
  vi.mocked(footprintApi.readFootprintSummary).mockResolvedValue({
    stats,
    open_alerts: 1,
    unacknowledged_alerts: 1,
  });
}

function Location() {
  const { pathname, search } = useLocation();
  return <p>{`At ${pathname}${search}`}</p>;
}

function mount() {
  render(
    <MemoryRouter initialEntries={["/footprint"]}>
      <Routes>
        <Route path="/footprint" element={<FootprintScreen />} />
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function rows() {
  const list = await screen.findByRole("list", { name: "Footprint statistics" });
  return within(list).getAllByRole("listitem");
}

beforeEach(() => {
  vi.mocked(footprintApi.listFootprintCleanupPage).mockResolvedValue({
    items: [],
    next_cursor: null,
  });
  vi.mocked(footprintApi.listFootprintAlertPage).mockResolvedValue({
    items: [ALERT],
    next_cursor: null,
  });
  vi.mocked(footprintApi.runFootprintMeasure).mockResolvedValue([]);
  vi.mocked(footprintApi.acknowledgeFootprintAlert).mockResolvedValue({
    ...ALERT,
    acknowledged_at: NOW,
  });
});

describe("FootprintScreen", () => {
  it("shows the stale notice of an instance with the bind and archive text", async () => {
    serve([
      stat({
        kind: "workspace",
        instance_name: "build-01",
        measured_at: NOW - 47 * MINUTE_MS,
        stale: true,
      }),
    ]);
    mount();

    expect(
      await screen.findByText(
        "Measured 47 min ago. The instance does not report. Bind the instance to clean its workspaces, or archive it to remove its slot.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the measure error and keeps the last values", async () => {
    serve([
      stat({
        kind: "disk",
        item_key: "container_runtime",
        bytes: null,
        measure_error: { code: "runtime_store_unmeasured", message: "The store is in a VM." },
      }),
    ]);
    mount();

    expect(
      await screen.findByText(/The last measurement failed: The store is in a VM\./),
    ).toBeInTheDocument();
    expect(screen.getByText("Disk · container runtime store")).toBeInTheDocument();
  });

  it("sorts the firing kinds first, then by size", async () => {
    serve([
      stat({ kind: "trace", bytes: 2 * GIB }),
      stat({ kind: "intake_mirror", bytes: 5 * GIB }),
      stat({
        kind: "workspace",
        instance_name: "mac-studio",
        bytes: GIB,
        alert: { state: "firing", alert_id: ALERT.alert_id },
      }),
    ]);
    mount();

    const items = await rows();
    const titles = items.map((row) => within(row).getAllByRole("button")[0]!.textContent);
    expect(titles).toEqual([
      "Node workspaces · mac-studio",
      "Intake mirrors · server",
      "Traces · server",
    ]);
    expect(within(items[0]!).getByText("Above threshold")).toBeInTheDocument();
  });

  it("marks the estimated candidate bytes of trace as about", async () => {
    serve([
      stat({
        candidates: {
          rule: { name: "older_than", older_than_days: 30 },
          count: 120,
          bytes: 2 * GIB,
          bytes_estimated: true,
        },
      }),
    ]);
    mount();

    expect(await screen.findByText("120 · about 2 GiB")).toBeInTheDocument();
  });

  it("shows the days to the floor of a disk", async () => {
    serve([
      stat({
        kind: "disk",
        instance_name: "mac-studio",
        item_key: "16777231",
        bytes: null,
        free_bytes: 260 * GIB,
        total_bytes: 1024 * GIB,
        days_to_floor: 26.7,
      }),
    ]);
    mount();

    expect(await screen.findByText("about 27 days")).toBeInTheDocument();
    expect(screen.getByText("260 GiB of 1 TiB")).toBeInTheDocument();
  });

  it("shows one row for each log file", async () => {
    serve([
      stat({ kind: "log", instance_name: "coder-1", item_key: "kanthord.log" }),
      stat({ kind: "log", instance_name: "coder-1", item_key: "stderr.log" }),
    ]);
    mount();

    expect(await rows()).toHaveLength(2);
    expect(screen.getByText("Logs · coder-1 · kanthord.log")).toBeInTheDocument();
    expect(screen.getByText("Logs · coder-1 · stderr.log")).toBeInTheDocument();
  });

  it("opens the kind screen of a row with its host", async () => {
    serve([stat({ kind: "workspace", instance_name: "mac-studio" })]);
    mount();

    await userEvent.click(
      await screen.findByRole("button", { name: "Open Node workspaces · mac-studio" }),
    );

    expect(screen.getByText("At /footprint/workspace?instance=mac-studio")).toBeInTheDocument();
  });

  it("measures now and acknowledges an open alert", async () => {
    serve([stat({})]);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Measure now" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Acknowledge Disk · mac-studio" }),
    );

    expect(footprintApi.runFootprintMeasure).toHaveBeenCalledTimes(1);
    expect(footprintApi.acknowledgeFootprintAlert).toHaveBeenCalledWith(ALERT.alert_id);
  });
});
