import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

vi.mock("@/api/resources/projects", () => ({
  listProjects: vi.fn(),
}));

vi.mock("@/api/resources/mission", () => ({
  readMission: vi.fn(),
  listMissionNodes: vi.fn(),
  listNodeAssessments: vi.fn(),
  listNodeProposals: vi.fn(),
  unblockNode: vi.fn(),
  discardNode: vi.fn(),
}));

vi.mock("@/api/resources/scheduler", () => ({
  listQueueJobs: vi.fn(),
}));

import {
  discardNode,
  listMissionNodes,
  listNodeAssessments,
  listNodeProposals,
  readMission,
  unblockNode,
} from "@/api/resources/mission";
import { listProjects } from "@/api/resources/projects";
import { listQueueJobs } from "@/api/resources/scheduler";
import type {
  MissionAssessment,
  MissionAssessmentResult,
  MissionClosingEvent,
  MissionControlResult,
  MissionEvidence,
  MissionNodeRecord,
  MissionProposal,
  MissionRunnableNode,
  NodeState,
  Project,
  SchedulerJob,
} from "@/api/types";
import { closingEventText } from "@/lib/mission-labels";

import { textContent } from "../../../test/text-content";
import { OverviewScreen } from "./overview-screen";

const NOW = Date.now();
const HOUR = 3_600_000;

function project(id: string, name: string): Project {
  return {
    id,
    name,
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: `/state/${id}`,
  };
}

const KANTHORD = project("prj-1", "kanthord");
const ATLAS = project("prj-2", "atlas");

interface BlockedOptions {
  readonly kind?: "initiative" | "objective";
  readonly attempt?: number;
  readonly closingEvent?: MissionClosingEvent;
  readonly result?: MissionAssessmentResult;
  readonly createdAt?: number;
  readonly requests?: readonly MissionEvidence[];
}

function blocked(id: string, name: string, options: BlockedOptions = {}): MissionRunnableNode {
  const attempt = options.attempt ?? 2;
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission",
    parent_id: null,
    visible_revision: 3,
    content: { name, requirement: "", criterion: "", verifications: [], bindings: [] },
    retired_at: null,
    pinned_by_attempts: [],
    kind: options.kind ?? "objective",
    state: "Blocked",
    attempt,
    priority: 0,
    depends_on: [],
    blocked_context: {
      outcome: {
        id: `outcome_${id}`,
        node_id: id,
        attempt,
        node_revision: 3,
        closing_event: options.closingEvent ?? "assessment-not-passed",
        result: options.result ?? "criterion-not-met",
        assessment_id: `assessment_${id}`,
        evidence_ids: [],
        created_at: options.createdAt ?? NOW - 3 * HOUR,
      },
      requests: options.requests ?? [],
    },
  };
}

function plain(id: string, name: string, state: NodeState): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission",
    parent_id: null,
    visible_revision: 1,
    content: { name, requirement: "", criterion: "", verifications: [], bindings: [] },
    retired_at: null,
    pinned_by_attempts: [],
    kind: "objective",
    state,
    attempt: 1,
    priority: 0,
    depends_on: [],
  };
}

function assessment(nodeId: string, rationale: string): MissionAssessment {
  return {
    id: `assessment_${nodeId}`,
    node_id: nodeId,
    execution_id: null,
    attempt: 2,
    node_revision: 3,
    evidence_ids: [],
    child_outcome_ids: [],
    result: "criterion-not-met",
    rationale,
    tested_input: null,
    actor: { kind: "human", account: "kanthorlabs", name: "Kanthor Labs" },
    created_at: NOW - 3 * HOUR,
    currency: null,
    child_node_ids: [],
    worker_version: null,
  };
}

