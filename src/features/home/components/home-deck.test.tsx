import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listNodeAssessments,
  listNodeEvidence,
  listNodeOutcomes,
  listNodeRevisions,
} from "@/api/resources/mission";
import { listTracePage } from "@/api/resources/tracking";
import { readWorkbenchEvents } from "@/api/resources/workbench";
import type {
  InboxItem,
  MissionFinding,
  MissionNodeRecord,
  Project,
  SchedulerExecutionRecord,
  WorkbenchSessionEvents,
} from "@/api/types";
import type { ToolApprovalItem } from "@/lib/approval-attention";
import {
  type AttentionDetail,
  type AttentionDetails,
  type AttentionItem,
  type DecisionAttentionItem,
  detailKeyOf,
  type FindingReviewItem,
} from "@/lib/attention";
import type { FixAttentionItem } from "@/lib/fix-attention";
import { inboxItemsOf } from "@/lib/inbox-attention";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/tracking");
vi.mock("@/api/resources/workbench");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { useHomeDeck } from "../use-home-deck";
import type { OverviewState } from "../use-overview";
import { HomeDeck } from "./home-deck";

const NOW = Date.UTC(2026, 4, 12, 11, 0, 0);
const HOUR_MS = 3_600_000;

const ATLAS: Project = {
  id: "prj-1",
  name: "atlas",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const ORBIT: Project = { ...ATLAS, id: "prj-2", name: "orbit" };

function fix(id: string, at: number, subject = id, project = ATLAS): FixAttentionItem {
  return {
    id,
    kind: "project_paused",
    group: "fixes",
    project,
    projects: [project],
    at,
    subject,
    cause: `Cause of ${subject}`,
    nodeIds: [],
  };
}

function node(name: string, state: "Paused" | "Blocked" | "Completed"): MissionNodeRecord {
  return {
    id: `node_${name}`,
    intent: "implement",
    tags: [],
    tasks: [],
    filename: `${name}.md`,
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
    state,
    attempt: 2,
    priority: 0,
    depends_on: [],
  };
}

const PAUSED_NODE = node("Pausable", "Paused");

const PAUSED: DecisionAttentionItem = {
  id: "paused:node_Pausable",
  kind: "paused",
  group: "decisions",
  project: ATLAS,
  subject: "Pausable",
  missionVersion: 7,
  node: PAUSED_NODE,
  nodes: [PAUSED_NODE],
  at: NOW - 2 * HOUR_MS,
  cause: "Paused at a limit",
  pause: null,
};

function pausedDetails(): AttentionDetails {
  const detail: AttentionDetail = {
    kind: "paused",
    key: detailKeyOf(PAUSED_NODE),
    executions: {
      status: "ready",
      data: [
        { execution_id: "e1", trace_id: "trace_e1", created_at: 1 } as SchedulerExecutionRecord,
      ],
    },
    actions: { status: "ready", data: [] },
  };
  return new Map([[PAUSED_NODE.id, detail]]);
}

const APPROVAL: ToolApprovalItem = {
  id: "tool_approval:s1",
  group: "decisions",
  kind: "tool_approval",
  subject: "Create project",
  at: NOW - HOUR_MS,
  sessionId: "s1",
  toolCallId: "c1",
  agent: "swe@1",
  operationId: "project.create",
};

const REVIEWED = node("Reviewed", "Completed");

function finding(id: string, label: string, name: string): MissionFinding {
  return {
    id,
    node_id: REVIEWED.id,
    attempt: 1,
    round: 2,
    assessment_id: "assessment_1",
    source: "reviewer",
    label,
    kind: "suggestion",
    action: "yes",
    task_id: null,
    ground: null,
    name,
    description: "d",
    fix: "f",
    why: "w",
    route: "report",
    status: "open",
    fixed_assessment_id: null,
    cause_owner: null,
    created_by: null,
    created_at: 1,
    decision: null,
    decision_reason: null,
    decided_by: null,
    decided_at: null,
  };
}

const FINDINGS: FindingReviewItem = {
  id: "finding_review:node_Reviewed",
  kind: "finding_review",
  group: "decisions",
  project: ATLAS,
  subject: "Reviewed",
  missionVersion: 7,
  node: REVIEWED,
  nodes: [REVIEWED],
  at: NOW - HOUR_MS,
  cause: "Findings wait for a decision",
  findings: [finding("f1", "S1", "Trim the email")],
};

function thread(id: string, overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    link_update_id: id,
    project_id: ATLAS.id,
    external_link: { kind: "jira_issue", resource_identity: "conversation:jira:x", key: id },
    reason: "linked",
    state: "open",
    occurred_at: NOW - HOUR_MS,
    done_at: null,
    snoozed_until: null,
    inbound_event_id: "event_1",
    actor_id: "actor_1",
    trusted: true,
    linked_node_ids: [],
    content: null,
    ...overrides,
  };
}

