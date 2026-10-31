import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listTracePage } from "@/api/resources/tracking";
import type {
  Intent,
  MissionExternalAction,
  MissionNodeRecord,
  MissionProposal,
  NodeState,
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
  type MergeWaitItem,
} from "@/lib/attention";
import type { CredentialRefusedItem, ProjectPausedItem } from "@/lib/fix-attention";

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

function node(
  intent: Intent,
  state: NodeState,
  overrides: Partial<MissionNodeRecord> = {},
): MissionNodeRecord {
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
    ...overrides,
  };
}

function decision(
  kind: "blocked" | "paused" | "dependency_discarded",
  target: MissionNodeRecord,
  extra: object = {},
): DecisionAttentionItem {
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
    discarded: [],
    ...extra,
  } as DecisionAttentionItem;
}

function proposal(): MissionProposal {
  return {
    id: "proposal_1",
    node_id: "node_1",
    attempt: 2,
    assessment_id: "assessment_1",
    content: {
      dependency_id: "node_2",
      name: "Fix it",
      requirement: "r",
      criterion: "c",
      task: { name: "t", requirement: "r", criterion: "c", verifications: ["v"] },
    },
    created_node_id: null,
    approved_at: null,
    rejected_at: null,
    created_at: 1,
  };
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

function execution(): SchedulerExecutionRecord {
  return { execution_id: "e1", trace_id: "trace_e1", created_at: 1 } as SchedulerExecutionRecord;
}

function detailsOf(detail: AttentionDetail, target: MissionNodeRecord): AttentionDetails {
  return new Map([[target.id, detail]]);
}

function pausedDetail(
  target: MissionNodeRecord,
  actions: readonly MissionExternalAction[],
  executions: readonly SchedulerExecutionRecord[] = [],
): AttentionDetails {
  return detailsOf(
    {
      kind: "paused",
      key: detailKeyOf(target),
      executions: { status: "ready", data: executions },
      actions: { status: "ready", data: actions },
    },
    target,
  );
}

function blockedDetail(target: MissionNodeRecord): AttentionDetails {
  return detailsOf(
    {
      kind: "blocked",
      key: detailKeyOf(target),
      assessment: { status: "ready", data: null },
      proposals: { status: "ready", data: [proposal()] },
    },
    target,
  );
}

function openDetail(target: MissionNodeRecord): AttentionDetails {
  return detailsOf(
    { kind: "open", key: detailKeyOf(target), actions: { status: "ready", data: [] } },
    target,
  );
}

const setDialogOpen = vi.fn();

function renderActs(item: AttentionItem, details: AttentionDetails = new Map()) {
  render(
    <MemoryRouter>
      <BoardActsProvider
        item={item}
        details={details}
        reload={vi.fn()}
        retryDetail={vi.fn()}
        markActed={vi.fn()}
        setDialogOpen={setDialogOpen}
      >
        <BoardActBar />
      </BoardActsProvider>
    </MemoryRouter>,
  );
}

function actNames(): readonly (string | null)[] {
  const group = screen.getByRole("group", { name: "Acts" });
  return within(group)
    .getAllByRole("button")
    .map((control) => control.getAttribute("aria-label") ?? control.textContent);
}

const PAUSED = node("implement", "Paused");
const EXAMINE = node("examine", "Blocked");
const IMPLEMENT = node("implement", "Blocked");
const DEPENDENCY = node("implement", "Pending", { depends_on: ["dep_1", "dep_2"] });

const MERGE_WAIT: MergeWaitItem = {
  id: "merge_wait:node_1",
  kind: "merge_wait",
  group: "outside",
  project: PROJECT,
  subject: "Team",
  missionVersion: 7,
  node: node("implement", "External.Requested"),
  nodes: [],
  at: null,
  cause: "Waits for merge",
  request: { action: unresolved(), evidence: null },
};

const PROJECT_PAUSED: ProjectPausedItem = {
  id: "project_paused:prj-1",
  kind: "project_paused",
  group: "fixes",
  project: PROJECT,
  subject: "kanthord",
  at: null,
  cause: "Project paused",
  nodeIds: [],
  projects: [PROJECT],
};

const CREDENTIAL: CredentialRefusedItem = {
  id: "credential_refused:openai-main",
  kind: "credential_refused",
  group: "fixes",
  project: PROJECT,
  subject: "openai-main",
  at: null,
  cause: "Credential refused",
  nodeIds: [],
  projects: [PROJECT],
  count: 1,
  projectCount: 1,
  credential: "openai-main",
  credentials: ["openai-main"],
  nodeName: "Team",
};

const APPROVAL: ToolApprovalItem = {
  id: "tool_approval:s1",
  group: "decisions",
  kind: "tool_approval",
  subject: "Create",
  at: 2,
  sessionId: "s1",
  toolCallId: "c1",
  agent: "swe@1",
  operationId: "project.create",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listTracePage).mockResolvedValue({ items: [], next_cursor: null });
});