function proposal(nodeId: string, name: string, approvedAt: number | null = null): MissionProposal {
  return {
    id: `proposal_${name}`,
    node_id: nodeId,
    attempt: 2,
    assessment_id: `assessment_${nodeId}`,
    content: {
      objective_id: "node_target",
      name,
      requirement: "The invite email uses the workspace language.",
      criterion: "c",
      task: { name: "t", requirement: "r", criterion: "c", verifications: ["v"] },
    },
    objective_node_id: null,
    approved_at: approvedAt,
    created_at: NOW - HOUR,
  };
}

function job(projectId: string, nodeId: string): SchedulerJob {
  return { job_id: `job_${nodeId}`, project_id: projectId, node_id: nodeId, priority: 0 };
}

interface World {
  readonly projects?: readonly Project[];
  readonly nodes?: Readonly<Record<string, readonly MissionNodeRecord[]>>;
  readonly jobs?: Readonly<Record<string, readonly SchedulerJob[]>>;
  readonly rationales?: Readonly<Record<string, string>>;
  readonly proposals?: Readonly<Record<string, readonly MissionProposal[]>>;
}

function serve(world: World) {
  vi.mocked(listProjects).mockResolvedValue(world.projects ?? [KANTHORD, ATLAS]);
  vi.mocked(readMission).mockImplementation(async (projectId) => ({
    id: `mission_${projectId}`,
    project_id: projectId,
    version: 7,
  }));
  vi.mocked(listMissionNodes).mockImplementation(
    async (missionId) => world.nodes?.[missionId.replace("mission_", "")] ?? [],
  );
  vi.mocked(listQueueJobs).mockImplementation(async (projectId) => world.jobs?.[projectId] ?? []);
  vi.mocked(listNodeAssessments).mockImplementation(async (nodeId) => [
    assessment(nodeId, world.rationales?.[nodeId] ?? "The criterion is not met."),
  ]);
  vi.mocked(listNodeProposals).mockImplementation(
    async (nodeId) => world.proposals?.[nodeId] ?? [],
  );
  vi.mocked(unblockNode).mockResolvedValue({} as MissionControlResult);
  vi.mocked(discardNode).mockResolvedValue({} as MissionControlResult);
}

function renderScreen(entry = "/") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <OverviewScreen />
    </MemoryRouter>,
  );
}

