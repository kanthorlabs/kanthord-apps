import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { ObservationRecord } from "@/api/types";
import { ObservationsScreen } from "./observations-screen";

vi.mock("@/features/projects/project-context", () => ({
  useProjectId: () => "prj-test",
}));

vi.mock("@/api/resources/deliveries", () => ({
  listDeliveries: vi.fn(),
  listObservations: vi.fn(),
}));

import { listObservations } from "@/api/resources/deliveries";

const observationWithCommits: ObservationRecord = {
  id: "ob-landing",
  externalObjectId: "eo-99",
  observedState: "merged",
  observedAt: new Date(Date.now() - 120_000).toISOString(),
  landedCommitIds: ["abc123def456", "789ghijkl012"],
};

const observationWithoutCommits: ObservationRecord = {
  id: "ob-plain",
  externalObjectId: "eo-42",
  observedState: "open",
  observedAt: new Date(Date.now() - 60_000).toISOString(),
  landedCommitIds: [],
};

function renderScreen() {
  return render(
    <MemoryRouter>
      <ObservationsScreen />
    </MemoryRouter>,
  );
}

describe("ObservationsScreen", () => {
  it("shows landed commit identities when the observation is a landing", async () => {
    vi.mocked(listObservations).mockResolvedValue([observationWithCommits]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("abc123def456")).toBeDefined();
      expect(screen.getByText("789ghijkl012")).toBeDefined();
    });

    expect(screen.getByText("Landed commits")).toBeDefined();
  });

  it("does not show a landed commits section when there are none", async () => {
    vi.mocked(listObservations).mockResolvedValue([observationWithoutCommits]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("open")).toBeDefined();
    });

    expect(screen.queryByText("Landed commits")).toBeNull();
  });
});