describe("BoardActsProvider act order", () => {
  it("gates every act of a paused item before the reads", () => {
    renderActs(decision("paused", PAUSED));

    expect(actNames()).toEqual(["Resume", "Override", "Check now", "Discard"]);
    expect(
      screen.getByText("Resume needs: the executions and external actions read."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Resume" })).toHaveAttribute("aria-disabled", "true");
  });

  it("leads a paused item with Resume and ends with Discard", async () => {
    renderActs(decision("paused", PAUSED), pausedDetail(PAUSED, [], [execution()]));

    await waitFor(() =>
      expect(actNames()).toEqual(["Resume", "Override", "Last trace", "Discard"]),
    );
    expect(screen.queryByText(/needs:/)).not.toBeInTheDocument();
  });

  it("puts Check now between Resume and Last trace for a paused item with a request", () => {
    renderActs(decision("paused", PAUSED), pausedDetail(PAUSED, [unresolved()], [execution()]));

    expect(actNames().slice(0, 2)).toEqual(["Resume", "Check now"]);
    expect(actNames()).not.toContain("Override");
    expect(actNames()).not.toContain("Discard");
  });

  it("leads a Decide proposal item with Decide", () => {
    renderActs(decision("blocked", EXAMINE), blockedDetail(EXAMINE));

    expect(actNames()).toEqual(["Decide", "Unblock", "Override", "Discard"]);
  });

  it("gates Decide before the proposals read", () => {
    renderActs(decision("blocked", EXAMINE));

    expect(actNames()).toEqual(["Decide", "Unblock", "Override", "Discard"]);
    expect(screen.getByText("Decide needs: the proposals read.")).toBeVisible();
    expect(screen.getByText("Unblock needs: the proposals read.")).toBeVisible();
    expect(screen.getByText("Discard needs: the proposals read.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Decide" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("button", { name: "Override" })).toBeEnabled();
  });

  it("leads a Rule item with Unblock and shows no need line before a read", () => {
    renderActs(decision("blocked", IMPLEMENT));

    expect(actNames()).toEqual(["Unblock", "Override", "Discard"]);
    expect(screen.getByRole("button", { name: "Unblock" })).toBeEnabled();
    expect(screen.queryByText(/needs:/)).not.toBeInTheDocument();
  });

  it("lists a removal for each dependency of a dependency item", () => {
    renderActs(
      decision("dependency_discarded", DEPENDENCY, {
        discarded: [
          { id: "dep_1", name: "First" },
          { id: "dep_2", name: "Second" },
        ],
      }),
      openDetail(DEPENDENCY),
    );

    expect(actNames()).toEqual([
      "Remove dependency on First",
      "Remove dependency on Second",
      "Discard",
    ]);
  });

  it("gates a dependency item with an open attempt before the read", () => {
    renderActs(
      decision("dependency_discarded", DEPENDENCY, {
        discarded: [{ id: "dep_1", name: "First" }],
      }),
    );

    expect(actNames()).toEqual(["Remove dependency on First", "Check now", "Discard"]);
    expect(screen.getByText("Remove dependency needs: the external actions read.")).toBeVisible();
    expect(screen.getByText("Check now needs: the external actions read.")).toBeVisible();
  });

  it("shows Check now for an outside item and gates it before the read", () => {
    const target = MERGE_WAIT.node;
    renderActs(MERGE_WAIT);

    expect(actNames()).toEqual(["Check now"]);
    expect(screen.getByText("Check now needs: the external actions read.")).toBeVisible();

    renderActs(
      MERGE_WAIT,
      detailsOf(
        {
          kind: "external",
          key: detailKeyOf(target),
          actions: { status: "ready", data: [unresolved()] },
          evidence: { status: "ready", data: [] },
          refreshFault: null,
        },
        target,
      ),
    );
    expect(screen.getAllByRole("button", { name: "Check now" })[1]).toBeEnabled();
  });

  it("links a fix item with its target", () => {
    renderActs(CREDENTIAL);

    expect(actNames()).toEqual(["Open credential"]);
    expect(screen.getByRole("button", { name: "Open credential" })).toHaveAttribute(
      "href",
      "/llm/openai-main",
    );
  });

  it("resumes a paused project through the project action", () => {
    renderActs(PROJECT_PAUSED);

    expect(actNames()).toEqual(["Resume project"]);
  });

  it("links a tool approval to its chat", () => {
    renderActs(APPROVAL);

    expect(actNames()).toEqual(["Open chat"]);
    expect(screen.getByRole("button", { name: "Open chat" })).toHaveAttribute(
      "href",
      expect.stringContaining("s1"),
    );
  });

  it("offers no act without an item", () => {
    render(
      <BoardActsProvider
        item={null}
        details={new Map()}
        reload={vi.fn()}
        retryDetail={vi.fn()}
        markActed={vi.fn()}
        setDialogOpen={setDialogOpen}
      >
        <BoardActBar />
      </BoardActsProvider>,
    );

    expect(screen.queryByRole("group", { name: "Acts" })).not.toBeInTheDocument();
  });
});

describe("BoardActsProvider dialogs", () => {
  it.each([
    ["Unblock", decision("blocked", IMPLEMENT), new Map(), "Unblock Team?", "Keep it blocked"],
    ["Override", decision("blocked", IMPLEMENT), new Map(), "Override Team?", "Keep the node"],
    ["Discard", decision("blocked", IMPLEMENT), new Map(), "Discard Team?", "Keep the node"],
    [
      "Decide",
      decision("blocked", EXAMINE),
      blockedDetail(EXAMINE),
      "Decide the proposals of Team?",
      "Keep the proposals",
    ],
    [
      "Resume",
      decision("paused", PAUSED),
      pausedDetail(PAUSED, []),
      "Resume Team?",
      "Keep it paused",
    ],
    [
      "Remove dependency on First",
      decision("dependency_discarded", DEPENDENCY, {
        discarded: [{ id: "dep_1", name: "First" }],
      }),
      openDetail(DEPENDENCY),
      "Remove the dependency of Team on First?",
      "Keep the dependency",
    ],
  ])(
    "opens the dialog of %s and reports the open and the close",
    async (name, item, details, title, cancel) => {
      setDialogOpen.mockClear();
      const user = userEvent.setup();
      renderActs(item, details);

      await user.click(screen.getByRole("button", { name }));

      expect(await screen.findByRole("alertdialog", { name: title })).toBeVisible();
      expect(setDialogOpen).toHaveBeenLastCalledWith(item.id, "node_1", true);

      await user.click(screen.getByRole("button", { name: cancel }));

      await waitFor(() => expect(setDialogOpen).toHaveBeenLastCalledWith(item.id, "node_1", false));
    },
  );
});
