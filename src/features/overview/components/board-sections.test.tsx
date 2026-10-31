import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { listNodeAssessments, listNodeEvidence } from "@/api/resources/mission";
import { listTracePage, listTraceSpans } from "@/api/resources/tracking";
import { readWorkbenchEvents } from "@/api/resources/workbench";
import type {
  EnvironmentState,
  MissionAssessment,
  MissionEvidence,
  MissionNodeRecord,
  MissionProposal,
  Project,
  SchedulerExecutionRecord,
  TraceListItem,
  TraceSpan,
  WorkbenchSessionEvents,
} from "@/api/types";
import type { ToolApprovalItem } from "@/lib/approval-attention";
import {
  type AttentionDetails,
  type AttentionItem,
  type DecisionAttentionItem,
  detailKeyOf,
} from "@/lib/attention";
import type { BoardGate } from "@/lib/board-items";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";
import type {
  CredentialRefusedItem,
  EnvironmentFailedItem,
  ProjectPausedItem,
} from "@/lib/fix-attention";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/tracking");
vi.mock("@/api/resources/workbench");

import { BoardReadsProvider } from "../use-board-reads";
import { BoardActsProvider } from "./board-acts";
import { BoardSections, type HeldNode } from "./board-sections";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

function node(
  id: string,
  name: string,
  state: "Paused" | "Blocked" | "Pending",
): MissionNodeRecord {
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
    state,
    attempt: 2,
    priority: 0,
    depends_on: [],
  };
}

const TEAM = node("node_1", "Team", "Blocked");
const PAUSED = node("node_2", "Pause", "Paused");

const BLOCKED: DecisionAttentionItem = {
  id: "blocked:node_1",
  kind: "blocked",
  group: "decisions",
  project: PROJECT,
  subject: "Team",
  missionVersion: 7,
  node: TEAM,
  nodes: [TEAM],
  at: null,
  cause: "Criterion not met",
};

const PAUSED_ITEM: DecisionAttentionItem = {
  id: "paused:node_2",
  kind: "paused",
  group: "decisions",
  project: PROJECT,
  subject: "Pause",
  missionVersion: 7,
  node: PAUSED,
  nodes: [PAUSED],
  at: null,
  pause: null,
  cause: null,
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
  projects: [PROJECT, { ...PROJECT, id: "prj-2", name: "beta" }],
  count: 3,
  projectCount: 2,
  credential: "openai-main",
  credentials: ["openai-main"],
  nodeName: "Team",
};

const ENVIRONMENT: EnvironmentFailedItem = {
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

function environmentState(): EnvironmentState {
  return {
    binding_id: "binding_1",
    binding_name: "main",
    status: "failed",
    failure: {
      class: "setup_failed",
      origin: "setup",
      execution_id: null,
      command: "npm test",
      exit_code: 1,
      tail: "",
      reproduce: "npm test --watch=false",
      ended_at: 1,
    },
  } as unknown as EnvironmentState;
}

function sessionEvents(input: Record<string, unknown> | null): WorkbenchSessionEvents {
  return {
    entries: [],
    version: 1,
    snapshot: {
      pending_approval:
        input === null ? null : { tool_call_id: "c1", operation_id: "project.create", input },
    },
  } as unknown as WorkbenchSessionEvents;
}

function holds(...names: readonly string[]): readonly HeldNode[] {
  return names.map((name, index) => ({
    node: node(`held_${index}`, name, "Pending"),
    project: PROJECT,
  }));
}

function renderSections(
  item: AttentionItem,
  options: {
    readonly held?: readonly HeldNode[];
    readonly widthClass?: BoardWidth;
    readonly environments?: readonly EnvironmentState[] | null;
    readonly details?: AttentionDetails;
    readonly provider?: boolean;
    readonly gate?: BoardGate | null;
  } = {},
) {
  const sections = (
    <BoardSections
      item={item}
      details={options.details ?? new Map()}
      tabName="Rule"
      widthClass={options.widthClass ?? BOARD_WIDTH.Expanded}
      position={{ index: 1, total: 3 }}
      now={10_000_000}
      held={options.held ?? []}
      environments={options.environments ?? null}
      gate={options.gate ?? null}
      titleId="detail-title"
      titleRef={() => undefined}
    />
  );
  const reads = (
    <BoardReadsProvider item={item} details={options.details ?? new Map()}>
      {sections}
    </BoardReadsProvider>
  );
  render(
    <MemoryRouter>
      {options.provider === true ? (
        <BoardActsProvider
          item={item}
          details={options.details ?? new Map()}
          snapshots={[]}
          reload={vi.fn()}
          retryDetail={vi.fn()}
          markActed={vi.fn()}
          setDialogOpen={vi.fn()}
          registerDialogCloser={vi.fn()}
          widthClass={BOARD_WIDTH.Expanded}
        >
          {reads}
        </BoardActsProvider>
      ) : (
        reads
      )}
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listTracePage).mockResolvedValue({ items: [], next_cursor: null });
  vi.mocked(listTraceSpans).mockResolvedValue([]);
  vi.mocked(listNodeEvidence).mockResolvedValue([]);
  vi.mocked(listNodeAssessments).mockResolvedValue([]);
  vi.mocked(readWorkbenchEvents).mockResolvedValue(sessionEvents(null));
});

