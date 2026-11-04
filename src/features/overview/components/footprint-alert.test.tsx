import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as footprintApi from "@/api/resources/footprint";
import type { FootprintAlert as FootprintAlertRecord, FootprintStat } from "@/api/types";
import { FootprintAlertsProvider } from "@/hooks/use-footprint-alerts";

vi.mock("@/api/resources/footprint");

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

import { FootprintAlert } from "./footprint-alert";

const GIB = 1_073_741_824;

function stat(fields: Partial<FootprintStat>): FootprintStat {
  return {
    kind: "workspace",
    instance_name: "e2e-coder-1",
    item_key: null,
    instance_names: [],
    measured_at: 1,
    stale: false,
    measure_error: null,
    count: 700,
    bytes: 235 * GIB,
    wal_bytes: null,
    free_bytes: null,
    total_bytes: null,
    oldest_at: null,
    newest_at: null,
    growth_per_day: { count: 17.5, bytes: 5.9 * GIB },
    days_to_floor: null,
    thresholds: [],
    alert: { state: "ok", alert_id: null },
    delete_operation: null,
    rules: [],
    candidates: null,
    ...fields,
  };
}

const DISK_ALERT: FootprintAlertRecord = {
  alert_id: "alert_01J9ZQ4XKM3B6V8N2R5T7W0AB1",
  kind: "disk",
  instance_name: "e2e-coder-1",
  item_key: "16777231",
  threshold: { measure: "days_to_floor", value: 30, free_ratio: 0.1 },
  value: 26.7,
  fired_at: 1,
  resolved_at: null,
  acknowledged_by: null,
  acknowledged_at: null,
  acknowledged_until: null,
  state: "firing",
};

const TRACE_ALERT: FootprintAlertRecord = {
  ...DISK_ALERT,
  alert_id: "alert_01J9ZQ4XKM3B6V8N2R5T7W0AB2",
  kind: "trace",
  instance_name: null,
  item_key: null,
  threshold: { measure: "bytes", value: 8 * GIB },
  value: 9 * GIB,
  acknowledged_by: { kind: "human", account: "ulrich", name: "ulrich" },
  acknowledged_at: 2,
  acknowledged_until: 18 * GIB,
};

const STATS: readonly FootprintStat[] = [
  stat({}),
  stat({ kind: "session", growth_per_day: { count: 30, bytes: 4_000_000 } }),
  stat({
    kind: "disk",
    item_key: "16777231",
    bytes: null,
    count: null,
    free_bytes: 260 * GIB,
    total_bytes: 1024 * GIB,
    days_to_floor: 26.7,
    growth_per_day: null,
  }),
  stat({ kind: "trace", instance_name: null, bytes: 9 * GIB, growth_per_day: null }),
];

function serve(alerts: readonly FootprintAlertRecord[]) {
  vi.mocked(footprintApi.readFootprintSummary).mockResolvedValue({
    stats: STATS,
    open_alerts: alerts.length,
    unacknowledged_alerts: 1,
  });
  vi.mocked(footprintApi.listFootprintAlertPage).mockResolvedValue({
    items: [...alerts],
    next_cursor: null,
  });
}

function Location() {
  const { pathname, search } = useLocation();
  return <p>{`At ${pathname}${search}`}</p>;
}

function mount() {
  render(
    <FootprintAlertsProvider>
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route index element={<FootprintAlert />} />
          <Route path="*" element={<Location />} />
        </Routes>
      </MemoryRouter>
    </FootprintAlertsProvider>,
  );
}

const DISK_TEXT =
  "The disk of e2e-coder-1 reaches 10% free in about 27 days. Node workspaces grow about 5.9 GiB a day. Review the candidates.";

beforeEach(() => {
  serve([DISK_ALERT, TRACE_ALERT]);
  vi.mocked(footprintApi.acknowledgeFootprintAlert).mockResolvedValue({
    ...DISK_ALERT,
    acknowledged_at: 3,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("FootprintAlert", () => {
  it("shows the disk text of an unacknowledged episode", async () => {
    mount();

    expect(await screen.findByText(/^The disk of/)).toHaveTextContent(DISK_TEXT);
    expect(screen.getByText("e2e-coder-1")).toBeInTheDocument();
  });

  it("hides an episode whose acknowledgement holds", async () => {
    mount();

    await screen.findByText(/^The disk of/);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.queryByText(/^Traces on/)).toBeNull();
  });

  it("shows an episode again when its acknowledgement ends", async () => {
    serve([{ ...TRACE_ALERT, acknowledged_until: 9 * GIB }]);
    mount();

    expect(await screen.findByText(/^Traces on/)).toHaveTextContent(
      "Traces on server hold 9 GiB, above the 8 GiB threshold. Review the candidates.",
    );
  });

  it("links the text to the candidates of the growing kind", async () => {
    mount();

    await userEvent.click(await screen.findByRole("link", { name: "Review the candidates." }));

    expect(screen.getByText("At /footprint/workspace?instance=e2e-coder-1")).toBeInTheDocument();
  });

  it("acknowledges the episode and reads the alerts again", async () => {
    mount();
    await screen.findByText(/^The disk of/);
    serve([]);

    await userEvent.click(screen.getByRole("button", { name: "Acknowledge Disk · e2e-coder-1" }));

    expect(footprintApi.acknowledgeFootprintAlert).toHaveBeenCalledWith(DISK_ALERT.alert_id);
    expect(toast.success).toHaveBeenCalledWith("Acknowledged the alert.");
    await vi.waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("names a refused acknowledgement", async () => {
    vi.mocked(footprintApi.acknowledgeFootprintAlert).mockRejectedValue(
      new ApiError("conflict", "The acknowledgement holds.", 409, "footprint.alert.acknowledged"),
    );
    mount();

    await userEvent.click(
      await screen.findByRole("button", { name: "Acknowledge Disk · e2e-coder-1" }),
    );

    expect(toast.error).toHaveBeenCalledWith("The acknowledgement failed.", {
      description: "The acknowledgement of this episode still holds.",
    });
  });
});
