import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as footprintApi from "@/api/resources/footprint";
import type { FootprintAlert } from "@/api/types";

vi.mock("@/api/resources/footprint");

import { FootprintAlertsProvider, useFootprintAlerts } from "./use-footprint-alerts";

const POLL_MS = 60_000;

const ALERT: FootprintAlert = {
  alert_id: "alert_01J9ZQ4XKM3B6V8N2R5T7W0AB1",
  kind: "disk",
  instance_name: "mac-studio",
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

function wrapper({ children }: { readonly children: ReactNode }) {
  return <FootprintAlertsProvider>{children}</FootprintAlertsProvider>;
}

function serve(unacknowledged: number) {
  vi.mocked(footprintApi.readFootprintSummary).mockResolvedValue({
    stats: [],
    open_alerts: unacknowledged,
    unacknowledged_alerts: unacknowledged,
  });
}

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(footprintApi.listFootprintAlertPage).mockResolvedValue({
    items: [ALERT],
    next_cursor: null,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("useFootprintAlerts", () => {
  it("answers the unacknowledged count of the summary and the open episodes", async () => {
    serve(1);

    const view = renderHook(() => useFootprintAlerts(), { wrapper });
    await advance(0);

    expect(view.result.current.count).toBe(1);
    expect(view.result.current.openAlerts).toEqual([ALERT]);
    expect(footprintApi.listFootprintAlertPage).toHaveBeenCalledWith(true, null, 100);
  });

  it("polls the summary every 60 seconds", async () => {
    serve(0);

    const view = renderHook(() => useFootprintAlerts(), { wrapper });
    await advance(0);
    expect(footprintApi.readFootprintSummary).toHaveBeenCalledTimes(1);

    await advance(POLL_MS - 1);
    expect(footprintApi.readFootprintSummary).toHaveBeenCalledTimes(1);

    serve(2);
    await advance(1);
    expect(footprintApi.readFootprintSummary).toHaveBeenCalledTimes(2);
    expect(view.result.current.count).toBe(2);
  });

  it("stops the poll on unmount", async () => {
    serve(0);

    const view = renderHook(() => useFootprintAlerts(), { wrapper });
    await advance(0);
    view.unmount();
    await advance(POLL_MS * 2);

    expect(footprintApi.readFootprintSummary).toHaveBeenCalledTimes(1);
  });

  it("reads no episode while every open episode is acknowledged", async () => {
    serve(0);

    const view = renderHook(() => useFootprintAlerts(), { wrapper });
    await advance(0);

    expect(view.result.current.count).toBe(0);
    expect(view.result.current.openAlerts).toEqual([]);
    expect(footprintApi.listFootprintAlertPage).not.toHaveBeenCalled();
  });

  it("answers no alert outside the provider", () => {
    const view = renderHook(() => useFootprintAlerts());

    expect(view.result.current.count).toBe(0);
    expect(footprintApi.readFootprintSummary).not.toHaveBeenCalled();
  });
});
