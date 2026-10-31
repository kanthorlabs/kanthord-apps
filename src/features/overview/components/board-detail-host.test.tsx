import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { EnvironmentState, MissionNodeRecord, Project } from "@/api/types";
import type { AttentionItem, ProjectSnapshot } from "@/lib/attention";
import { BOARD_TABS } from "@/lib/board-tabs";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";
import type { EnvironmentFailedItem } from "@/lib/fix-attention";

import type { GoneItem } from "../use-board";
import { BoardActsProvider } from "./board-acts";
import { BoardDetailHost } from "./board-detail-host";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const OTHER: Project = { ...PROJECT, id: "prj-2", name: "beta" };

function node(id: string, name: string): MissionNodeRecord {
  return {
    id,
    intent: "implement",
    tags: [],
    tasks: [],
    filename: `${id}.md`,
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name,
      requirement: "r",
      criterion: "c",
      verifications: [],
      bindings: [],
      intent: "implement",
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    pinned_revision: null,
    state: "Blocked",
    attempt: 2,
    priority: 0,
    depends_on: [],
  };
}

function card(id: string, name: string): AttentionItem {
  const target = node(id, name);
  return {
    id: `blocked:${id}`,
    kind: "blocked",
    group: "decisions",
    project: PROJECT,
    subject: name,
    missionVersion: 7,
    node: target,
    nodes: [target],
    at: null,
    cause: "Criterion not met",
  };
}

const CARDS = [card("a", "Team A"), card("b", "Team B"), card("c", "Team C")];

const RULE = (() => {
  const tab = BOARD_TABS.find((entry) => entry.id === "blocked");
  if (tab === undefined) throw new Error("No Rule tab.");
  return tab;
})();

function snapshot(
  project: Project,
  nodes: readonly MissionNodeRecord[],
  environments: readonly EnvironmentState[] | null,
): ProjectSnapshot {
  return {
    project,
    missionVersion: 7,
    nodes,
    jobs: null,
    registrations: null,
    executions: null,
    bindings: null,
    environments,
  };
}

function failedEnvironment(command: string): EnvironmentState {
  return {
    binding_id: "binding_1",
    binding_name: "main",
    status: "failed",
    failure: {
      class: "setup_failed",
      origin: "setup",
      execution_id: null,
      command,
      exit_code: 1,
      tail: "",
      reproduce: "run it",
      ended_at: 1,
    },
  } as unknown as EnvironmentState;
}

type HostProps = Parameters<typeof BoardDetailHost>[0];

function renderHost(widthClass: BoardWidth, overrides: Partial<HostProps> = {}) {
  const props: HostProps = {
    widthClass,
    selected: CARDS[1] ?? null,
    gone: null,
    openId: widthClass === BOARD_WIDTH.Expanded ? null : "blocked:b",
    position: 1,
    total: 3,
    tab: RULE,
    cards: CARDS,
    details: new Map(),
    now: 10_000_000,
    held: new Map(),
    snapshots: [],
    empty: <p>Pane empty</p>,
    titleRef: vi.fn(),
    onClose: vi.fn(),
    onStep: vi.fn(),
    onOpen: vi.fn(),
    ...overrides,
  };
  render(
    <MemoryRouter>
      <BoardActsProvider
        item={props.selected}
        details={props.details}
        reload={vi.fn()}
        retryDetail={vi.fn()}
        markActed={vi.fn()}
        setDialogOpen={vi.fn()}
        registerDialogCloser={vi.fn()}
        widthClass={widthClass}
      >
        <BoardDetailHost {...props} />
      </BoardActsProvider>
    </MemoryRouter>,
  );
  return props;
}

