import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as footprintApi from "@/api/resources/footprint";
import type { CleanupState, FootprintCleanupRecord } from "@/api/types";

vi.mock("@/api/resources/footprint");

import { FootprintCleanupScreen } from "./footprint-cleanup-screen";
import { CLEANUP_RECORD_POLL_MS } from "./use-footprint-cleanup-record";

const CLEANUP_ID = "cleanup_01J9ZQ4XKM3B6V8N2R5T7W0AB1";

function record(state: CleanupState): FootprintCleanupRecord {
  return {
    cleanup_id: CLEANUP_ID,
    kind: "workspace",
    instance_name: "mac-studio",
    rule: { name: "node_closed" },
    keys: ["node_01J9ZQ4XKM3B6V8N2R5T7W0AB1", "node_01J9ZQ4XKM3B6V8N2R5T7W0AB2"],
    requested_by: { kind: "human", account: "ulrich", name: "Ulrich" },
    requested_at: Date.UTC(2026, 10, 3, 9, 20),
    state,
    finished_at: state === "completed" ? Date.UTC(2026, 10, 3, 9, 21) : null,
    outcome:
      state === "completed"
        ? {
            removed: 1,
            removed_bytes: 1_048_576,
            absent: 0,
            refused: [{ key: "node_01J9ZQ4XKM3B6V8N2R5T7W0AB2", reason: "live" }],
            pending: 0,
          }
        : null,
  };
}

function mount() {
  render(
    <MemoryRouter initialEntries={[`/footprint/cleanups/${CLEANUP_ID}`]}>
      <Routes>
        <Route path="/footprint/cleanups/:cleanupId" element={<FootprintCleanupScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

function advance(ms: number) {
  return act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

afterEach(() => {
  vi.useRealTimers();
});

describe("FootprintCleanupScreen", () => {
  it("reads the record every 15 seconds while it is queued or running and stops at the end", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(footprintApi.readFootprintCleanup)
      .mockResolvedValueOnce(record("queued"))
      .mockResolvedValueOnce(record("running"))
      .mockResolvedValue(record("completed"));
    mount();
    expect(await screen.findByText("Queued")).toBeInTheDocument();

    await advance(CLEANUP_RECORD_POLL_MS);
    expect(await screen.findByText("Running")).toBeInTheDocument();
    await advance(CLEANUP_RECORD_POLL_MS);
    expect(await screen.findByText("Completed")).toBeInTheDocument();
    expect(footprintApi.readFootprintCleanup).toHaveBeenCalledTimes(3);

    await advance(CLEANUP_RECORD_POLL_MS * 3);
    expect(footprintApi.readFootprintCleanup).toHaveBeenCalledTimes(3);
    expect(
      screen.getByText("1 removed (1 MiB) · 0 absent · 1 refused · 0 pending"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("In use by a running execution.", { exact: false }),
    ).toBeInTheDocument();
  });

  it("cancels a queued record", async () => {
    vi.mocked(footprintApi.readFootprintCleanup).mockResolvedValue(record("queued"));
    vi.mocked(footprintApi.cancelFootprintCleanup).mockResolvedValue(record("cancelled"));
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Cancel cleanup" }));

    await waitFor(() =>
      expect(footprintApi.cancelFootprintCleanup).toHaveBeenCalledWith(CLEANUP_ID),
    );
  });
});
