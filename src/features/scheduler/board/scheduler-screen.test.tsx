import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

vi.mock("@/api/resources/projects", () => ({
  listProjects: vi.fn(),
  pauseProject: vi.fn(),
  resumeProject: vi.fn(),
}));

vi.mock("@/api/resources/mission", () => ({
  readMission: vi.fn(),
  listMissionNodes: vi.fn(),
}));

vi.mock("@/api/resources/scheduler", () => ({
  listQueueJobs: vi.fn(),
  listProjectExecutionPage: vi.fn(),
  listNodeExecutions: vi.fn(),
}));

vi.mock("@/api/resources/workers", () => ({
  listWorkerInstances: vi.fn(),
  listWorkerCatalog: vi.fn(),
}));

import { listMissionNodes, readMission } from "@/api/resources/mission";
import { listProjects, resumeProject } from "@/api/resources/projects";
import {
  listNodeExecutions,
  listProjectExecutionPage,
  listQueueJobs,
} from "@/api/resources/scheduler";
import { listWorkerCatalog, listWorkerInstances } from "@/api/resources/workers";
import type {
  ExecutionStop,
  MissionNodeRecord,
  NodeState,
  Page,
  Project,
  SchedulerExecutionRecord,
  SchedulerJob,
  WorkerCatalogItem,
  WorkerInstanceRecord,
} from "@/api/types";
import { utcDateTime } from "@/lib/format";
import { newUlid } from "@/lib/ulid";

import { textContent } from "../../../../test/text-content";
import { SchedulerScreen } from "./scheduler-screen";

const NOW = Date.now();
const MINUTE = 60_000;

function project(id: string, name: string, pausedAt: number | null = null): Project {
  return {
    id,
    name,
    binding_set_version: 1,
    created_at: 1,
    paused_at: pausedAt,
    workspace_directory: `/state/${id}`,
  };
}

const KANTHORD = project("prj-1", "kanthord");
const ATLAS = project("prj-2", "atlas");

function node(id: string, name: string, state: NodeState, attempt = 1): MissionNodeRecord {
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
    attempt,
    priority: 0,
    depends_on: [],
  };
}

function job(projectId: string, nodeId: string, priority: number, agoMs: number): SchedulerJob {
  return {
    job_id: `job_${newUlid(NOW - agoMs)}`,
    project_id: projectId,
    node_id: nodeId,
    priority,
  };
}

function execution(
  projectId: string,
  id: string,
  nodeId: string,
  overrides: Partial<SchedulerExecutionRecord> = {},
): SchedulerExecutionRecord {
  return {
    execution_id: id,
    project_id: projectId,
    node_id: nodeId,
    claimant: {
      worker_binding_id: "binding_1",
      resource_identity: "worker:kanthord:general-main",
      runtime_identity: "worker_instance_01",
      name: "general-main #1",
    },
    attempt: 2,
    pinned_revision: 3,
    node_branch: `kanthord/${nodeId}`,
    credentials: [],
    agent_selections: [],
    claim_state: "running",
    expired_at: NOW + 20 * MINUTE,
    created_at: NOW - 3 * MINUTE,
    ended_at: null,
    stop: null,
    trace_id: "0".repeat(31) + "1",
    root_span_id: "0".repeat(15) + "1",
    ...overrides,
  };
}

function ended(
  projectId: string,
  id: string,
  nodeId: string,
  overrides: Partial<SchedulerExecutionRecord> = {},
): SchedulerExecutionRecord {
  return execution(projectId, id, nodeId, {
    claim_state: "finished",
    created_at: NOW - 80 * MINUTE,
    ended_at: NOW - 60 * MINUTE,
    ...overrides,
  });
}

const CATALOG: readonly WorkerCatalogItem[] = [
  {
    name: "coder@1",
    host: "kanthord",
    declared_node_states: ["Available"],
    required_node_format: ["objective"],
  },
  {
    name: "reviewer@1",
    host: "kanthord",
    declared_node_states: ["Waiting"],
    required_node_format: ["objective"],
  },
];