describe("BoardDetailHost on expanded width", () => {
  it("shows a region named by the title, with no dialog and no Close", () => {
    renderHost(BOARD_WIDTH.Expanded);

    expect(screen.getByRole("region", { name: "Team B: criterion not met" })).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next card" })).not.toBeInTheDocument();
  });

  it("shows the position in the title row", () => {
    renderHost(BOARD_WIDTH.Expanded);

    expect(screen.getByText("2 of 3")).toBeVisible();
  });

  it("shows the empty state of the pane when nothing is selected", () => {
    renderHost(BOARD_WIDTH.Expanded, { selected: null, position: null });

    expect(screen.getByText("Pane empty")).toBeVisible();
  });

  it("shows the gone text in the pane and moves to the first card", async () => {
    const gone: GoneItem = { id: "blocked:x", item: card("x", "Team X") };
    const props = renderHost(BOARD_WIDTH.Expanded, { selected: null, position: null, gone });

    expect(
      screen.getByText("Team X left the list at the last refresh.", { exact: false }),
    ).toBeVisible();
    await userEvent.setup().click(screen.getByRole("button", { name: "Next card" }));

    expect(props.onOpen).toHaveBeenCalledWith("blocked:a");
  });

  it("passes the environments of the snapshot of the item project", () => {
    const environment: EnvironmentFailedItem = {
      id: "environment_failed:prj-1:binding_1",
      kind: "environment_failed",
      group: "fixes",
      project: PROJECT,
      subject: "main",
      at: 1,
      cause: "Environment failed",
      nodeIds: [],
      projects: [PROJECT],
      binding: "main",
      bindingId: "binding_1",
      failure: null,
      failureClass: "setup_failed",
    };
    renderHost(BOARD_WIDTH.Expanded, {
      selected: environment,
      snapshots: [
        snapshot(OTHER, [], [failedEnvironment("other command")]),
        snapshot(PROJECT, [], [failedEnvironment("npm test")]),
      ],
    });

    expect(screen.getByText(/exited with 1/)).toHaveTextContent("npm test exited with 1.");
    expect(screen.queryByText("other command")).not.toBeInTheDocument();
  });

  it("passes the held nodes of the selected item", () => {
    const target = node("held_1", "Held node");
    renderHost(BOARD_WIDTH.Expanded, {
      held: new Map([["blocked:b", ["held_1"]]]),
      snapshots: [snapshot(PROJECT, [target], null)],
    });

    expect(screen.getByText("1 node waits in total.")).toBeVisible();
    expect(screen.getByText("Held node")).toBeVisible();
  });
});

describe("BoardDetailHost in a sheet", () => {
  it("opens a right sheet with Close on medium width", () => {
    renderHost(BOARD_WIDTH.Medium);

    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveClass("data-[side=right]:w-[min(560px,100%)]");
    expect(within(dialog).getByRole("button", { name: "Close" })).toBeVisible();
    expect(within(dialog).getByRole("region", { name: "Team B: criterion not met" })).toBeVisible();
  });

  it("opens a full-width sheet with Back on compact width", () => {
    renderHost(BOARD_WIDTH.Compact);

    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveClass("data-[side=right]:w-full");
    expect(within(dialog).getByRole("button", { name: "Back" })).toBeVisible();
    expect(within(dialog).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("shows no sheet while no detail is open", () => {
    renderHost(BOARD_WIDTH.Medium, { openId: null });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("focuses the title at open", async () => {
    renderHost(BOARD_WIDTH.Medium);

    await waitFor(() =>
      expect(
        screen.getByRole("heading", { level: 3, name: "Team B: criterion not met" }),
      ).toHaveFocus(),
    );
  });

  it("hands the title to the title ref", () => {
    const props = renderHost(BOARD_WIDTH.Medium);

    expect(props.titleRef).toHaveBeenCalledWith(
      screen.getByRole("heading", { level: 3, name: "Team B: criterion not met" }),
    );
  });

  it("shows the position and both step buttons", () => {
    renderHost(BOARD_WIDTH.Medium);

    const dialog = screen.getByRole("dialog");

    expect(within(dialog).getAllByText("2 of 3")).toHaveLength(1);
    expect(within(dialog).getByRole("button", { name: "Previous card" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Next card" })).toBeEnabled();
  });

  it("steps and focuses the title", async () => {
    const props = renderHost(BOARD_WIDTH.Medium);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Next card" }));
    expect(props.onStep).toHaveBeenLastCalledWith(1);
    await user.click(screen.getByRole("button", { name: "Previous card" }));

    expect(props.onStep).toHaveBeenLastCalledWith(-1);
    expect(screen.getByRole("heading", { level: 3 })).toHaveFocus();
  });

  it("disables Previous card on the first card", () => {
    renderHost(BOARD_WIDTH.Medium, { selected: CARDS[0] ?? null, position: 0 });

    expect(screen.getByRole("button", { name: "Previous card" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next card" })).toBeEnabled();
  });

  it("disables Next card on the last card", () => {
    renderHost(BOARD_WIDTH.Compact, { selected: CARDS[2] ?? null, position: 2 });

    expect(screen.getByRole("button", { name: "Next card" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous card" })).toBeEnabled();
  });

  it("closes through the close control", async () => {
    const props = renderHost(BOARD_WIDTH.Medium);

    await userEvent.setup().click(screen.getByRole("button", { name: "Close" }));

    expect(props.onClose).toHaveBeenCalled();
  });

  it("shows the gone text with one Next card and no step buttons", async () => {
    const props = renderHost(BOARD_WIDTH.Compact, {
      selected: null,
      position: null,
      gone: { id: "missing", item: null },
    });

    expect(screen.getByText("The link points to an item that does not wait now.")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Previous card" })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Next card" }));

    expect(props.onOpen).toHaveBeenCalledWith("blocked:a");
  });
});