function overviewOf(
  items: readonly AttentionItem[],
  details: AttentionDetails = new Map(),
  held: ReadonlyMap<string, readonly string[]> = new Map(),
): OverviewState {
  return {
    status: "ready",
    loaded: true,
    error: null,
    projects: [ATLAS, ORBIT],
    running: 1,
    waiting: 2,
    cooling: [],
    unavailable: [],
    livenessFailure: null,
    boardItems: items,
    inbox: {
      open: items.filter((item) => item.kind === "inbox_item").length,
      ready: true,
      close: vi.fn(),
    },
    gates: new Map(),
    held,
    snapshots: [],
    faults: [],
    absent: [],
    allClear: items.length === 0,
    details,
    retryDetail: vi.fn(),
    setDialogOpen: vi.fn(),
    updatedAt: NOW,
    now: NOW,
    refresh: vi.fn(),
    retryFaults: vi.fn(),
    snapshotRunning: false,
  };
}

function Harness({ overview }: { readonly overview: OverviewState }) {
  const deck = useHomeDeck({
    items: overview.boardItems,
    held: overview.held,
    gates: overview.gates,
    details: overview.details,
    now: overview.now,
    status: overview.status,
    loaded: overview.loaded,
    inbox: overview.inbox.open,
    readFault: overview.faults.length > 0,
    setDialogOpen: overview.setDialogOpen,
  });
  return (
    <MemoryRouter>
      <HomeDeck deck={deck} overview={overview} askYumi={() => null} />
    </MemoryRouter>
  );
}

function mount(overview: OverviewState) {
  render(<Harness overview={overview} />);
}

function pendingApproval(input: Record<string, unknown>): WorkbenchSessionEvents {
  return {
    snapshot: {
      pending_approval: { tool_call_id: "c1", operation_id: "project.create", input },
    },
  } as unknown as WorkbenchSessionEvents;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listTracePage).mockResolvedValue({ items: [], next_cursor: null });
  vi.mocked(listNodeAssessments).mockResolvedValue([]);
  vi.mocked(listNodeRevisions).mockResolvedValue([]);
  vi.mocked(listNodeOutcomes).mockResolvedValue([]);
  vi.mocked(listNodeEvidence).mockResolvedValue([]);
  vi.mocked(readWorkbenchEvents).mockResolvedValue({
    snapshot: { pending_approval: null },
  } as unknown as WorkbenchSessionEvents);
});