function itemOf(name: string): HTMLElement {
  const item = screen.getByRole("link", { name }).closest('[role="listitem"]');
  if (!(item instanceof HTMLElement)) throw new Error(`No item for ${name}.`);
  return item;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("OverviewScreen inbox", () => {
  it("lists the Blocked nodes of every project with cause, project and age", async () => {
    serve({
      nodes: {
        "prj-1": [blocked("n_a", "Audit log for account changes")],
        "prj-2": [
          blocked("n_b", "Localize the order email", {
            result: "undetermined",
            createdAt: NOW - 5 * HOUR,
          }),
        ],
      },
    });

    renderScreen();

    const decisions = await screen.findByRole("list", { name: "Decisions" });
    expect(
      within(decisions)
        .getAllByRole("listitem")
        .map((item) => within(item).getAllByRole("link")[0]?.textContent),
    ).toEqual(["Localize the order email", "Audit log for account changes"]);
    const first = itemOf("Localize the order email");
    expect(within(first).getByText("Blocked")).toBeInTheDocument();
    expect(within(first).getByText("Undetermined")).toBeInTheDocument();
    expect(
      within(first).getByText(textContent("project atlas · attempt 2 · 5 hours ago")),
    ).toBeInTheDocument();
    expect(within(first).getByText(closingEventText("assessment-not-passed"))).toBeInTheDocument();
    expect(within(first).getByRole("link", { name: "Localize the order email" })).toHaveAttribute(
      "href",
      "/projects/prj-2?node=n_b",
    );
    expect(
      within(itemOf("Audit log for account changes")).getByText("Criterion not met"),
    ).toBeInTheDocument();
  });

  it("names the summary of the groups in a polite live region", async () => {
    serve({
      nodes: { "prj-1": [blocked("n_a", "A"), blocked("n_b", "B")], "prj-2": [] },
    });

    renderScreen();

    const summary = await screen.findByText("2 decisions");
    expect(summary.parentElement).toHaveAttribute("aria-live", "polite");
  });

  it("names the status line and links to the scheduler", async () => {
    serve({
      nodes: {
        "prj-1": [plain("n_a", "A", "Executing"), plain("n_b", "B", "Evaluating")],
        "prj-2": [plain("n_c", "C", "Executing"), plain("n_d", "D", "Available")],
      },
      jobs: { "prj-1": [job("prj-1", "n_d"), job("prj-1", "n_e")], "prj-2": [job("prj-2", "n_d")] },
    });

    renderScreen();

    expect(await screen.findByText("3 executions run · 3 jobs wait")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open scheduler" })).toHaveAttribute(
      "href",
      "/scheduler",
    );
  });

  it("shows the Mission progress of each project in lifecycle order", async () => {
    serve({
      nodes: {
        "prj-1": [
          plain("n_a", "A", "Completed"),
          plain("n_b", "B", "Pending"),
          plain("n_c", "C", "Completed"),
        ],
        "prj-2": [plain("n_d", "D", "Executing")],
      },
    });

    renderScreen();

    const kanthord = await screen.findByRole("list", { name: "Node states of kanthord" });
    expect(
      within(kanthord)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Pending1", "Completed2"]);
    expect(
      within(screen.getByRole("list", { name: "Node states of atlas" })).getByText("Executing"),
    ).toBeInTheDocument();
  });
});

describe("OverviewScreen scope", () => {
  it("offers All projects first and shows both projects by default", async () => {
    serve({ nodes: { "prj-1": [blocked("n_a", "A")], "prj-2": [blocked("n_b", "B")] } });

    renderScreen();

    expect(await screen.findByRole("combobox", { name: "Project" })).toHaveTextContent(
      "All projects",
    );
    expect(screen.getByRole("link", { name: "A" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "B" })).toBeInTheDocument();
  });

  it("narrows the inbox, the status line and the link to the project of the parameter", async () => {
    serve({
      nodes: { "prj-1": [blocked("n_a", "A")], "prj-2": [blocked("n_b", "B")] },
      jobs: { "prj-1": [job("prj-1", "n_a")], "prj-2": [job("prj-2", "n_b"), job("prj-2", "n_c")] },
    });

    renderScreen("/?project=prj-2");

    expect(await screen.findByRole("link", { name: "B" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "A" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Project" })).toHaveTextContent("atlas");
    expect(screen.getByText("0 executions run · 2 jobs wait")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open scheduler" })).toHaveAttribute(
      "href",
      "/scheduler?project=prj-2",
    );
    expect(within(itemOf("B")).queryByText(/project atlas/)).toBeNull();
  });

  it("narrows the inbox when the human picks a project", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "A")], "prj-2": [blocked("n_b", "B")] } });
    renderScreen();

    await user.click(await screen.findByRole("combobox", { name: "Project" }));
    await user.click(await screen.findByRole("option", { name: "kanthord" }));

    expect(await screen.findByRole("link", { name: "A" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "B" })).toBeNull();
  });
});