function instance(projectId: string, workerName: string): WorkerInstanceRecord {
  return {
    runtime_identity: `worker_instance_${workerName}`,
    project_id: projectId,
    resource_identity: `worker:kanthord:${workerName}`,
    worker_name: workerName,
    host: "kanthord",
    placement: "server",
    activity: "idle",
    draining: false,
    registered: true,
  };
}

interface World {
  readonly projects?: readonly Project[];
  readonly nodes?: Readonly<Record<string, readonly MissionNodeRecord[]>>;
  readonly jobs?: Readonly<Record<string, readonly SchedulerJob[]>>;
  readonly executions?: Readonly<Record<string, readonly SchedulerExecutionRecord[]>>;
  readonly instances?: Readonly<Record<string, readonly WorkerInstanceRecord[]>>;
}

function serve(world: World) {
  const projects = world.projects ?? [KANTHORD, ATLAS];
  vi.mocked(listProjects).mockResolvedValue(projects);
  vi.mocked(readMission).mockImplementation(async (projectId) => ({
    id: `mission_${projectId}`,
    project_id: projectId,
    version: 1,
  }));
  vi.mocked(listMissionNodes).mockImplementation(
    async (missionId) => world.nodes?.[missionId.replace("mission_", "")] ?? [],
  );
  vi.mocked(listQueueJobs).mockImplementation(async (projectId) => world.jobs?.[projectId] ?? []);
  vi.mocked(listWorkerInstances).mockImplementation(
    async (projectId) => world.instances?.[projectId] ?? [],
  );
  vi.mocked(listWorkerCatalog).mockResolvedValue(CATALOG);
  vi.mocked(listProjectExecutionPage).mockImplementation(async (projectId) => ({
    items: world.executions?.[projectId] ?? [],
    next_cursor: null,
  }));
  vi.mocked(listNodeExecutions).mockResolvedValue([]);
}

function renderScreen(entry = "/scheduler") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <SchedulerScreen />
    </MemoryRouter>,
  );
}

async function section(name: string): Promise<HTMLElement> {
  return screen.findByRole("region", { name });
}