describe("HomeDeck primary and secondary", () => {
  it("shows the rank, the tab, the projects, the waiting text, the held text, the title, the cause and the lead act", () => {
    const first = fix("a", NOW - 2 * HOUR_MS - 5 * 60_000, "Alpha");
    const second = fix("b", NOW - HOUR_MS, "Beta", ORBIT);
    mount(overviewOf([second, first], new Map(), new Map([["a", ["n1", "n2"]]])));

    const primary = screen.getByRole("group", { name: "Primary: Alpha" });

    expect(within(primary).getByText("#1")).toBeVisible();
    expect(within(primary).getByText("Fix setup")).toBeVisible();
    expect(within(primary).getByText("atlas")).toBeVisible();
    expect(within(primary).getByText("Waiting 2 h 5 min · since 08:55")).toBeVisible();
    expect(within(primary).getByText("2 nodes wait on this")).toBeVisible();
    expect(within(primary).getByText("Alpha: cause of alpha")).toBeVisible();
    expect(within(primary).getByText("Cause of Alpha")).toBeVisible();
    expect(within(primary).getByRole("button", { name: "Resume project" })).toBeVisible();
    const next = screen.getByText("Next #2 Beta");
    expect(next).toBeVisible();
    expect(next.closest("button")).toBeNull();
  });

  it("names the section and the count line", () => {
    mount(overviewOf([fix("a", 1), fix("b", 2), fix("c", 3)]));

    const section = screen.getByRole("region", { name: "Waiting acts" });

    expect(section).toHaveAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight");
    expect(within(section).getByText("1 of 3 waiting · 3 acts · No node waits")).toBeVisible();
    expect(
      within(section).getByText(/^3 acts wait for you\. 0 nodes wait on them\. Start here:/),
    ).toBeVisible();
  });

  it("shows the work fact of the summary and steps the cursor to #1 from its link", async () => {
    const user = userEvent.setup();
    mount(overviewOf([fix("a", 1, "Alpha"), fix("b", 2, "Beta")]));
    await user.click(screen.getByRole("button", { name: "Next ›" }));
    expect(screen.getByRole("group", { name: "Primary: Beta" })).toBeVisible();

    expect(screen.getByText("1 execution runs · 2 jobs wait")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Alpha" }));

    expect(screen.getByRole("group", { name: "Primary: Alpha" })).toBeVisible();
  });
});

describe("HomeDeck steps", () => {
  it("disables Previous at 1 and Next at N", async () => {
    const user = userEvent.setup();
    mount(overviewOf([fix("a", 1, "Alpha"), fix("b", 2, "Beta")]));
    const previous = screen.getByRole("button", { name: "‹ Previous" });
    const next = screen.getByRole("button", { name: "Next ›" });

    expect(previous).toBeDisabled();
    expect(next).toBeEnabled();
    await user.click(next);

    expect(screen.getByRole("group", { name: "Primary: Beta" })).toBeVisible();
    expect(next).toBeDisabled();
    expect(previous).toBeEnabled();
    expect(screen.queryByText(/^Next #/)).toBeNull();
  });

  it("steps with the arrow keys", async () => {
    const user = userEvent.setup();
    mount(overviewOf([fix("a", 1, "Alpha"), fix("b", 2, "Beta"), fix("c", 3, "Gamma")]));
    screen.getByRole("button", { name: "Next ›" }).focus();

    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("group", { name: "Primary: Beta" })).toBeVisible();
    await user.keyboard("{ArrowLeft}");

    expect(screen.getByRole("group", { name: "Primary: Alpha" })).toBeVisible();
  });
});

describe("HomeDeck list", () => {
  it("opens the list under the control, moves the cursor on a row click and closes it", async () => {
    const user = userEvent.setup();
    mount(overviewOf([fix("a", 1, "Alpha"), fix("b", 2, "Beta"), fix("c", 3, "Gamma")]));

    const expand = screen.getByRole("button", { name: "Expand (3)" });
    expect(expand).toHaveAttribute("aria-expanded", "false");
    await user.click(expand);

    const collapse = screen.getByRole("button", { name: "Collapse ▴" });
    const list = screen.getByRole("list", { name: "Waiting items" });
    expect(collapse).toHaveAttribute("aria-expanded", "true");
    expect(collapse.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);

    await user.click(within(list).getByRole("button", { name: "Gamma" }));

    expect(screen.getByRole("group", { name: "Primary: Gamma" })).toBeVisible();
    expect(screen.queryByRole("list", { name: "Waiting items" })).toBeNull();
    expect(screen.getByRole("button", { name: "Expand (3)" })).toBeVisible();
  });

  it("closes the list with Collapse and with Esc", async () => {
    const user = userEvent.setup();
    mount(overviewOf([fix("a", 1), fix("b", 2)]));

    await user.click(screen.getByRole("button", { name: "Expand (2)" }));
    await user.click(screen.getByRole("button", { name: "Collapse ▴" }));
    expect(screen.queryByRole("list", { name: "Waiting items" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Expand (2)" }));
    await user.keyboard("{Escape}");

    expect(screen.queryByRole("list", { name: "Waiting items" })).toBeNull();
  });

  it("finds a row by its cause and by an Inbox author", async () => {
    const user = userEvent.setup();
    const inbox = inboxItemsOf(
      [
        thread("KD-9", {
          content: { author: "Mira", body: "Look", url: "https://x.test", occurred_at: 1 },
        }),
      ],
      [ATLAS],
    );
    mount(overviewOf([fix("a", 1, "Alpha"), fix("b", 2, "Beta"), ...inbox]));
    await user.click(screen.getByRole("button", { name: /^Expand/ }));
    const search = screen.getByRole("searchbox", { name: "Search the waiting items" });
    const rows = () => within(screen.getByRole("list", { name: "Waiting items" }));

    await user.type(search, "cause of beta");
    expect(rows().getAllByRole("listitem")).toHaveLength(1);
    expect(rows().getByRole("button", { name: "Beta" })).toBeVisible();

    await user.clear(search);
    await user.type(search, "mira");
    expect(rows().getAllByRole("listitem")).toHaveLength(1);
    expect(rows().getByRole("button", { name: "KD-9" })).toBeVisible();

    await user.clear(search);
    await user.type(search, "zzz");
    expect(screen.getByText("No waiting item matches.")).toBeVisible();
  });

  it("shows only the rows of a pressed tab and returns to All on a second press", async () => {
    const user = userEvent.setup();
    mount(overviewOf([fix("a", 1, "Alpha"), APPROVAL]));
    await user.click(screen.getByRole("button", { name: /^Expand/ }));
    const rows = () => within(screen.getByRole("list", { name: "Waiting items" }));
    expect(rows().getAllByRole("listitem")).toHaveLength(2);

    const setup = screen.getByRole("button", { name: "Setup 1" });
    await user.click(setup);

    expect(rows().getAllByRole("listitem")).toHaveLength(1);
    expect(rows().getByRole("button", { name: "Alpha" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Setup 1" }));

    expect(rows().getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "All 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("shows 50 rows of 120 items and Show 50 more", async () => {
    const user = userEvent.setup();
    const items = Array.from({ length: 120 }, (_, index) => fix(`item-${index}`, index + 1));
    mount(overviewOf(items));
    await user.click(screen.getByRole("button", { name: "Expand (120)" }));

    const list = screen.getByRole("list", { name: "Waiting items" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(50);
    await user.click(screen.getByRole("button", { name: "Show 50 more" }));

    expect(within(list).getAllByRole("listitem")).toHaveLength(100);
  });

  it("holds no act on a row", async () => {
    const user = userEvent.setup();
    mount(overviewOf([PAUSED], pausedDetails()));
    await user.click(screen.getByRole("button", { name: "Expand (1)" }));

    const row = within(screen.getByRole("list", { name: "Waiting items" }));

    expect(row.getAllByRole("button").map((button) => button.textContent)).toEqual(["Pausable"]);
  });
});

describe("HomeDeck acts", () => {
  it("keeps Discard in More and opens its AlertDialog with the focus on Cancel", async () => {
    const user = userEvent.setup();
    mount(overviewOf([PAUSED], pausedDetails()));

    expect(screen.queryByRole("button", { name: "Discard" })).toBeNull();
    await user.click(await screen.findByRole("button", { name: /^More/ }));
    const sheet = await screen.findByRole("dialog", { name: "More acts on Pausable" });
    await user.click(within(sheet).getByRole("button", { name: "Discard" }));

    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText("Discard Pausable?")).toBeVisible();
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Keep the node" })).toHaveFocus(),
    );
  });

  it("shows the Change asked rows and the acts Approve, Reject and Open chat of a tool approval", async () => {
    const user = userEvent.setup();
    vi.mocked(readWorkbenchEvents).mockResolvedValue(pendingApproval({ name: "Atlas" }));
    mount(overviewOf([APPROVAL]));

    expect(await screen.findByText("name becomes")).toBeVisible();
    expect(screen.getByText("Atlas")).toBeVisible();
    expect(screen.getByText("project.create")).toBeVisible();
    await waitFor(() => expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled());
    await user.click(screen.getByRole("button", { name: /^More/ }));
    const sheet = await screen.findByRole("dialog", { name: "More acts on Create project" });

    expect(within(sheet).getByRole("button", { name: "Reject" })).toBeVisible();
    expect(within(sheet).getByRole("button", { name: "Open chat" })).toBeVisible();
  });

  it("leads a finding card with Decide, which opens the finding sheet", async () => {
    const user = userEvent.setup();
    mount(overviewOf([FINDINGS]));

    const decide = screen.getByRole("button", { name: "Decide" });
    expect(within(screen.getByRole("group", { name: "Acts" })).getAllByRole("button")[0]).toBe(
      decide,
    );
    await user.click(decide);

    const sheet = await screen.findByRole("dialog", { name: "Decide findings of Reviewed" });
    expect(within(sheet).getByText("Trim the email")).toBeVisible();
    await user.click(within(sheet).getByRole("button", { name: "Dismiss the finding S1" }));

    expect(
      within(await screen.findByRole("alertdialog")).getByText("Dismiss the finding S1?"),
    ).toBeVisible();
  });

  it("renders an Inbox body with HTML text as plain text", () => {
    const body = "<b>bold</b> <script>alert(1)</script>";
    const inbox = inboxItemsOf(
      [
        thread("KD-1", {
          content: { author: "Mira", body, url: "https://x.test", occurred_at: 1 },
        }),
      ],
      [ATLAS],
    );
    mount(overviewOf(inbox));

    expect(screen.getByText(body)).toBeVisible();
    expect(document.querySelector("b")).toBeNull();
    expect(document.querySelector("script")).toBeNull();
  });
});

describe("HomeDeck without an item", () => {
  it("shows All clear", () => {
    mount(overviewOf([]));

    expect(screen.getByText("All clear")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Next ›" })).toBeNull();
  });
});
