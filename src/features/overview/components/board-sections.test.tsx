import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listTracePage } from "@/api/resources/tracking";
import type {
  EnvironmentState,
  MissionAssessment,
  MissionNodeRecord,
  Project,
  SchedulerExecutionRecord,
  TraceListItem,
} from "@/api/types";
import type { ToolApprovalItem } from "@/lib/approval-attention";
import {
  type AttentionDetails,
  type AttentionItem,
  type DecisionAttentionItem,
  detailKeyOf,
} from "@/lib/attention";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";
import type {
  CredentialRefusedItem,
  EnvironmentFailedItem,
  ProjectPausedItem,
} from "@/lib/fix-attention";

vi.mock("@/api/resources/tracking");

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
      titleId="detail-title"
      titleRef={() => undefined}
    />
  );
  render(
    <MemoryRouter>
      {options.provider === true ? (
        <BoardActsProvider
          item={item}
          details={options.details ?? new Map()}
          reload={vi.fn()}
          retryDetail={vi.fn()}
          markActed={vi.fn()}
          setDialogOpen={vi.fn()}
        >
          {sections}
        </BoardActsProvider>
      ) : (
        sections
      )}
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(listTracePage).mockResolvedValue({ items: [], next_cursor: null });
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

  it("orders the sections What, Impact, Why, Root cause, Evidence", () => {
    renderSections(BLOCKED);

    expect(
      screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent),
    ).toEqual(["What", "Impact", "Why", "Root cause", "Evidence"]);
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

  it("shows the assessment rationale of a blocked node under Why", () => {
    renderSections(BLOCKED, {
      details: new Map([
        [
          TEAM.id,
          {
            kind: "blocked",
            key: detailKeyOf(TEAM),
            assessment: {
              status: "ready",
              data: { rationale: "The criterion fails." } as MissionAssessment,
            },
            proposals: { status: "ready", data: [] },
          },
        ],
      ]),
    });

    expect(screen.getByText("The criterion fails.")).toBeVisible();
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

  it("says that a wait has no cause and no evidence", () => {
    renderSections(BLOCKED, { provider: true });

    expect(screen.getByText("No cause: this is a wait, not a fault.")).toBeVisible();
    expect(screen.getByText("No execution recorded.")).toBeVisible();
  });

  it("shows the cause line and the Last trace link of the newest execution", async () => {
    vi.mocked(listTracePage).mockResolvedValue({
      items: [
        {
          cause: { category: "llm_provider", assigner: "rule", subcategory: "rate_limited" },
        } as TraceListItem,
      ],
      next_cursor: null,
    });
    renderSections(PAUSED_ITEM, {
      provider: true,
      details: new Map([
        [
          PAUSED.id,
          {
            kind: "paused",
            key: detailKeyOf(PAUSED),
            executions: {
              status: "ready",
              data: [
                {
                  execution_id: "e1",
                  trace_id: "trace_e1",
                  created_at: 1,
                } as SchedulerExecutionRecord,
              ],
            },
            actions: { status: "ready", data: [] },
          },
        ],
      ]),
    });

    await waitFor(() =>
      expect(screen.queryByText("No cause: this is a wait, not a fault.")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Last trace" })).toHaveAttribute(
      "href",
      "/traces/trace_e1",
    );
  });
});
