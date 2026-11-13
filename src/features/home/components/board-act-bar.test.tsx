import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { checkNode } from "@/api/resources/mission";
import { listTracePage } from "@/api/resources/tracking";
import { approveWorkbenchCall, readWorkbenchEvents } from "@/api/resources/workbench";
import type {
  MissionExternalAction,
  MissionNodeRecord,
  Project,
  SchedulerExecutionRecord,
} from "@/api/types";
import type { ToolApprovalItem } from "@/lib/approval-attention";
import {
  type AttentionDetail,
  type AttentionDetails,
  type AttentionItem,
  type DecisionAttentionItem,
  detailKeyOf,
} from "@/lib/attention";
import type { BoardGate } from "@/lib/board-items";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/tracking");
vi.mock("@/api/resources/workbench");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { BoardActBar } from "./board-act-bar";
import { BoardReadsProvider } from "../use-board-reads";
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

const jump = vi.fn();

function Bar({
  item,
  details,
  gate = null,
}: {
  item: AttentionItem;
  details: AttentionDetails;
  gate?: BoardGate | null;
}) {
  return (
    <MemoryRouter>
      <BoardReadsProvider item={item} details={details}>
        <BoardActsProvider
          item={item}
          details={details}
          snapshots={[]}
          reload={vi.fn()}
          retryDetail={retryDetail}
          markActed={vi.fn()}
          setDialogOpen={vi.fn()}
          registerDialogCloser={vi.fn()}
          closeInboxItem={vi.fn()}
          gate={gate}
          jump={jump}
        >
          <BoardActBar askYumi={null} />
        </BoardActsProvider>
      </BoardReadsProvider>
    </MemoryRouter>
  );
}

function labelOf(control: HTMLElement): string {
  return Array.from(control.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
    .join("");
}

function names(): readonly (string | null)[] {
  return within(screen.getByRole("group", { name: "Acts" }))
    .getAllByRole("button")
    .map(labelOf);
}

const PAUSED = node("implement", "Paused");

const GATE: BoardGate = {
  itemId: "credential_refused:openai-main",
  need: "Rotate openai-main in Fix setup",
  short: "Rotate openai-main",
};

const APPROVAL: ToolApprovalItem = {
  id: "tool_approval:s1",
  group: "decisions",
  kind: "tool_approval",
  subject: "Create project",
  at: 2,
  sessionId: "s1",
  toolCallId: "c1",
  agent: "swe@1",
  operationId: "project.create",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listTracePage).mockResolvedValue({ items: [], next_cursor: null });
  vi.mocked(readWorkbenchEvents).mockResolvedValue({
    snapshot: { pending_approval: null },
  } as Awaited<ReturnType<typeof readWorkbenchEvents>>);
});

async function openMore(name: string | RegExp = /^More/) {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name }));
  const sheet = await screen.findByRole("dialog", { name: "More acts on Team" });
  return { user, sheet };
}