function titles(list: HTMLElement): string[] {
  return within(list)
    .getAllByRole("listitem")
    .map((item) => within(item).getAllByRole("link")[0]?.textContent ?? "");
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("SchedulerScreen Now", () => {
  it("lists the running executions of every project by the nearest deadline", async () => {
    serve({
      nodes: {
        "prj-1": [node("n_a", "Add recovery codes", "Executing")],
        "prj-2": [
          node("n_b", "Add cart totals", "Executing"),
          node("n_c", "Verify the receipt email", "Evaluating"),
        ],
      },
      executions: {
        "prj-1": [execution("prj-1", "execution_a", "n_a", { expired_at: NOW + 30 * MINUTE })],
        "prj-2": [
          execution("prj-2", "execution_b", "n_b", { expired_at: NOW + 40 * MINUTE }),
          execution("prj-2", "execution_c", "n_c", { expired_at: NOW + 2 * MINUTE }),
        ],
      },
    });

    renderScreen();

    const now = await screen.findByRole("list", { name: "Running executions" });
    expect(titles(now)).toEqual([
      "Verify the receipt email",
      "Add recovery codes",
      "Add cart totals",
    ]);
  });

  it("names the claim kind, the claimant and the fixed deadline of a running execution", async () => {
    serve({
      nodes: { "prj-1": [node("n_a", "Add recovery codes", "Executing")] },
      executions: {
        "prj-1": [execution("prj-1", "execution_a", "n_a", { expired_at: NOW + 20 * MINUTE })],
      },
    });

    renderScreen();

    const item = within(await screen.findByRole("list", { name: "Running executions" })).getByRole(
      "listitem",
    );
    expect(within(item).getByRole("link", { name: "Add recovery codes" })).toHaveAttribute(
      "href",
      "/projects/prj-1?node=n_a",
    );
    expect(within(item).getByText("Steps")).toBeInTheDocument();
    expect(within(item).getByText(textContent("project kanthord"))).toBeInTheDocument();
    expect(
      within(item).getByText(
        textContent(
          "binding general-main · instance general-main #1 · attempt 2 · pinned revision 3",
        ),
      ),
    ).toBeInTheDocument();
    expect(within(item).getByText("execution execution_a")).toBeInTheDocument();
    expect(within(item).getByText("Started 3 minutes ago")).toBeInTheDocument();
    expect(
      within(item).getByText(`Deadline ${utcDateTime(NOW + 20 * MINUTE)}`),
    ).toBeInTheDocument();
    expect(within(item).queryByText(/renew/i)).toBeNull();
  });

  it("names the evaluation of a node in Evaluating", async () => {
    serve({
      nodes: { "prj-1": [node("n_a", "Verify the receipt email", "Evaluating")] },
      executions: { "prj-1": [execution("prj-1", "execution_a", "n_a")] },
    });

    renderScreen();

    const item = within(await screen.findByRole("list", { name: "Running executions" })).getByRole(
      "listitem",
    );
    expect(within(item).getByText("Evaluation")).toBeInTheDocument();
  });

  it("reads the executions of a claiming node that the newest page misses", async () => {
    serve({ nodes: { "prj-1": [node("n_a", "Add recovery codes", "Executing", 4)] } });
    vi.mocked(listNodeExecutions).mockResolvedValue([
      execution("prj-1", "execution_old", "n_a"),
      ended("prj-1", "execution_ended", "n_a"),
    ]);

    renderScreen();

    const now = await screen.findByRole("list", { name: "Running executions" });
    expect(within(now).getAllByRole("listitem")).toHaveLength(1);
    expect(within(now).getByText("execution execution_old")).toBeInTheDocument();
    expect(listNodeExecutions).toHaveBeenCalledWith("prj-1", "n_a", 4);
  });

  it("names an empty section", async () => {
    serve({});

    renderScreen();

    expect(await screen.findByText("No execution runs now.")).toBeInTheDocument();
  });
});

describe("SchedulerScreen Next", () => {
  it("keeps the queue order that the Scheduler answers, per project under All projects", async () => {
    serve({
      nodes: {
        "prj-1": [
          node("n_a", "Add password reset", "Available", 0),
          node("n_b", "Add recovery codes", "Available", 0),
          node("n_c", "Audit the lockout log", "Available", 0),
        ],
        "prj-2": [node("n_d", "Apply discount codes", "Available", 0)],
      },
      jobs: {
        "prj-1": [
          job("prj-1", "n_b", 3, 5 * MINUTE),
          job("prj-1", "n_a", 3, 4 * MINUTE),
          job("prj-1", "n_c", 1, 9 * MINUTE),
        ],
        "prj-2": [job("prj-2", "n_d", 0, 2 * MINUTE)],
      },
    });

    renderScreen();

    const next = await section("Next");
    const first = await within(next).findByRole("list", { name: "Queue of kanthord" });
    expect(titles(first)).toEqual([
      "Add recovery codes",
      "Add password reset",
      "Audit the lockout log",
    ]);
    expect(titles(within(next).getByRole("list", { name: "Queue of atlas" }))).toEqual([
      "Apply discount codes",
    ]);
    expect(within(next).getByRole("heading", { name: "kanthord" })).toBeInTheDocument();
    expect(within(next).getByRole("heading", { name: "atlas" })).toBeInTheDocument();
  });

  it("states the order rule under the heading", async () => {
    serve({});

    renderScreen();

    expect(
      await screen.findByText(
        "Highest priority first, then the oldest job. A worker claims the first job that its worker admits. The order predicts no claimant.",
      ),
    ).toBeInTheDocument();
  });

  it("names the position, the state, the claim, the priority, the age and the identity of a job", async () => {
    serve({
      nodes: {
        "prj-1": [
          node("n_a", "Add password reset", "Available", 0),
          node("n_b", "Invoices page", "Waiting"),
        ],
      },
      jobs: {
        "prj-1": [job("prj-1", "n_a", 7, 3 * 60 * MINUTE), job("prj-1", "n_b", 0, 5 * MINUTE)],
      },
      instances: { "prj-1": [instance("prj-1", "coder@1"), instance("prj-1", "reviewer@1")] },
    });

    renderScreen("/scheduler?project=prj-1");

    const [first, second] = within(await screen.findByRole("list", { name: "Queue" })).getAllByRole(
      "listitem",
    );
    expect(within(first!).getByText("1")).toBeInTheDocument();
    expect(within(first!).getByRole("link", { name: "Add password reset" })).toHaveAttribute(
      "href",
      "/projects/prj-1?node=n_a",
    );
    expect(within(first!).getByText("Available")).toBeInTheDocument();
    expect(within(first!).getByText("Steps claim")).toBeInTheDocument();
    expect(within(first!).getByText("priority 7 · queued 3 hours ago")).toBeInTheDocument();
    expect(within(first!).getByText(/^job job_/)).toBeInTheDocument();
    expect(within(second!).getByText("2")).toBeInTheDocument();
    expect(within(second!).getByText("Waiting")).toBeInTheDocument();
    expect(within(second!).getByText("Evaluation claim")).toBeInTheDocument();
  });

  it("marks a job whose state no live instance declares with No taker", async () => {
    serve({
      nodes: {
        "prj-1": [
          node("n_a", "Add password reset", "Available", 0),
          node("n_b", "Invoices page", "Waiting"),
        ],
      },
      jobs: { "prj-1": [job("prj-1", "n_a", 0, MINUTE), job("prj-1", "n_b", 0, MINUTE)] },
      instances: { "prj-1": [instance("prj-1", "coder@1")] },
    });

    renderScreen("/scheduler?project=prj-1");

    const [covered, uncovered] = within(
      await screen.findByRole("list", { name: "Queue" }),
    ).getAllByRole("listitem");
    expect(within(covered!).queryByText("No taker")).toBeNull();
    expect(within(uncovered!).getByText("No taker")).toBeInTheDocument();
  });

  it("falls back to the node identity when the node list omits the node", async () => {
    serve({ jobs: { "prj-1": [job("prj-1", "node_retired", 0, MINUTE)] } });

    renderScreen("/scheduler?project=prj-1");

    expect(await screen.findByRole("link", { name: "node_retired" })).toBeInTheDocument();
  });

  it("explains an empty queue and links to Overview", async () => {
    serve({});

    renderScreen();

    expect(await screen.findByText("No job waits.")).toBeInTheDocument();
    expect(
      screen.getByText(
        textContent(
          "A Pending, Blocked or Paused node holds no job. Overview lists the nodes that wait for you.",
        ),
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/");
  });
});

describe("SchedulerScreen Done", () => {
  it("groups the ended executions by project under All projects and hides running ones", async () => {
    serve({
      nodes: {
        "prj-1": [node("n_a", "Add recovery codes", "Executing")],
        "prj-2": [node("n_b", "Add cart totals", "Completed")],
      },
      executions: {
        "prj-1": [
          execution("prj-1", "execution_run", "n_a"),
          ended("prj-1", "execution_done_1", "n_a"),
        ],
        "prj-2": [ended("prj-2", "execution_done_2", "n_b")],
      },
    });

    renderScreen();

    const done = await section("Done");
    const first = await within(done).findByRole("list", { name: "Done executions of kanthord" });
    expect(within(first).getAllByRole("listitem")).toHaveLength(1);
    expect(within(first).getByText("execution execution_done_1")).toBeInTheDocument();
    const second = within(done).getByRole("list", { name: "Done executions of atlas" });
    expect(within(second).getByText("execution execution_done_2")).toBeInTheDocument();
  });

  it("names the end, the duration and the stop of an execution", async () => {
    const stop: ExecutionStop = { reason: "provider_failed", code: "rate_limited" };
    serve({
      nodes: { "prj-1": [node("n_a", "Add recovery codes", "Available")] },
      executions: { "prj-1": [ended("prj-1", "execution_done", "n_a", { stop })] },
    });

    renderScreen("/scheduler?project=prj-1");

    const item = within(await screen.findByRole("list", { name: "Done executions" })).getByRole(
      "listitem",
    );
    expect(within(item).getByText("Finished")).toBeInTheDocument();
    expect(within(item).getByText("Provider failed: rate limited")).toBeInTheDocument();
    expect(within(item).getByText("Ended 1 hour ago")).toBeInTheDocument();
    expect(within(item).getByText("duration 20 min")).toBeInTheDocument();
  });

  it("names a lost execution without claiming that the runtime failed", async () => {
    serve({
      nodes: { "prj-1": [node("n_a", "Add recovery codes", "Available")] },
      executions: {
        "prj-1": [ended("prj-1", "execution_lost", "n_a", { claim_state: "lost" })],
      },
    });

    renderScreen("/scheduler?project=prj-1");

    const item = within(await screen.findByRole("list", { name: "Done executions" })).getByRole(
      "listitem",
    );
    expect(within(item).getByText("Lost")).toBeInTheDocument();
    expect(
      within(item).getByText("Expiry is not proof that the runtime stopped."),
    ).toBeInTheDocument();
    expect(within(item).queryByText(/failed/i)).toBeNull();
  });

  it("ends a lost execution that never ended at its deadline", async () => {
    serve({
      nodes: { "prj-1": [node("n_a", "Add recovery codes", "Available")] },
      executions: {
        "prj-1": [
          execution("prj-1", "execution_lost", "n_a", {
            claim_state: "lost",
            created_at: NOW - 80 * MINUTE,
            expired_at: NOW - 30 * MINUTE,
            ended_at: null,
          }),
        ],
      },
    });

    renderScreen("/scheduler?project=prj-1");

    const item = within(await screen.findByRole("list", { name: "Done executions" })).getByRole(
      "listitem",
    );
    expect(within(item).getByText("Ended 30 minutes ago")).toBeInTheDocument();
    expect(within(item).getByText("duration 50 min")).toBeInTheDocument();
    expect(within(item).queryByText(/^Started/)).toBeNull();
    expect(within(item).queryByText(/^Deadline/)).toBeNull();
  });

  it("pages through the ended executions of a project", async () => {
    const user = userEvent.setup();
    serve({ nodes: { "prj-1": [node("n_a", "Add recovery codes", "Available")] } });
    const pages: Readonly<Record<string, Page<SchedulerExecutionRecord>>> = {
      first: {
        items: [ended("prj-1", "execution_one", "n_a")],
        next_cursor: "c-1",
      },
      "c-1": { items: [ended("prj-1", "execution_two", "n_a")], next_cursor: null },
    };
    vi.mocked(listProjectExecutionPage).mockImplementation(async (_projectId, cursor, limit) => {
      if (limit === 100) return { items: [], next_cursor: null };
      return pages[cursor ?? "first"] ?? { items: [], next_cursor: null };
    });

    renderScreen("/scheduler?project=prj-1");

    expect(await screen.findByText("execution execution_one")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("execution execution_two")).toBeInTheDocument();
    expect(screen.queryByText("execution execution_one")).toBeNull();
    expect(listProjectExecutionPage).toHaveBeenCalledWith("prj-1", "c-1", 20);

    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(await screen.findByText("execution execution_one")).toBeInTheDocument();
  });

  it("names an empty group", async () => {
    serve({});

    renderScreen("/scheduler?project=prj-1");

    expect(await screen.findByText("No execution ended yet.")).toBeInTheDocument();
  });
});

describe("SchedulerScreen scope", () => {
  it("offers All projects first and shows every project by default", async () => {
    serve({});

    renderScreen();

    const filter = await screen.findByRole("combobox", { name: "Project" });
    expect(filter).toHaveTextContent("All projects");
  });

  it("narrows every section to the project of the search parameter", async () => {
    serve({
      nodes: {
        "prj-1": [node("n_a", "Add recovery codes", "Available", 0)],
        "prj-2": [node("n_d", "Apply discount codes", "Available", 0)],
      },
      jobs: {
        "prj-1": [job("prj-1", "n_a", 0, MINUTE)],
        "prj-2": [job("prj-2", "n_d", 0, MINUTE)],
      },
    });

    renderScreen("/scheduler?project=prj-2");

    expect(await screen.findByRole("link", { name: "Apply discount codes" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add recovery codes" })).toBeNull();
    expect(screen.getByRole("combobox", { name: "Project" })).toHaveTextContent("atlas");
    expect(screen.queryByRole("heading", { name: "atlas" })).toBeNull();
  });

  it("narrows the sections when the human picks a project", async () => {
    const user = userEvent.setup();
    serve({
      nodes: {
        "prj-1": [node("n_a", "Add recovery codes", "Available", 0)],
        "prj-2": [node("n_d", "Apply discount codes", "Available", 0)],
      },
      jobs: {
        "prj-1": [job("prj-1", "n_a", 0, MINUTE)],
        "prj-2": [job("prj-2", "n_d", 0, MINUTE)],
      },
    });
    renderScreen();

    await user.click(await screen.findByRole("combobox", { name: "Project" }));
    await user.click(await screen.findByRole("option", { name: "kanthord" }));

    expect(await screen.findByRole("link", { name: "Add recovery codes" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Apply discount codes" })).toBeNull();
  });

  it("falls back to All projects for a project that the server does not hold", async () => {
    serve({});

    renderScreen("/scheduler?project=prj-gone");

    expect(await screen.findByRole("combobox", { name: "Project" })).toHaveTextContent(
      "All projects",
    );
  });
});

describe("SchedulerScreen paused project", () => {
  it("names a paused project and resumes it", async () => {
    const user = userEvent.setup();
    serve({ projects: [project("prj-1", "kanthord", NOW - MINUTE)] });
    vi.mocked(resumeProject).mockResolvedValue(project("prj-1", "kanthord"));

    renderScreen();

    expect(
      await screen.findByText(
        textContent("kanthord is paused. The scheduler claims no job of it."),
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Resume project" }));

    expect(resumeProject).toHaveBeenCalledWith("prj-1");
  });
});

describe("SchedulerScreen states", () => {
  it("shows the heading without sections while the first read runs", () => {
    serve({});
    vi.mocked(listProjects).mockReturnValue(new Promise(() => undefined));

    renderScreen();

    expect(screen.getByRole("heading", { name: "Scheduler" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Now" })).toBeNull();
  });

  it("explains a first read that failed and retries on demand", async () => {
    const user = userEvent.setup();
    serve({});
    vi.mocked(listProjects).mockRejectedValueOnce(
      new ApiError("unavailable", "The daemon did not answer.", 503),
    );

    renderScreen();

    expect(await screen.findByText("The scheduler could not be read.")).toBeInTheDocument();
    expect(screen.getByText("The daemon did not answer.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByRole("heading", { name: "Now" })).toBeInTheDocument();
  });

  it("keeps the last data and names the failure when a later read fails", async () => {
    const user = userEvent.setup();
    serve({
      nodes: { "prj-1": [node("n_a", "Add recovery codes", "Executing")] },
      executions: { "prj-1": [execution("prj-1", "execution_a", "n_a")] },
    });
    renderScreen("/scheduler?project=prj-1");
    await screen.findByRole("link", { name: "Add recovery codes" });
    vi.mocked(listProjects).mockRejectedValue(
      new ApiError("unavailable", "The daemon did not answer.", 503),
    );

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    expect(await screen.findByText("The scheduler could not be refreshed.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add recovery codes" })).toBeInTheDocument();
  });

  it("names the age of the data", async () => {
    serve({});

    renderScreen();

    expect(await screen.findByText("Updated just now")).toBeInTheDocument();
  });
});