describe("OverviewScreen assessment", () => {
  it("reads the rationale and shows it with the request evidence on the toggle", async () => {
    const user = userEvent.setup();
    const request: MissionEvidence = {
      id: "evidence_1",
      node_id: "n_a",
      attempt: 2,
      subject: "Pull request for the audit log",
      assets: [
        {
          id: "asset_1",
          kind: "platform",
          address: { kind: "pull_request", resource_identity: "github.com/atlas", number: 12 },
          published_at: null,
          expired_at: null,
        },
      ],
      provenance: { kind: "human", account: "kanthorlabs", name: "Kanthor Labs" },
      created_at: NOW - HOUR,
      requirement_key: "repo.pull_request",
      end_state: "other",
    };
    serve({
      nodes: {
        "prj-1": [
          blocked("n_a", "Audit log", {
            closingEvent: "external-failed",
            result: "undetermined",
            requests: [request],
          }),
        ],
      },
      rationales: { n_a: "The audit entry holds no actor." },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Audit log"));
    expect(within(item).getByText("External action failed")).toBeInTheDocument();
    await user.click(within(item).getByRole("button", { name: "Show assessment" }));

    expect(await within(item).findByText("The audit entry holds no actor.")).toBeInTheDocument();
    expect(
      within(item).getByText(
        "repo.pull_request: Pull request for the audit log, pull request #12 on github.com/atlas. End state other.",
      ),
    ).toBeInTheDocument();
    expect(listNodeAssessments).toHaveBeenCalledWith("n_a", 2);
    expect(within(item).getByRole("button", { name: "Hide assessment" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("shows the open fix proposal of an initiative in the panel", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [blocked("n_t", "Team workspaces", { kind: "initiative" })] },
      proposals: {
        n_t: [
          proposal("n_t", "Send the invite in the workspace language"),
          proposal("n_t", "Old", 5),
        ],
      },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Team workspaces"));
    await user.click(within(item).getByRole("button", { name: "Show assessment" }));

    expect(
      await within(item).findByText(
        textContent(
          "Send the invite in the workspace language: The invite email uses the workspace language.",
        ),
      ),
    ).toBeInTheDocument();
    expect(within(item).queryByText(/Old/)).toBeNull();
    expect(listNodeProposals).toHaveBeenCalledWith("n_t");
  });

  it("names a failed assessment read and retries it", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    vi.mocked(listNodeAssessments).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Audit log"));
    await user.click(within(item).getByRole("button", { name: "Show assessment" }));
    expect(
      await within(item).findByText("The assessment could not be read: The daemon did not answer."),
    ).toBeInTheDocument();
    vi.mocked(listNodeAssessments).mockResolvedValue([assessment("n_a", "Read after the retry.")]);
    await user.click(within(item).getByRole("button", { name: "Retry" }));

    expect(await within(item).findByText("Read after the retry.")).toBeInTheDocument();
  });
});

describe("OverviewScreen acts", () => {
  it("offers Unblock and Discard for an objective at once", async () => {
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")] } });
    renderScreen();

    const item = await waitFor(() => itemOf("Audit log"));
    expect(within(item).getByRole("button", { name: "Unblock" })).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("holds Unblock and Discard of an initiative until the proposals read answers", async () => {
    let answer: (value: readonly MissionProposal[]) => void = () => undefined;
    serve({ nodes: { "prj-1": [blocked("n_t", "Team workspaces", { kind: "initiative" })] } });
    vi.mocked(listNodeProposals).mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Team workspaces"));
    expect(within(item).getByText(/Reading the fix proposals/)).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Unblock" })).toBeNull();
    expect(within(item).queryByRole("button", { name: "Discard" })).toBeNull();

    answer([]);

    expect(await within(item).findByRole("button", { name: "Unblock" })).toBeInTheDocument();
    expect(within(item).getByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("keeps the acts of an initiative off when the proposals read fails", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_t", "Team workspaces", { kind: "initiative" })] } });
    vi.mocked(listNodeProposals).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    renderScreen();

    const item = await waitFor(() => itemOf("Team workspaces"));
    expect(
      await within(item).findByText(
        textContent(
          "The fix proposals could not be read: The daemon did not answer.. Unblock and Discard wait for them. Retry",
        ),
      ),
    ).toBeInTheDocument();
    expect(within(item).queryByRole("button", { name: "Unblock" })).toBeNull();
    vi.mocked(listNodeProposals).mockResolvedValue([]);
    await user.click(within(item).getByRole("button", { name: "Retry" }));

    expect(await within(item).findByRole("button", { name: "Unblock" })).toBeInTheDocument();
  });

  it("names the rejected proposals in the Unblock dialog and sends the unblock", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [blocked("n_t", "Team workspaces", { kind: "initiative" })] },
      proposals: { n_t: [proposal("n_t", "Send the invite in the workspace language")] },
    });
    renderScreen();

    const item = await waitFor(() => itemOf("Team workspaces"));
    await user.click(await within(item).findByRole("button", { name: "Unblock" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(
      within(dialog).getByText(
        textContent(
          "Unblock rejects the open proposals: Send the invite in the workspace language. They stay recorded, but the initiative runs the next attempt without the fix objective.",
        ),
      ),
    ).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Reason"), "Retry without the fix.");
    await user.click(within(dialog).getByRole("button", { name: "Unblock node" }));

    expect(unblockNode).toHaveBeenCalledWith("n_t", {
      blocked_attempt: 2,
      expected_revision: 3,
      expected_mission_version: 7,
      reason: "Retry without the fix.",
    });
    await waitFor(() => expect(vi.mocked(listMissionNodes).mock.calls.length).toBeGreaterThan(2));
  });

  it("discards after the reason and reads the inbox again", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-2": [blocked("n_b", "Localize the order email")] } });
    renderScreen();

    const item = await waitFor(() => itemOf("Localize the order email"));
    await user.click(within(item).getByRole("button", { name: "Discard" }));
    const dialog = await screen.findByRole("alertdialog");
    const action = within(dialog).getByRole("button", { name: "Discard node" });
    expect(action).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Reason"), "The feature moves.");
    await user.click(action);

    expect(discardNode).toHaveBeenCalledWith("n_b", {
      reason: "The feature moves.",
      expected_mission_version: 7,
      expected_state: "Blocked",
      expected_attempt: 2,
    });
    await waitFor(() => expect(vi.mocked(listMissionNodes).mock.calls.length).toBeGreaterThan(1));
  });
});

describe("OverviewScreen states", () => {
  it("shows All clear when no node waits and every read succeeded", async () => {
    serve({ nodes: { "prj-1": [plain("n_a", "A", "Pending")] } });

    renderScreen();

    expect(await screen.findByText("All clear")).toBeInTheDocument();
    expect(screen.getByText("No decision waits for you.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Decisions" })).toBeNull();
  });

  it("replaces All clear with an alert that names the missing records", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [], "prj-2": [] } });
    vi.mocked(readMission).mockImplementation(async (projectId) => {
      if (projectId === "prj-2") throw new ApiError("unreachable", "The daemon did not answer.", 0);
      return { id: `mission_${projectId}`, project_id: projectId, version: 7 };
    });

    renderScreen();

    expect(
      await screen.findByText(
        textContent(
          "Some records could not be read: atlas mission (The daemon did not answer.). The list can miss items.",
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
    vi.mocked(readMission).mockImplementation(async (projectId) => ({
      id: `mission_${projectId}`,
      project_id: projectId,
      version: 7,
    }));
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("All clear")).toBeInTheDocument();
  });

  it("keeps the last good nodes of a project when its next read fails", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [blocked("n_a", "Audit log")], "prj-2": [] } });
    renderScreen();
    await screen.findByRole("link", { name: "Audit log" });

    vi.mocked(listMissionNodes).mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(
      await screen.findByText(textContent(/Some records could not be read: kanthord node list/)),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Audit log" })).toBeInTheDocument();
  });

  it("shows only the heading while the first read runs", () => {
    serve({});
    vi.mocked(listProjects).mockReturnValue(new Promise(() => undefined));

    renderScreen();

    expect(screen.getByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Project" })).toBeNull();
  });

  it("shows an alert with Retry when the project list fails on the first read", async () => {
    const user = userEvent.setup();
    serve({});
    vi.mocked(listProjects).mockRejectedValueOnce(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    renderScreen();

    expect(await screen.findByText("The overview could not be read.")).toBeInTheDocument();
    expect(screen.queryByText("All clear")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("All clear")).toBeInTheDocument();
  });
});
