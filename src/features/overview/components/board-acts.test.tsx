import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listAllCredentials, verifyCredential } from "@/api/resources/credentials";
import { rebuildEnvironment } from "@/api/resources/projects";
import { listTracePage } from "@/api/resources/tracking";
import { approveWorkbenchCall, readWorkbenchEvents } from "@/api/resources/workbench";
import type {
  Credential,
  Intent,
  MissionEvidence,
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
import type {
  CredentialRefusedItem,
  EnvironmentFailedItem,
  ProjectPausedItem,
} from "@/lib/fix-attention";

import type { BoardGate } from "@/lib/board-items";
import { BOARD_WIDTH } from "@/lib/board-width";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/credentials");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/tracking");
vi.mock("@/api/resources/workbench");
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
const jump = vi.fn();

function renderActs(
  item: AttentionItem,
  details: AttentionDetails = new Map(),
  registerDialogCloser: (close: (() => void) | null) => void = vi.fn(),
  gate: BoardGate | null = null,
) {
  render(
    <MemoryRouter>
      <BoardActsProvider
        item={item}
        details={details}
        reload={vi.fn()}
        retryDetail={vi.fn()}
        markActed={vi.fn()}
        setDialogOpen={setDialogOpen}
        registerDialogCloser={registerDialogCloser}
        widthClass={BOARD_WIDTH.Expanded}
        gate={gate}
        jump={jump}
      >
        <BoardActBar />
      </BoardActsProvider>
    </MemoryRouter>,
  );
}

function labelOf(control: HTMLElement): string {
  return Array.from(control.childNodes)
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent)
    .join("");
}

