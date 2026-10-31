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

import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

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
  widthClass = BOARD_WIDTH.Expanded,
  gate = null,
}: {
  item: AttentionItem;
  details: AttentionDetails;
  widthClass?: BoardWidth;
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
          widthClass={widthClass}
          gate={gate}
          jump={jump}
        >
          <BoardActBar />
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

describe("BoardActBar", () => {
  it("shows Last trace before Discard and Discard last in one row", async () => {
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [])} />);

    expect(await screen.findByRole("button", { name: "Last trace" })).toHaveAttribute(
      "href",
      "/traces/trace_e1",
    );
    expect(names()).toEqual(["Resume", "Override", "Last trace", "Discard"]);
  });

  it("pads the bar by the bottom safe area", async () => {
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [])} />);
    await screen.findByRole("button", { name: "Last trace" });

    expect(screen.getByRole("group", { name: "Acts" })).toHaveClass(
      "pb-[env(safe-area-inset-bottom)]",
    );
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

  it("shows the letter of each act in a key hint with aria-keyshortcuts", async () => {
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [])} />);
    await screen.findByRole("button", { name: "Last trace" });

    const keyed = within(screen.getByRole("group", { name: "Acts" }))
      .getAllByRole("button")
      .map((control) => [
        labelOf(control),
        control.getAttribute("aria-keyshortcuts"),
        control.querySelector("kbd")?.textContent,
      ]);

    expect(keyed).toEqual([
      ["Resume", "r", "r"],
      ["Override", "v", "v"],
      ["Last trace", "t", "t"],
      ["Discard", "x", "x"],
    ]);
  });

  it("keeps the accessible name free of the key hint", async () => {
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [])} />);

    expect(await screen.findByRole("button", { name: "Resume" })).toBeVisible();
  });

  it("carries the key on an act that waits for a read", () => {
    const target = node("examine", "Blocked");
    render(<Bar item={itemOf(target, "blocked")} details={new Map()} />);

    const gated = screen.getByRole("button", { name: "Discard" });

    expect(gated).toHaveAttribute("aria-disabled", "true");
    expect(gated).toHaveAttribute("aria-keyshortcuts", "x");
    expect(gated.querySelector("kbd")).toHaveTextContent("x");
  });

  it("hides the key hints and the aria-keyshortcuts with the shortcuts off", async () => {
    window.localStorage.setItem("kd-board-shortcuts", "off");
    render(<Bar item={itemOf(PAUSED, "paused")} details={pausedDetails(PAUSED, [])} />);
    await screen.findByRole("button", { name: "Last trace" });

    for (const control of within(screen.getByRole("group", { name: "Acts" })).getAllByRole(
      "button",
    )) {
      expect(control).not.toHaveAttribute("aria-keyshortcuts");
      expect(control.querySelector("kbd")).toBeNull();
    }
  });

  it("gives a shared letter to the first act only", () => {
    const target = node("implement", "Paused");
    render(
      <Bar
        item={
          {
            ...itemOf(target, "paused"),
            kind: "dependency_discarded",
            discarded: [
              { id: "dep_a", name: "Alpha" },
              { id: "dep_b", name: "Beta" },
            ],
          } as unknown as DecisionAttentionItem
        }
        details={new Map()}
      />,
    );

    const removals = screen.getAllByRole("button", { name: /^Remove dependency on/ });

    expect(removals.map((control) => control.getAttribute("aria-keyshortcuts"))).toEqual([
      "m",
      null,
    ]);
  });
});

