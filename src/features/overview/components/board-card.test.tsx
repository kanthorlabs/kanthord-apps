import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { MissionNodeRecord, Project } from "@/api/types";
import { type AttentionItem, deriveAttention } from "@/lib/attention";

import { BoardCard } from "./board-card";

const NOW = 10_000_000;
const TEN_MINUTES_MS = 600_000;

const ATLAS: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

function blockedNode(createdAt: number | null): MissionNodeRecord {
  return {
    id: "b1",
    filename: "b1.md",
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name: "Ship the release",
      requirement: "",
      criterion: "",
      verifications: [],
      bindings: [],
      intent: "implement",
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    pinned_revision: null,
    intent: "implement",
    tags: [],
    tasks: [],
    state: "Blocked",
    attempt: 2,
    priority: 0,
    depends_on: [],
    ...(createdAt === null
      ? {}
      : {
          blocked_context: {
            outcome: {
              id: "outcome_b1",
              node_id: "b1",
              attempt: 2,
              node_revision: 1,
              closing_event: "human-block" as const,
              result: "undetermined" as const,
              assessment_id: "assessment_b1",
              evidence_ids: [],
              created_at: createdAt,
            },
            requests: [],
          },
        }),
  };
}

function itemOf(createdAt: number | null = NOW - TEN_MINUTES_MS): AttentionItem {
  const [item] = deriveAttention(
    [
      {
        project: ATLAS,
        missionVersion: 1,
        nodes: [blockedNode(createdAt)],
        jobs: null,
        registrations: null,
        executions: null,
        bindings: null,
        environments: null,
      },
    ],
    new Map(),
    { now: NOW, catalog: null, credentials: [], sessions: null },
  );
  if (item === undefined) throw new Error("No item derived.");
  return item;
}

function renderCard(overrides: Partial<Parameters<typeof BoardCard>[0]> = {}) {
  const onSelect = vi.fn();
  render(
    <div role="list">
      <BoardCard
        item={itemOf()}
        now={NOW}
        held={1}
        gate={null}
        leadLabel="Decide"
        selected={false}
        tabStop={false}
        onSelect={onSelect}
        {...overrides}
      />
    </div>,
  );
  return onSelect;
}

describe("BoardCard", () => {
  it("sits in a list item wrapper", () => {
    renderCard();

    expect(screen.getByRole("listitem")).toContainElement(
      screen.getByRole("button", { name: "Ship the release" }),
    );
  });

  it("makes the title a tab stop only for the tab stop card", () => {
    renderCard({ tabStop: true });
    expect(screen.getByRole("button", { name: "Ship the release" })).toHaveAttribute(
      "tabindex",
      "0",
    );
  });

  it("takes the title out of the tab order for any other card", () => {
    renderCard({ tabStop: false });
    expect(screen.getByRole("button", { name: "Ship the release" })).toHaveAttribute(
      "tabindex",
      "-1",
    );
  });

  it("holds the title button as the one control", () => {
    renderCard();

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("describes the title with the cause, the age and the held text", () => {
    renderCard();

    expect(screen.getByRole("button", { name: "Ship the release" })).toHaveAccessibleDescription(
      "Blocked by a human · attempt 2 10 minutes ago 1 node waits",
    );
  });

  it("shows the age as unknown when the item has no time", () => {
    renderCard({ item: itemOf(null) });

    expect(screen.getByText("age unknown")).toBeVisible();
  });

  it("shows the project and the label of the lead act", () => {
    renderCard();

    expect(screen.getByText("atlas")).toBeVisible();
    expect(screen.getByText("Decide")).toBeVisible();
  });

  it("shows the gate in place of the lead act", () => {
    renderCard({
      gate: { itemId: "credential_refused:x", need: "n", short: "Rotate anthropic-main" },
    });

    expect(screen.getByText("Needs: Rotate anthropic-main")).toBeVisible();
    expect(screen.queryByText("Decide")).not.toBeInTheDocument();
  });

  it("marks only the selected card as current", () => {
    renderCard({ selected: true });

    expect(
      screen.getByRole("button", { name: "Ship the release" }).closest("[aria-current='true']"),
    ).not.toBeNull();
  });

  it("marks no card as current when not selected", () => {
    renderCard();

    expect(
      screen.getByRole("button", { name: "Ship the release" }).closest("[aria-current]"),
    ).toBeNull();
  });

  it("selects the item on a press of the title", async () => {
    const onSelect = renderCard();

    await userEvent.setup().click(screen.getByRole("button", { name: "Ship the release" }));

    expect(onSelect).toHaveBeenCalledWith("blocked:b1");
  });
});