function actNames(): readonly (string | null)[] {
  const group = screen.getByRole("group", { name: "Acts" });
  return within(group)
    .getAllByRole("button")
    .map((control) => control.getAttribute("aria-label") ?? labelOf(control));
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

function pullRequestEvidence(resourceIdentity: string, number: number): MissionEvidence {
  return {
    id: "evidence_1",
    node_id: "node_1",
    attempt: 2,
    subject: "pull request",
    assets: [
      {
        kind: "platform",
        address: { kind: "pull_request", resource_identity: resourceIdentity, number },
      },
    ],
    created_at: 1,
  } as unknown as MissionEvidence;
}

function mergeWaitWith(evidence: MissionEvidence | null): MergeWaitItem {
  return { ...MERGE_WAIT, request: { action: unresolved(), evidence } };
}

const GATE: BoardGate = {
  itemId: "credential_refused:openai-main",
  need: "Rotate openai-main in Fix setup",
  short: "Rotate openai-main",
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

const ENVIRONMENT_FAILED: EnvironmentFailedItem = {
  id: "environment_failed:prj-1:binding_1",
  kind: "environment_failed",
  group: "fixes",
  project: PROJECT,
  subject: "api",
  at: null,
  cause: "Environment failed",
  nodeIds: [],
  projects: [PROJECT],
  binding: "api",
  bindingId: "binding_1",
  failure: null,
  failureClass: "setup",
} as unknown as EnvironmentFailedItem;

function serverCopy(name: string): Credential {
  return {
    name,
    platform: "openai",
    holder: "server",
    sealed_to: null,
    sealed_current: true,
    revisions: [{ id: "live", revision: 5, metadata: null, created_at: 2, ended_at: null }],
  };
}

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
  vi.mocked(listAllCredentials).mockResolvedValue([serverCopy("openai-main")]);
  vi.mocked(readWorkbenchEvents).mockResolvedValue({
    snapshot: { pending_approval: null },
  } as Awaited<ReturnType<typeof readWorkbenchEvents>>);
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

  it("leads an outside item with Open pull request, then Check now", () => {
    renderActs(mergeWaitWith(pullRequestEvidence("repository:github:kanthorlabs/kanthord", 42)));

    expect(actNames()).toEqual(["Open pull request", "Check now"]);
  });

  it("opens the pull request on GitHub in a new tab", () => {
    renderActs(mergeWaitWith(pullRequestEvidence("repository:github:kanthorlabs/kanthord", 42)));

    const link = screen.getByRole("button", { name: "Open pull request" });

    expect(link).toHaveAttribute("href", "https://github.com/kanthorlabs/kanthord/pull/42");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noreferrer");
    expect(link).toHaveTextContent(/^Open pull request$/);
  });

  it("offers no Open pull request without a pull request in the evidence", () => {
    renderActs(mergeWaitWith(null));

    expect(actNames()).toEqual(["Check now"]);
  });

  it("offers no Open pull request for a resource that is not on GitHub", () => {
    renderActs(mergeWaitWith(pullRequestEvidence("repository:gitlab:group/project", 7)));

    expect(actNames()).toEqual(["Check now"]);
  });

  it("goes to the refused credential of a gated Paused item", async () => {
    renderActs(decision("paused", PAUSED), pausedDetail(PAUSED, [], [execution()]), vi.fn(), GATE);

    await waitFor(() =>
      expect(actNames()).toEqual([
        "Resume",
        "Go to openai-main",
        "Override",
        "Last trace",
        "Discard",
      ]),
    );
    expect(screen.getByText("Resume needs: Rotate openai-main in Fix setup.")).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Go to openai-main" }));

    expect(jump).toHaveBeenCalledWith("credential_refused:openai-main");
  });

  it("keeps a Paused item without a gate on today's acts", async () => {
    renderActs(decision("paused", PAUSED), pausedDetail(PAUSED, [], [execution()]));

    await waitFor(() =>
      expect(actNames()).toEqual(["Resume", "Override", "Last trace", "Discard"]),
    );
  });

  it("leads a credential refusal with Rotate and links its credential", async () => {
    renderActs(CREDENTIAL);

    expect(actNames()).toEqual(["Rotate", "Verify credential", "Open credential"]);
    expect(screen.getByRole("button", { name: "Open credential" })).toHaveAttribute(
      "href",
      "/llm/openai-main",
    );
    expect(screen.getByText("Rotate needs: the credential read.")).toBeVisible();
    await waitFor(() => expect(screen.queryByText(/^Rotate needs:/)).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Rotate" })).not.toHaveAttribute("aria-disabled");
  });

  it("gates Rotate when the credential has no server copy", async () => {
    vi.mocked(listAllCredentials).mockResolvedValue([]);
    renderActs(CREDENTIAL);

    expect(await screen.findByText("Rotate needs: a server copy of openai-main.")).toBeVisible();
    expect(actNames()).toEqual(["Rotate", "Verify credential", "Open credential"]);
    expect(screen.getByRole("button", { name: "Rotate" })).toHaveAttribute("aria-disabled", "true");
  });

  it("opens the Rotate sheet from the act", async () => {
    renderActs(CREDENTIAL);
    await waitFor(() => expect(screen.queryByText(/^Rotate needs:/)).not.toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Rotate" }));

    expect(await screen.findByRole("dialog", { name: "Rotate openai-main" })).toBeVisible();
    expect(setDialogOpen).toHaveBeenCalledWith(CREDENTIAL.id, expect.any(String), true);
  });

  it("leads an environment failure with Open project and ends with Run onboarding again", () => {
    renderActs(ENVIRONMENT_FAILED);

    expect(actNames()).toEqual(["Open project", "Run onboarding again"]);
  });

  it("resumes a paused project through the project action", () => {
    renderActs(PROJECT_PAUSED);

    expect(actNames()).toEqual(["Resume project"]);
  });

  it("gates Approve before the session read and keeps Reject and Open chat", () => {
    renderActs(APPROVAL);

    expect(actNames()).toEqual(["Approve", "Reject", "Open chat"]);
    expect(screen.getByText("Approve needs: the session read.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Approve" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(screen.getByRole("button", { name: "Reject" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Open chat" })).toHaveAttribute(
      "href",
      expect.stringContaining("s1"),
    );
  });

  it("enables Approve once the session read is ready", async () => {
    renderActs(APPROVAL);

    await waitFor(() => expect(screen.queryByText(/^Approve needs:/)).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
    expect(actNames()).toEqual(["Approve", "Reject", "Open chat"]);
  });

  it("sends Approve and Reject through the acts", async () => {
    vi.mocked(approveWorkbenchCall).mockResolvedValue({} as never);
    renderActs(APPROVAL);
    await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled());

    await userEvent.click(screen.getByRole("button", { name: "Approve" }));
    await userEvent.click(screen.getByRole("button", { name: "Reject" }));

    expect(approveWorkbenchCall).toHaveBeenCalledWith("s1", "c1", true);
    expect(approveWorkbenchCall).toHaveBeenCalledWith("s1", "c1", false);
  });

  it("shows the result of Verify credential in a status badge", async () => {
    vi.mocked(verifyCredential).mockResolvedValue({
      status: "unhealthy",
      capability: "llm",
      failure_reason: "unauthorized",
    });
    renderActs(CREDENTIAL);

    await userEvent.click(screen.getByRole("button", { name: "Verify credential" }));

    expect(await screen.findByRole("status")).toHaveTextContent("Refused: unauthorized");
    expect(verifyCredential).toHaveBeenCalledWith("llm", "openai-main");
  });

  it("starts the onboarding of a failed environment with the binding id", async () => {
    vi.mocked(rebuildEnvironment).mockResolvedValue({} as never);
    renderActs(ENVIRONMENT_FAILED);

    await userEvent.click(screen.getByRole("button", { name: "Run onboarding again" }));

    expect(rebuildEnvironment).toHaveBeenCalledWith("prj-1", "binding_1");
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Onboarding of api started."));
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
        registerDialogCloser={vi.fn()}
        widthClass={BOARD_WIDTH.Expanded}
      >
        <BoardActBar />
      </BoardActsProvider>,
    );

    expect(screen.queryByRole("group", { name: "Acts" })).not.toBeInTheDocument();
  });
});

describe("BoardActsProvider dialogs", () => {
  it.each([
    [
      "Unblock",
      decision("blocked", IMPLEMENT),
      new Map(),
      "Unblock Team?",
      "Keep it blocked",
      { id: "unblock" },
    ],
    [
      "Override",
      decision("blocked", IMPLEMENT),
      new Map(),
      "Override Team?",
      "Keep the node",
      { id: "override" },
    ],
    [
      "Discard",
      decision("blocked", IMPLEMENT),
      new Map(),
      "Discard Team?",
      "Keep the node",
      { id: "discard" },
    ],
    [
      "Decide",
      decision("blocked", EXAMINE),
      blockedDetail(EXAMINE),
      "Decide the proposals of Team?",
      "Keep the proposals",
      { id: "decide" },
    ],
    [
      "Resume",
      decision("paused", PAUSED),
      pausedDetail(PAUSED, []),
      "Resume Team?",
      "Keep it paused",
      { id: "resume" },
    ],
    [
      "Remove dependency on First",
      decision("dependency_discarded", DEPENDENCY, {
        discarded: [{ id: "dep_1", name: "First" }],
      }),
      openDetail(DEPENDENCY),
      "Remove the dependency of Team on First?",
      "Keep the dependency",
      { id: "remove_dependency", dependency: "First" },
    ],
  ])(
    "opens the dialog of %s and reports the open and the close with the act",
    async (name, item, details, title, cancel, acted) => {
      setDialogOpen.mockClear();
      const user = userEvent.setup();
      renderActs(item, details);

      await user.click(screen.getByRole("button", { name }));

      expect(await screen.findByRole("alertdialog", { name: title })).toBeVisible();
      expect(setDialogOpen).toHaveBeenLastCalledWith(item.id, "node_1", true);

      await user.click(screen.getByRole("button", { name: cancel }));

      await waitFor(() =>
        expect(setDialogOpen).toHaveBeenLastCalledWith(item.id, "node_1", false, acted),
      );
    },
  );

  it("registers a closer that cancels the open dialog", async () => {
    const user = userEvent.setup();
    const registerDialogCloser = vi.fn();
    renderActs(decision("blocked", IMPLEMENT), new Map(), registerDialogCloser);
    await user.click(screen.getByRole("button", { name: "Discard" }));
    await screen.findByRole("alertdialog", { name: "Discard Team?" });

    const closer = registerDialogCloser.mock.lastCall?.[0];
    expect(closer).toBeTypeOf("function");
    act(() => closer?.());

    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });
});
