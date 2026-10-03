import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { Delivery } from "@/api/types";
import { DeliveriesScreen } from "./deliveries-screen";

vi.mock("@/features/projects/project-context", () => ({
  useProjectId: () => "prj-test",
}));

vi.mock("@/api/resources/deliveries", () => ({
  listDeliveries: vi.fn(),
  listObservations: vi.fn(),
}));

import { listDeliveries } from "@/api/resources/deliveries";

const accepted: Delivery = {
  id: "dl-101",
  source: "github-webhook",
  platformDeliveryIdentity: "8f2a-4410-be31",
  disposition: "acceptance as an observation",
  receivedAt: new Date().toISOString(),
  externalObjectId: "eo-42",
  nodeId: "obj-reset-email",
  attemptId: "att-re-1",
  decodedEventType: "pull_request.opened",
  refusalReason: null,
};

const duplicate: Delivery = {
  id: "dl-102",
  source: "github-webhook",
  platformDeliveryIdentity: "8f2a-4410-be31",
  disposition: "a duplicate",
  receivedAt: new Date().toISOString(),
  externalObjectId: "eo-42",
  nodeId: "obj-reset-email",
  attemptId: "att-re-1",
  decodedEventType: "pull_request.opened",
  refusalReason: null,
};

const refused: Delivery = {
  id: "dl-104",
  source: "github-webhook",
  platformDeliveryIdentity: "2200-7731-cc19",
  disposition: "refusal",
  receivedAt: new Date().toISOString(),
  externalObjectId: null,
  nodeId: null,
  attemptId: null,
  decodedEventType: null,
  refusalReason: "The delivery signature did not verify against the source binding.",
};

const humanAct: Delivery = {
  id: "dl-105",
  source: "github-webhook",
  platformDeliveryIdentity: "5512-0091-dd33",
  disposition: "acceptance as a human act",
  receivedAt: new Date().toISOString(),
  externalObjectId: "eo-42",
  nodeId: "obj-reset-email",
  attemptId: "att-re-1",
  decodedEventType: "issue_comment.created",
  refusalReason: null,
};

function renderScreen() {
  return render(
    <MemoryRouter>
      <DeliveriesScreen />
    </MemoryRouter>,
  );
}

describe("DeliveriesScreen", () => {
  it("shows the refusal reason for a refused delivery", async () => {
    vi.mocked(listDeliveries).mockResolvedValue([refused]);

    renderScreen();

    await waitFor(() => {
      expect(
        screen.getByText("The delivery signature did not verify against the source binding."),
      ).toBeDefined();
    });
  });

  it("marks a duplicate as having no second effect", async () => {
    vi.mocked(listDeliveries).mockResolvedValue([accepted, duplicate]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText(/no second effect/i)).toBeDefined();
    });
  });

  it("renders two groups for deliveries that share a pdi but differ in source", async () => {
    const fromGithub: Delivery = {
      id: "dl-201",
      source: "github-webhook",
      platformDeliveryIdentity: "same-pdi-value",
      disposition: "acceptance as an observation",
      receivedAt: new Date().toISOString(),
      externalObjectId: "eo-10",
      nodeId: "obj-a",
      attemptId: "att-a-1",
      decodedEventType: "push",
      refusalReason: null,
    };
    const fromSlack: Delivery = {
      id: "dl-202",
      source: "slack-webhook",
      platformDeliveryIdentity: "same-pdi-value",
      disposition: "acceptance as an observation",
      receivedAt: new Date().toISOString(),
      externalObjectId: "eo-11",
      nodeId: "obj-b",
      attemptId: "att-b-1",
      decodedEventType: "message",
      refusalReason: null,
    };

    vi.mocked(listDeliveries).mockResolvedValue([fromGithub, fromSlack]);

    renderScreen();

    await waitFor(() => {
      expect(screen.queryByText(/no second effect/i)).toBeNull();
    });
  });

  it("filters deliveries by disposition", async () => {
    vi.mocked(listDeliveries).mockResolvedValue([accepted, duplicate, refused, humanAct]);

    renderScreen();

    await waitFor(() => {
      expect(screen.getByText("refusal")).toBeDefined();
    });

    const refusedTab = screen.getByRole("radio", { name: "Refused" });
    await userEvent.click(refusedTab);

    await waitFor(() => {
      expect(
        screen.getByText("The delivery signature did not verify against the source binding."),
      ).toBeDefined();
      expect(screen.queryByText("pull_request.opened")).toBeNull();
    });
  });

  it("keeps the filter selected after a second click on the same item", async () => {
    vi.mocked(listDeliveries).mockResolvedValue([accepted, refused]);

    renderScreen();

    const refusedItem = await screen.findByRole("radio", { name: "Refused" });
    await userEvent.click(refusedItem);
    await userEvent.click(refusedItem);

    expect(screen.getByRole("radio", { name: "Refused", checked: true })).toBeInTheDocument();
    expect(screen.queryByText("pull_request.opened")).toBeNull();
  });
});