describe("BoardSections", () => {
  it("shows the title from detailTitleOf", () => {
    renderSections(BLOCKED);

    expect(
      screen.getByRole("heading", { level: 3, name: "Team: criterion not met" }),
    ).toHaveAttribute("id", "detail-title");
  });

  it("shows the header facts", () => {
    renderSections(BLOCKED);

    expect(screen.getByText("kanthord")).toBeVisible();
    expect(screen.getByText("Rule")).toBeVisible();
    expect(screen.getByText("Blocked")).toBeVisible();
    expect(screen.getByText("age unknown")).toBeVisible();
  });

  it("shows the position on expanded width only", () => {
    renderSections(BLOCKED);
    expect(screen.getByText("2 of 3")).toBeVisible();
  });

  it("leaves out the position on medium width", () => {
    renderSections(BLOCKED, { widthClass: BOARD_WIDTH.Medium });
    expect(screen.queryByText("2 of 3")).not.toBeInTheDocument();
  });

  it("orders the sections What, Impact, Why, Root cause, Evidence, Suggestion", () => {
    renderSections(BLOCKED);

    expect(
      screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent),
    ).toEqual(["What", "Impact", "Why", "Root cause", "Evidence", "Suggestion"]);
  });

  it("puts Change asked after What for a tool approval", () => {
    renderSections(APPROVAL);

    expect(
      screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent),
    ).toEqual(["What", "Change asked", "Impact", "Why", "Root cause", "Evidence", "Suggestion"]);
  });

  it("explains the cause of a decision item", () => {
    renderSections(BLOCKED);

    expect(screen.getByText("The node is blocked.")).toBeVisible();
  });

  it("explains a fix item", () => {
    renderSections(PROJECT_PAUSED);
    expect(screen.getByText(/is paused\. Workers claim none of its nodes\./)).toBeVisible();
  });

  it("explains a tool approval with its operation", () => {
    renderSections(APPROVAL);

    expect(screen.getByText(/waits for your answer to operation project\.create\./)).toBeVisible();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
  });

  it("lists the held nodes with their project and state, and the total", () => {
    renderSections(BLOCKED, { held: holds("Alpha", "Beta") });

    expect(screen.getByText("2 nodes wait in total.")).toBeVisible();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText("Alpha")).toBeVisible();
    expect(within(items[0] as HTMLElement).getByText("in kanthord")).toBeVisible();
    expect(within(items[0] as HTMLElement).getByText("Pending")).toBeVisible();
  });

  it("says that no node waits on the card", () => {
    renderSections(BLOCKED);

    expect(screen.getByText("No node waits on this card.")).toBeVisible();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("shows the spread text of a fix item before the total", () => {
    renderSections(CREDENTIAL, { held: holds("Alpha") });

    const spread = screen.getByText("3 nodes in 2 projects");
    const total = screen.getByText("1 node waits in total.");

    expect(spread.compareDocumentPosition(total) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows the failure of the environment from the snapshot", () => {
    renderSections(ENVIRONMENT, { environments: [environmentState()] });

    expect(screen.getByText(/exited with 1/)).toHaveTextContent(
      "npm test exited with 1. Reproduce it with npm test --watch=false.",
    );
  });

  it("shows no environment failure without environments", () => {
    renderSections(ENVIRONMENT);

    expect(screen.queryByText(/exited with/)).not.toBeInTheDocument();
  });

  it("says that a wait has no cause and no evidence", async () => {
    renderSections(BLOCKED, { provider: true });

    expect(await screen.findByText("No cause: this is a wait, not a fault.")).toBeVisible();
    expect(await screen.findByText("No execution recorded.")).toBeVisible();
  });
});

function sectionOf(title: string): HTMLElement {
  const section = screen.getByRole("heading", { level: 4, name: title }).parentElement;
  if (section === null) throw new Error(`No section ${title}`);
  return section;
}

function readyDetails(
  target: MissionNodeRecord,
  detail: Record<string, unknown>,
): AttentionDetails {
  return new Map([[target.id, { key: detailKeyOf(target), ...detail } as never]]);
}

function humanAssessment(rationale: string, createdAt: number): MissionAssessment {
  return {
    id: `assessment_${createdAt}`,
    rationale,
    created_at: createdAt,
    actor: { kind: "human", account: "ulrich", name: "Ulrich" },
  } as MissionAssessment;
}

describe("BoardSections for a tool approval", () => {
  it("shows Change asked with each input field after the session read", async () => {
    vi.mocked(readWorkbenchEvents).mockResolvedValue(
      sessionEvents({ name: "alpha", labels: ["a", "b"] }),
    );
    renderSections(APPROVAL);

    const section = sectionOf("Change asked");
    expect(within(section).getByText("Reading the session.")).toHaveClass("sr-only");
    expect(await within(section).findByText("name becomes")).toBeVisible();
    expect(within(section).getByText("alpha")).toBeVisible();
    expect(within(section).getByText("labels becomes")).toBeVisible();
    expect(within(section).getByText(/"a",\s+"b"/).tagName).toBe("PRE");
    expect(within(section).getByText("project.create")).toBeVisible();
    expect(readWorkbenchEvents).toHaveBeenCalledWith("s1", null, null);
  });

  it("says that the call no longer waits", async () => {
    renderSections(APPROVAL);

    expect(await screen.findByText("The call no longer waits.")).toBeVisible();
  });

  it("shows the failure of the session read and reads again on Retry", async () => {
    vi.mocked(readWorkbenchEvents)
      .mockRejectedValueOnce(new ApiError("unavailable", "Down.", 503))
      .mockResolvedValue(sessionEvents({ name: "alpha" }));
    renderSections(APPROVAL);

    expect(await screen.findByText("Could not read the session.")).toBeVisible();
    await userEvent.click(within(sectionOf("Change asked")).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("name becomes")).toBeVisible();
    expect(readWorkbenchEvents).toHaveBeenCalledTimes(2);
  });

  it("lists the session and the operation as evidence, and suggests the approval", async () => {
    renderSections(APPROVAL);

    expect(
      within(sectionOf("Evidence")).getByText("session s1 · operation project.create"),
    ).toBeVisible();
    const suggestion = sectionOf("Suggestion");
    expect(
      within(suggestion).getByText(
        "Approve if the change states what you want. Reject to return the call to the agent.",
      ),
    ).toBeVisible();
    expect(within(suggestion).getByText("Source: client rule")).toBeVisible();
    await screen.findByText("The call no longer waits.");
  });
});

describe("BoardSections for a dependency item", () => {
  const ALPHA = node("node_a", "Alpha", "Pending");
  const WAITER = node("node_w", "Waiter", "Pending");
  const DEPENDENCY: AttentionItem = {
    id: "dependency_discarded:node_w",
    kind: "dependency_discarded",
    group: "decisions",
    project: PROJECT,
    subject: "Waiter",
    missionVersion: 7,
    node: WAITER,
    nodes: [WAITER, ALPHA],
    at: null,
    cause: "Discarded dependency",
    discarded: [{ id: "node_a", name: "Alpha" }],
  };

  it("shows the discard reason from the assessment read", async () => {
    vi.mocked(listNodeAssessments).mockResolvedValue([humanAssessment("Beta replaces it.", 5)]);
    renderSections(DEPENDENCY);

    expect(await screen.findByText(/Reason:/)).toHaveTextContent(
      'You discarded Alpha. Reason: "Beta replaces it."',
    );
    expect(listNodeAssessments).toHaveBeenCalledWith("node_a", 2);
  });

  it("says that no reason is recorded", async () => {
    renderSections(DEPENDENCY);

    expect(await screen.findByText(/No reason is recorded/)).toHaveTextContent(
      "You discarded Alpha. No reason is recorded.",
    );
  });

  it("shows the failure of the discard reason read", async () => {
    vi.mocked(listNodeAssessments).mockRejectedValue(new ApiError("unavailable", "Down.", 503));
    renderSections(DEPENDENCY);

    expect(await screen.findByText("Could not read the discard reason.")).toBeVisible();
  });

  it("says that a human act ended the dependency, and suggests the removal", async () => {
    renderSections(DEPENDENCY);

    expect(
      within(sectionOf("Root cause")).getByText("No fault. A human act ended the dependency."),
    ).toBeVisible();
    expect(
      within(sectionOf("Suggestion")).getByText(/Does the work of Alpha still need to happen\?/),
    ).toBeVisible();
    await screen.findByText(/No reason is recorded/);
  });
});

describe("BoardSections for a paused item", () => {
  const EXECUTION = {
    execution_id: "e1",
    trace_id: "trace_e1",
    project_id: "prj-1",
    node_id: "node_2",
    attempt: 2,
    created_at: Date.parse("2026-05-01T09:00:00Z"),
    ended_at: Date.parse("2026-05-01T09:12:00Z"),
    claim_state: "ended",
    expired_at: 0,
    stop: { reason: "operation_failed", code: null },
    agent_selections: [{ agent_name: "swe@1" }],
  } as unknown as SchedulerExecutionRecord;

  const PAUSE: AttentionItem = {
    ...(PAUSED_ITEM as Extract<AttentionItem, { kind: "paused" }>),
    pause: { cause: "failure-limit", execution: EXECUTION, endedAt: 1 },
    cause: "Failure limit",
  };

  const DETAILS = readyDetails(PAUSED, {
    kind: "paused",
    executions: { status: "ready", data: [EXECUTION] },
    actions: { status: "ready", data: [] },
  });

  function transition(rule: string): TraceSpan {
    return {
      operation: "scheduler.transition",
      attributes: {
        "kanthord.transition.rule": rule,
        "kanthord.transition.count": 3,
        "kanthord.transition.limit": 3,
      },
    } as unknown as TraceSpan;
  }

  it("shows the failure count of a failure-limit pause from the transition span", async () => {
    vi.mocked(listTraceSpans).mockResolvedValue([transition("failure_limit")]);
    renderSections(PAUSE, { details: DETAILS });

    expect(await within(sectionOf("What")).findByText("failures 3 of 3")).toBeVisible();
    expect(listTraceSpans).toHaveBeenCalledWith("trace_e1");
  });

  it("shows no failure count for another rule", async () => {
    vi.mocked(listTraceSpans).mockResolvedValue([transition("further_work_limit")]);
    renderSections(PAUSE, { details: DETAILS });

    await waitFor(() =>
      expect(within(sectionOf("What")).queryByText("Reading the execution trace.")).toBeNull(),
    );
    expect(screen.queryByText(/failures \d of \d/)).not.toBeInTheDocument();
  });

  it("shows the failure of the transition read and reads again on Retry", async () => {
    vi.mocked(listTraceSpans)
      .mockRejectedValueOnce(new ApiError("unavailable", "Down.", 503))
      .mockResolvedValue([transition("failure_limit")]);
    renderSections(PAUSE, { details: DETAILS });

    expect(await screen.findByText("Could not read the execution trace.")).toBeVisible();
    await userEvent.click(within(sectionOf("What")).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("failures 3 of 3")).toBeVisible();
  });

  it("links the execution line to the trace of that execution", async () => {
    renderSections(PAUSE, { details: DETAILS });

    const section = sectionOf("Evidence");
    expect(
      within(section).getByText("implement 09:00 to 09:12 UTC · swe@1 · Operation failed", {
        exact: false,
      }),
    ).toBeVisible();
    expect(within(section).getByRole("link", { name: "e1" })).toHaveAttribute(
      "href",
      "/traces/trace_e1",
    );
    await screen.findByText("No cause: this is a wait, not a fault.");
  });

  it("shows the cause line and its assigner under Root cause", async () => {
    vi.mocked(listTracePage).mockResolvedValue({
      items: [
        {
          trace_id: "trace_e1",
          cause: { category: "llm_provider", assigner: "rule", subcategory: "rate_limited" },
        } as TraceListItem,
      ],
      next_cursor: null,
    });
    renderSections(PAUSE, { details: DETAILS });

    const section = sectionOf("Root cause");
    expect(await within(section).findByText("LLM provider - rate limited")).toBeVisible();
    expect(within(section).getByText("assigned by rule")).toBeVisible();
  });

  it("shows the failure of the cause read under Root cause", async () => {
    vi.mocked(listTracePage).mockRejectedValue(new ApiError("unavailable", "Down.", 503));
    renderSections(PAUSE, { details: DETAILS });

    expect(
      await within(sectionOf("Root cause")).findByText("Could not read the execution trace."),
    ).toBeVisible();
  });

  it("suggests a resume, or the gate need for a gated pause", async () => {
    renderSections(PAUSE, { details: DETAILS });
    expect(
      within(sectionOf("Suggestion")).getByText(
        "Resume the node. The next execution starts a new try.",
      ),
    ).toBeVisible();
    await screen.findByText("No cause: this is a wait, not a fault.");
  });

  it("suggests the gate need first for a gated pause", async () => {
    renderSections(PAUSE, {
      details: DETAILS,
      gate: { itemId: "x", need: "Rotate openai-main in Fix setup", short: "Rotate" },
    });

    expect(
      within(sectionOf("Suggestion")).getByText(
        "Rotate openai-main in Fix setup first. A resume before that fix spends the extra try.",
      ),
    ).toBeVisible();
    await screen.findByText("No cause: this is a wait, not a fault.");
  });
});

describe("BoardSections for a blocked item", () => {
  const EXAMINE = { ...node("node_1", "Team", "Blocked"), intent: "examine" as const };
  const ITEM: AttentionItem = {
    ...(BLOCKED as Extract<AttentionItem, { kind: "blocked" }>),
    node: EXAMINE,
    nodes: [EXAMINE],
  };

  function blockedDetails(assessment: unknown, proposals: unknown = { status: "ready", data: [] }) {
    return readyDetails(EXAMINE, { kind: "blocked", assessment, proposals });
  }

  const READY_ASSESSMENT = {
    status: "ready",
    data: {
      rationale: "The criterion fails.",
      actor: { kind: "execution", execution_id: "e9", client_id: null, name: "reviewer@1" },
    } as MissionAssessment,
  };

  it("shows the reviewer quote in a blockquote with a cite", () => {
    renderSections(ITEM, { details: blockedDetails(READY_ASSESSMENT) });

    const quote = screen.getByText("The criterion fails.");
    expect(quote.tagName).toBe("BLOCKQUOTE");
    expect(quote.closest("figure")).not.toBeNull();
    const cite = screen.getByText("reviewer@1");
    expect(cite.tagName).toBe("CITE");
    expect(cite.closest("figcaption")).not.toBeNull();
    expect(quote.className).not.toMatch(/italic/);
  });

  it("says that the daemon holds no assessment", () => {
    renderSections(ITEM, { details: blockedDetails({ status: "ready", data: null }) });

    expect(screen.getByText("The daemon holds no assessment for this outcome.")).toBeVisible();
  });

  it("shows the failure of the assessment", () => {
    renderSections(ITEM, { details: blockedDetails({ status: "failed", message: "Down." }) });

    expect(screen.getByText("Could not read the assessment.")).toBeVisible();
  });

  it("reads the assessment as pending without a detail", () => {
    renderSections(ITEM);

    expect(screen.getByText("Reading the assessment.")).toHaveClass("sr-only");
  });

  it("lists each evidence with its subject, commit and result lines", async () => {
    const record = {
      id: "ev1",
      subject: "Add the team",
      assets: [
        {
          id: "a1",
          kind: "repository",
          address: {
            kind: "repository",
            binding_id: "binding_main_000001",
            commit: "0123456789abcdef0123",
          },
        },
      ],
      verification: {
        results: [
          { command: "pnpm test", exit_code: 1, signal: null, timed_out: false },
          { command: "pnpm lint", exit_code: 0, signal: null, timed_out: false },
        ],
      },
    } as unknown as MissionEvidence;
    vi.mocked(listNodeEvidence).mockResolvedValue([record]);
    renderSections(ITEM, {
      details: blockedDetails(READY_ASSESSMENT),
      environments: [
        { binding_id: "binding_main_000001", binding_name: "main" } as EnvironmentState,
      ],
    });

    const section = sectionOf("Evidence");
    expect(await within(section).findByText("Add the team")).toBeVisible();
    expect(within(section).getByText("commit 0123456789ab on binding main")).toBeVisible();
    expect(within(section).getByText("✗ pnpm test · exit 1")).toBeVisible();
    expect(within(section).getByText("✓ pnpm lint · exit 0")).toBeVisible();
    expect(listNodeEvidence).toHaveBeenCalledWith("node_1", 2);
  });

  it("shows the failure of the evidence read and reads again on Retry", async () => {
    vi.mocked(listNodeEvidence)
      .mockRejectedValueOnce(new ApiError("unavailable", "Down.", 503))
      .mockResolvedValue([
        { id: "ev1", subject: "Add the team", assets: [] } as unknown as MissionEvidence,
      ]);
    renderSections(ITEM, { details: blockedDetails(READY_ASSESSMENT) });

    expect(await screen.findByText("Could not read the evidence.")).toBeVisible();
    await userEvent.click(within(sectionOf("Evidence")).getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Add the team")).toBeVisible();
  });

  it("adds the trace line from the cause read", async () => {
    vi.mocked(listTracePage).mockResolvedValue({
      items: [
        {
          trace_id: "trace_9",
          cause: { category: "model", assigner: "reviewer" },
        } as TraceListItem,
      ],
      next_cursor: null,
    });
    renderSections(ITEM, { details: blockedDetails(READY_ASSESSMENT) });

    expect(await screen.findByRole("link", { name: "trace_9" })).toHaveAttribute(
      "href",
      "/traces/trace_9",
    );
    expect(within(sectionOf("Root cause")).getByText("Model")).toBeVisible();
    expect(within(sectionOf("Root cause")).getByText("assigned by reviewer")).toBeVisible();
  });

  it("says that an undetermined assessment assigns no cause", async () => {
    const undetermined = {
      ...EXAMINE,
      blocked_context: {
        outcome: { result: "undetermined", closing_event: "assessment-not-passed" },
        requests: [],
      },
    } as unknown as MissionNodeRecord;
    renderSections(
      { ...(ITEM as Extract<AttentionItem, { kind: "blocked" }>), node: undetermined },
      {
        details: readyDetails(undetermined, {
          kind: "blocked",
          assessment: READY_ASSESSMENT,
          proposals: { status: "ready", data: [] },
        }),
      },
    );

    expect(
      await screen.findByText("No cause assigned: the assessment was undetermined."),
    ).toBeVisible();
  });

  it("suggests the unblock for a criterion that is not met", async () => {
    renderSections(ITEM, { details: blockedDetails(READY_ASSESSMENT) });

    expect(
      within(sectionOf("Suggestion")).getByText(
        "Unblock from the node branch. The next attempt reads this outcome and its cause.",
      ),
    ).toBeVisible();
    await screen.findByText("No cause: this is a wait, not a fault.");
  });

  describe("with an open proposal", () => {
    const PROPOSAL = {
      id: "proposal_1",
      node_id: "node_1",
      attempt: 2,
      assessment_id: "assessment_1",
      content: {
        dependency_id: "node_d",
        name: "Split team",
        requirement: "Split the team node in two.",
        criterion: "c",
        task: {
          name: "t",
          requirement: "r",
          criterion: "c",
          verifications: ["pnpm test", "pnpm lint"],
        },
      },
      created_node_id: null,
      approved_at: null,
      rejected_at: null,
      created_at: 1,
    } as MissionProposal;

    function renderProposal() {
      renderSections(ITEM, {
        provider: true,
        details: blockedDetails(READY_ASSESSMENT, { status: "ready", data: [PROPOSAL] }),
      });
    }

    it("shows the name, the requirement and each verification in code", async () => {
      renderProposal();

      const section = sectionOf("Proposal");
      expect(await within(section).findByText("Split team")).toBeVisible();
      expect(within(section).getByText("Split the team node in two.")).toBeVisible();
      expect(within(section).getByText("pnpm test").tagName).toBe("CODE");
      expect(within(section).getByText("pnpm lint").tagName).toBe("CODE");
      await screen.findByText("No execution recorded.");
    });

    it("puts Proposal after What", async () => {
      renderProposal();

      await screen.findByRole("heading", { level: 4, name: "Proposal" });
      expect(
        screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent),
      ).toEqual(["What", "Proposal", "Impact", "Why", "Root cause", "Evidence", "Suggestion"]);
      await screen.findByText("No execution recorded.");
    });

    it("suggests the first proposal with the reviewer as source", async () => {
      renderProposal();

      const suggestion = await waitFor(() => {
        const section = sectionOf("Suggestion");
        within(section).getByText('Decide the proposals: check "Split team".');
        return section;
      });
      expect(within(suggestion).getByText("Source: proposal of reviewer@1")).toBeVisible();
      await screen.findByText("No execution recorded.");
    });
  });

  it("shows the failure of the proposals read under Proposal", () => {
    renderSections(ITEM, {
      provider: true,
      details: blockedDetails(READY_ASSESSMENT, { status: "failed", message: "Down." }),
    });

    expect(within(sectionOf("Proposal")).getByText("Could not read the proposals.")).toBeVisible();
  });
});

describe("BoardSections for a failed environment", () => {
  function failedState(tail: string): EnvironmentState {
    return {
      ...environmentState(),
      failure: { ...environmentState().failure, tail },
    } as unknown as EnvironmentState;
  }

  const ITEM: AttentionItem = {
    ...ENVIRONMENT,
    failure: {
      class: "setup_failed",
      origin: "onboarding",
      execution_id: null,
      command: "npm test",
      exit_code: 1,
      tail: "line one\nline two",
      reproduce: "npm test --watch=false",
      ended_at: 1,
    },
  };

  it("shows the log tail and the reproduce command", () => {
    renderSections(ITEM, { environments: [failedState("line one\nline two")] });

    const section = sectionOf("Evidence");
    expect(within(section).getByText("npm test · exit 1")).toBeVisible();
    const log = within(section).getByText(/line one/);
    expect(log.tagName).toBe("PRE");
    expect(log).toHaveClass(
      "bg-muted",
      "text-xs",
      "whitespace-pre-wrap",
      "break-words",
      "font-mono",
    );
    const reproduce = within(section).getByText("npm test --watch=false");
    expect(reproduce.tagName).toBe("CODE");
    expect(reproduce.parentElement).toHaveTextContent("Reproduce: npm test --watch=false");
  });

  it("suggests the fix of the failed command", () => {
    renderSections(ITEM);

    expect(
      within(sectionOf("Suggestion")).getByText(
        /^Fix the failed command in the repository of binding main\./,
      ),
    ).toBeVisible();
    expect(within(sectionOf("Suggestion")).getByText("Source: client rule")).toBeVisible();
  });
});

describe("BoardSections for the other fix items", () => {
  it("suggests the rotation of a refused credential", () => {
    renderSections(CREDENTIAL);

    expect(
      within(sectionOf("Suggestion")).getByText(
        "Rotate openai-main, then resume the 3 paused nodes. A resume before the rotation spends the extra try.",
      ),
    ).toBeVisible();
  });

  it("names the fix target for a paused project", () => {
    renderSections(PROJECT_PAUSED);

    expect(
      within(sectionOf("Suggestion")).getByText(
        "Open project, then fix the setup that the cause names.",
      ),
    ).toBeVisible();
  });
});

describe("BoardSections for an outside item", () => {
  const WAITING = node("node_o", "Outside", "Pending");
  const OUTSIDE: AttentionItem = {
    id: "merge_wait:node_o",
    kind: "merge_wait",
    group: "outside",
    project: PROJECT,
    subject: "Outside",
    missionVersion: 7,
    node: WAITING,
    nodes: [WAITING],
    at: null,
    cause: "Waits for merge",
    request: {
      action: {} as never,
      evidence: {
        id: "ev1",
        assets: [
          {
            id: "a1",
            kind: "platform",
            address: {
              kind: "pull_request",
              resource_identity: "repository:github:kanthorlabs/kanthord",
              number: 42,
            },
          },
        ],
      } as unknown as MissionEvidence,
    },
  };

  it("shows the pull request as evidence and suggests the merge", () => {
    renderSections(OUTSIDE);

    expect(
      within(sectionOf("Evidence")).getByText("pull request #42 · github.com/kanthorlabs/kanthord"),
    ).toBeVisible();
    expect(
      within(sectionOf("Suggestion")).getByText(
        "Merge the pull request on the platform, then Check now.",
      ),
    ).toBeVisible();
  });
});

describe("BoardSections evidence list on compact width", () => {
  const LINES = ["one", "two", "three", "four", "five"];
  const RECORD = {
    id: "ev1",
    subject: "subject",
    assets: [],
    verification: {
      results: LINES.slice(0, 4).map((command) => ({
        command,
        exit_code: 0,
        signal: null,
        timed_out: false,
      })),
    },
  } as unknown as MissionEvidence;

  beforeEach(() => {
    vi.mocked(listNodeEvidence).mockResolvedValue([RECORD]);
  });

  it("shows three of five lines and Show 2 more", async () => {
    renderSections(BLOCKED, { widthClass: BOARD_WIDTH.Compact });

    const section = sectionOf("Evidence");
    await within(section).findByText("subject");
    expect(within(section).getAllByRole("listitem")).toHaveLength(3);
    expect(within(section).getByRole("button", { name: "Show 2 more" })).toBeVisible();
  });

  it("shows every line on a press and moves focus to the list", async () => {
    renderSections(BLOCKED, { widthClass: BOARD_WIDTH.Compact });

    const section = sectionOf("Evidence");
    await userEvent.click(await within(section).findByRole("button", { name: "Show 2 more" }));

    expect(within(section).getAllByRole("listitem")).toHaveLength(5);
    expect(within(section).queryByRole("button", { name: /Show/ })).not.toBeInTheDocument();
    expect(within(section).getByRole("list")).toHaveFocus();
  });

  it("shows every line on expanded width, with no button", async () => {
    renderSections(BLOCKED, { widthClass: BOARD_WIDTH.Expanded });

    const section = sectionOf("Evidence");
    await within(section).findByText("subject");
    expect(within(section).getAllByRole("listitem")).toHaveLength(5);
    expect(within(section).queryByRole("button", { name: /Show/ })).not.toBeInTheDocument();
  });
});