describe("BoardActBar", () => {
  it("shows the lead act and More with the count of the other acts", async () => {
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [])} />);
    await screen.findByRole("button", { name: "More (3)" });

    expect(names()).toEqual(["Resume", "More (3)"]);
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it("opens the other acts in a bottom sheet with Discard last", async () => {
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [])} />);

    const { sheet } = await openMore();

    expect(sheet).toHaveAttribute("data-side", "bottom");
    expect(
      within(sheet)
        .getAllByRole("button")
        .map((control) => labelOf(control)),
    ).toEqual(["Override", "Last trace", "Discard", "Cancel"]);
    expect(within(sheet).getByRole("button", { name: "Last trace" })).toHaveAttribute(
      "href",
      "/traces/trace_e1",
    );
    expect(within(sheet).getByRole("separator")).toBeInTheDocument();
  });

  it("closes only the bottom sheet with Esc and returns the focus to More", async () => {
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [])} />);
    const more = await screen.findByRole("button", { name: "More (3)" });
    const { user } = await openMore();

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(more).toHaveFocus();
  });

  it("pads the bar by the bottom safe area", async () => {
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [])} />);
    await screen.findByRole("button", { name: "More (3)" });

    expect(screen.getByRole("group", { name: "Acts" })).toHaveClass(
      "pb-[env(safe-area-inset-bottom)]",
    );
  });

  it("keeps Override as outline and Discard as destructive", async () => {
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [])} />);

    const { sheet } = await openMore();

    expect(within(sheet).getByRole("button", { name: "Override" })).toHaveClass("bg-background");
    expect(within(sheet).getByRole("button", { name: "Discard" })).toHaveClass("bg-destructive/10");
  });

  it("skips the gated acts and Discard for the lead act", () => {
    const target = node("examine", "Blocked");
    render(<Bar item={itemOf(target, "blocked")} details={new Map()} />);

    expect(names()[0]).toBe("Override");
    expect(screen.getByRole("button", { name: "Override" })).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByText("Decide needs: the proposals read.")).toBeNull();
  });

  it("names the need of a gated act in More", async () => {
    const target = node("examine", "Blocked");
    render(<Bar item={itemOf(target, "blocked")} details={new Map()} />);

    const { sheet } = await openMore();

    expect(within(sheet).getByRole("button", { name: "Discard" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(within(sheet).getByText("Discard needs: the proposals read.")).toBeVisible();
  });

  it("falls back to the primary act and shows only its need line under the row", () => {
    render(<Bar item={itemOf(PAUSED, "paused")} details={new Map()} />);

    expect(names()[0]).toBe("Resume");
    expect(screen.getByRole("button", { name: "Resume" })).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByText("Resume needs: the executions and external actions read."),
    ).toBeVisible();
    expect(
      screen.queryByText("Discard needs: the executions and external actions read."),
    ).toBeNull();
  });

  it("keeps the failure text with Retry under the row", async () => {
    const target = node("examine", "Blocked");
    const failed: AttentionDetail = {
      kind: "blocked",
      key: detailKeyOf(target),
      assessment: { status: "ready", data: null },
      proposals: { status: "failed", message: "No answer." },
    };
    render(<Bar item={itemOf(target, "blocked")} details={new Map([[target.id, failed]])} />);

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
      link_updates: [],
    });
    const item = itemOf(PAUSED, "paused");
    const view = render(<Bar item={item} details={pausedDetails(PAUSED, [unresolved()])} />);
    const { user, sheet } = await openMore();

    await user.click(within(sheet).getByRole("button", { name: "Check now" }));
    await user.keyboard("{Escape}");

    expect(await screen.findByRole("status")).toHaveTextContent("Merged");

    view.rerender(<Bar item={item} details={pausedDetails(PAUSED, [])} />);

    expect(screen.getByRole("status")).toHaveTextContent("Merged");
  });

  it("shows the counts of each link after Check now", async () => {
    vi.mocked(checkNode).mockResolvedValue({
      results: [
        {
          evidence_id: "evidence_1",
          requirement_key: "repo.pull_request",
          resolution: "unresolved",
        },
      ],
      failures: [],
      link_updates: [
        {
          external_link: {
            kind: "github_issue",
            resource_identity: "conversation:github:kanthorlabs/kanthord",
            number: 42,
          },
          admitted: 2,
          duplicate: 1,
          refused: 0,
        },
      ],
    });
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [unresolved()])} />);
    const { user, sheet } = await openMore();

    await user.click(within(sheet).getByRole("button", { name: "Check now" }));
    await user.keyboard("{Escape}");

    expect(
      await screen.findByText("kanthorlabs/kanthord#42: 2 admitted, 1 duplicate, 0 refused"),
    ).toBeInTheDocument();
  });

  it("shows no key hint and no aria-keyshortcuts", async () => {
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [])} />);

    const lead = within(screen.getByRole("group", { name: "Acts" })).getAllByRole("button");
    const { sheet } = await openMore();

    for (const control of [...lead, ...within(sheet).getAllByRole("button")]) {
      expect(control).not.toHaveAttribute("aria-keyshortcuts");
      expect(control.querySelector("kbd")).toBeNull();
    }
  });
});

describe("BoardActBar gated Resume", () => {
  function gatedBar() {
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [])} gate={GATE} />);
  }

  it("leads with Go to the credential and keeps Resume in More", async () => {
    gatedBar();
    await screen.findByRole("button", { name: "More (4)" });

    expect(names()).toEqual(["Go to openai-main", "More (4)"]);
  });

  it("renders Resume through DisabledAction with its need line in More", async () => {
    gatedBar();
    const { sheet } = await openMore();
    const resume = within(sheet).getByRole("button", { name: "Resume" });
    const need = within(sheet).getByText("Resume needs: Rotate openai-main in Fix setup.");

    expect(resume).toHaveAttribute("aria-disabled", "true");
    expect(resume).toHaveAttribute("aria-describedby", need.id);
    expect(resume).toHaveAccessibleDescription("Resume needs: Rotate openai-main in Fix setup.");
    expect(need).toBeVisible();
  });

  it("keeps Resume focusable and shows the gate need as its reason after a press", async () => {
    gatedBar();
    const { user, sheet } = await openMore();
    const resume = within(sheet).getByRole("button", { name: "Resume" });

    resume.focus();
    expect(resume).toHaveFocus();
    await user.click(resume);

    expect(await screen.findByText("Rotate openai-main in Fix setup.")).toBeVisible();
  });

  it("jumps to the credential card with Go to", async () => {
    gatedBar();

    await userEvent.setup().click(await screen.findByRole("button", { name: "Go to openai-main" }));

    expect(jump).toHaveBeenCalledWith("credential_refused:openai-main");
  });
});

describe("BoardActBar failure line", () => {
  async function approve() {
    render(<Bar item={APPROVAL} details={new Map()} />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: "Approve" }));
    return user;
  }

  it("shows the failed act with its message and Retry, and keeps the acts", async () => {
    vi.mocked(approveWorkbenchCall).mockRejectedValue(
      new ApiError("unavailable", "The daemon did not answer.", 503),
    );

    await approve();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Approving Create project failed. The daemon did not answer.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Approve" })).toBeVisible();
    expect(screen.getByRole("button", { name: "More (2)" })).toBeVisible();
  });

  it("sends again on Retry and clears the line", async () => {
    vi.mocked(approveWorkbenchCall)
      .mockRejectedValueOnce(new ApiError("unavailable", "Down.", 503))
      .mockResolvedValue({} as never);
    const user = await approve();
    await screen.findByRole("alert");

    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(approveWorkbenchCall).toHaveBeenCalledTimes(2);
    expect(approveWorkbenchCall).toHaveBeenLastCalledWith("s1", "c1", true);
  });

  it("shows no failure line without a failure", async () => {
    render(<Bar item={APPROVAL} details={new Map()} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