describe("BoardActBar gated Resume", () => {
  function gatedBar(widthClass: BoardWidth = BOARD_WIDTH.Expanded) {
    render(
      <Bar
        item={itemOf(PAUSED, "paused")}
        details={pausedDetails(PAUSED, [])}
        gate={GATE}
        widthClass={widthClass}
      />,
    );
  }

  it("leads with Resume gated, then Go to the credential, in the act order", async () => {
    gatedBar();
    await screen.findByRole("button", { name: "Last trace" });

    expect(names()).toEqual(["Resume", "Go to openai-main", "Override", "Last trace", "Discard"]);
  });

  it("renders Resume through DisabledAction with its key, its hint and its need line", async () => {
    gatedBar();
    const resume = await screen.findByRole("button", { name: "Resume" });
    const need = screen.getByText("Resume needs: Rotate openai-main in Fix setup.");

    expect(resume).toHaveAttribute("aria-disabled", "true");
    expect(resume).toHaveAttribute("aria-keyshortcuts", "r");
    expect(resume.querySelector("kbd")).toHaveTextContent("r");
    expect(resume).toHaveAttribute("aria-describedby", need.id);
    expect(resume).toHaveAccessibleDescription("Resume needs: Rotate openai-main in Fix setup.");
    expect(need).toBeVisible();
    expect(resume.compareDocumentPosition(need) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps Resume focusable and shows the gate need as its reason after a press", async () => {
    gatedBar();
    const resume = await screen.findByRole("button", { name: "Resume" });

    resume.focus();
    expect(resume).toHaveFocus();
    await userEvent.setup().click(resume);

    expect(await screen.findByText("Rotate openai-main in Fix setup.")).toBeVisible();
  });

  it("jumps to the credential card with Go to", async () => {
    gatedBar();

    await userEvent.setup().click(await screen.findByRole("button", { name: "Go to openai-main" }));

    expect(jump).toHaveBeenCalledWith("credential_refused:openai-main");
  });

  it("leads the phone bar with Go to and names the Resume need in More", async () => {
    gatedBar(BOARD_WIDTH.Compact);
    const user = userEvent.setup();

    expect(names()[0]).toBe("Go to openai-main");
    expect(screen.queryByText(/^Resume needs:/)).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /^More/ }));

    const sheet = await screen.findByRole("dialog", { name: "More acts on Team" });
    const resume = within(sheet).getByRole("button", { name: "Resume" });
    const need = within(sheet).getByText("Resume needs: Rotate openai-main in Fix setup.");

    expect(resume).toHaveAttribute("aria-describedby", need.id);
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
    expect(screen.getByRole("button", { name: "Reject" })).toBeVisible();
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

  it("keeps the line under the row on compact width", async () => {
    vi.mocked(approveWorkbenchCall).mockRejectedValue(new ApiError("unavailable", "Down.", 503));
    render(<Bar item={APPROVAL} details={new Map()} widthClass={BOARD_WIDTH.Compact} />);
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled());

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Approving Create project failed. Down.",
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
  });
});

describe("BoardActBar on compact width", () => {
  const PHONE = BOARD_WIDTH.Compact;

  it("shows the lead act and More with the count of the other acts", async () => {
    render(
      <Bar
        item={itemOf(PAUSED, "paused")}
        details={pausedDetails(PAUSED, [])}
        widthClass={PHONE}
      />,
    );
    await screen.findByRole("button", { name: "More (3)" });

    expect(names()).toEqual(["Resume", "More (3)"]);
    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
  });

  it("opens the other acts in a bottom sheet with Discard last", async () => {
    const user = userEvent.setup();
    render(
      <Bar
        item={itemOf(PAUSED, "paused")}
        details={pausedDetails(PAUSED, [])}
        widthClass={PHONE}
      />,
    );

    await user.click(await screen.findByRole("button", { name: "More (3)" }));

    const sheet = await screen.findByRole("dialog", { name: "More acts on Team" });
    expect(sheet).toHaveAttribute("data-side", "bottom");
    expect(
      within(sheet)
        .getAllByRole("button")
        .map((control) => labelOf(control)),
    ).toEqual(["Override", "Last trace", "Discard", "Cancel"]);
    expect(within(sheet).getByRole("separator")).toBeInTheDocument();
  });

  it("closes only the bottom sheet with Esc and returns the focus to More", async () => {
    const user = userEvent.setup();
    render(
      <Bar
        item={itemOf(PAUSED, "paused")}
        details={pausedDetails(PAUSED, [])}
        widthClass={PHONE}
      />,
    );
    const more = await screen.findByRole("button", { name: "More (3)" });
    await user.click(more);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(more).toHaveFocus();
  });

  it("skips the gated acts and Discard for the lead act", () => {
    const target = node("examine", "Blocked");
    render(<Bar item={itemOf(target, "blocked")} details={new Map()} widthClass={PHONE} />);

    expect(names()[0]).toBe("Override");
    expect(screen.getByRole("button", { name: "Override" })).not.toHaveAttribute("aria-disabled");
    expect(screen.queryByText("Decide needs: the proposals read.")).toBeNull();
  });

  it("falls back to the primary act and shows only its need line under the row", () => {
    render(<Bar item={itemOf(PAUSED, "paused")} details={new Map()} widthClass={PHONE} />);

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
    render(
      <Bar
        item={itemOf(target, "blocked")}
        details={new Map([[target.id, failed]])}
        widthClass={PHONE}
      />,
    );

    await userEvent.setup().click(screen.getByRole("button", { name: "Retry" }));

    expect(retryDetail).toHaveBeenCalledWith("node_1");
  });
});
