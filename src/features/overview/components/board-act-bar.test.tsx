import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkNode } from "@/api/resources/mission";
import { listTracePage } from "@/api/resources/tracking";
import type {
  MissionExternalAction,
  MissionNodeRecord,
  Project,
  SchedulerExecutionRecord,
} from "@/api/types";
import {
  type AttentionDetail,
  type AttentionDetails,
  type DecisionAttentionItem,
  detailKeyOf,
} from "@/lib/attention";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/tracking");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { BoardActBar } from "./board-act-bar";
import { BoardActsProvider } from "./board-acts";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

function node(intent: "implement" | "examine", state: "Paused" | "Blocked"): MissionNodeRecord {
  return {
    id: "node_1",
    intent,
    tags: [],
    tasks: [],
    filename: "node_1.md",
    mission_id: "mission_1",
    visible_revision: 1,
    content: {
      name: "Team",
      requirement: "r",
      criterion: "c",
      verifications: [],
      bindings: [],
      intent,
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    pinned_revision: null,
    state,
    attempt: 2,
    priority: 0,
    depends_on: [],
  };
}

function itemOf(target: MissionNodeRecord, kind: "paused" | "blocked"): DecisionAttentionItem {
  return {
    id: `${kind}:${target.id}`,
    kind,
    group: "decisions",
    project: PROJECT,
    subject: target.content.name,
    missionVersion: 7,
    node: target,
    nodes: [target],
    at: null,
    cause: "Cause",
    pause: null,
  } as DecisionAttentionItem;
}

function unresolved(): MissionExternalAction {
  return {
    node_id: "node_1",
    attempt: 2,
    action: {
      key: "repo.pull_request",
      binding_id: "binding_1",
      action: "pull_request",
      expected_end_state: "pull_request_merged",
      follows: null,
      configuration: { base_branch: "main", landing: "human" },
    },
    requested: true,
    request_evidence_id: "evidence_1",
    resolution: "unresolved",
  };
}

function pausedDetails(
  target: MissionNodeRecord,
  actions: readonly MissionExternalAction[],
): AttentionDetails {
  const detail: AttentionDetail = {
    kind: "paused",
    key: detailKeyOf(target),
    executions: {
      status: "ready",
      data: [
        { execution_id: "e1", trace_id: "trace_e1", created_at: 1 } as SchedulerExecutionRecord,
      ],
    },
    actions: { status: "ready", data: actions },
  };
  return new Map([[target.id, detail]]);
}

const retryDetail = vi.fn();

function Bar({ item, details }: { item: DecisionAttentionItem; details: AttentionDetails }) {
  return (
    <MemoryRouter>
      <BoardActsProvider
        item={item}
        details={details}
        reload={vi.fn()}
        retryDetail={retryDetail}
        markActed={vi.fn()}
        setDialogOpen={vi.fn()}
      >
        <BoardActBar />
      </BoardActsProvider>
    </MemoryRouter>
  );
}

function names(): readonly (string | null)[] {
  return within(screen.getByRole("group", { name: "Acts" }))
    .getAllByRole("button")
    .map((control) => control.textContent);
}

const PAUSED = node("implement", "Paused");

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listTracePage).mockResolvedValue({ items: [], next_cursor: null });
});

describe("BoardActBar", () => {
  it("shows Last trace before Discard and Discard last in one row", async () => {
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [])} />);

    expect(await screen.findByRole("button", { name: "Last trace" })).toHaveAttribute(
      "href",
      "/traces/trace_e1",
    );
    expect(names()).toEqual(["Resume", "Override", "Last trace", "Discard"]);
  });

  it("keeps Override as outline and Discard as destructive", async () => {
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [])} />);
    await screen.findByRole("button", { name: "Last trace" });

    expect(screen.getByRole("button", { name: "Override" })).toHaveClass("bg-background");
    expect(screen.getByRole("button", { name: "Discard" })).toHaveClass("bg-destructive/10");
  });

  it("shows the need line under the row", () => {
    const target = node("examine", "Blocked");
    render(<Bar item={itemOf(target, "blocked")} details={new Map()} />);

    const row = screen.getByRole("button", { name: "Discard" });
    const need = screen.getByText("Discard needs: the proposals read.");

    expect(row.compareDocumentPosition(need) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the need line and adds the failure text with Retry when the read fails", async () => {
    const target = node("examine", "Blocked");
    const failed: AttentionDetail = {
      kind: "blocked",
      key: detailKeyOf(target),
      assessment: { status: "ready", data: null },
      proposals: { status: "failed", message: "No answer." },
    };
    render(<Bar item={itemOf(target, "blocked")} details={new Map([[target.id, failed]])} />);

    expect(screen.getByText("Decide needs: the proposals read.")).toBeVisible();
    expect(screen.getByText(/The fix proposals could not be read: No answer\./)).toBeVisible();
    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));

    expect(retryDetail).toHaveBeenCalledWith("node_1");
  });

  it("shows no failure text while the read is only pending", () => {
    const target = node("examine", "Blocked");
    render(<Bar item={itemOf(target, "blocked")} details={new Map()} />);

    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeInTheDocument();
  });

  it("keeps the check result after the check", async () => {
    vi.mocked(checkNode).mockResolvedValue({
      results: [
        {
          evidence_id: "evidence_1",
          requirement_key: "repo.pull_request",
          resolution: "expected-end",
        },
      ],
      failures: [],
    });
    const item = itemOf(PAUSED, "paused");
    const view = render(<Bar item={item} details={pausedDetails(PAUSED, [unresolved()])} />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Check now" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Merged");

    view.rerender(<Bar item={item} details={pausedDetails(PAUSED, [])} />);

    expect(screen.queryByRole("button", { name: "Check now" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Merged");
  });
});
