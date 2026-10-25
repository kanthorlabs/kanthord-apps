import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/tracking", () => ({
  readTrace: vi.fn(),
  listTraceSpans: vi.fn(),
  readTraceText: vi.fn(),
  readSessionEntry: vi.fn(),
  listSessionEntryPage: vi.fn(),
}));

vi.mock("@/api/resources/projects", () => ({
  listProjects: vi.fn(),
}));

vi.mock("@/api/resources/mission", () => ({
  readMissionNode: vi.fn(),
  listNodeAttempts: vi.fn(),
  readNodeRevision: vi.fn(),
}));

import { listNodeAttempts, readMissionNode, readNodeRevision } from "@/api/resources/mission";
import { listProjects } from "@/api/resources/projects";
import { listTraceSpans, readTrace } from "@/api/resources/tracking";
import type {
  MissionNodeRecord,
  MissionRevision,
  MissionAttempt,
  Project,
  TraceSpan,
  TraceSummary,
} from "@/api/types";

import { TraceScreen } from "../trace-screen";

const START = Date.UTC(2026, 4, 2, 10, 30);

function summary(overrides: Partial<TraceSummary> = {}): TraceSummary {
  return {
    trace_id: "trace-1",
    project_id: "prj-1",
    execution_id: "exec-1",
    node_id: "node-1",
    attempt: 2,
    root_span_id: "root",
    created_at: START,
    state: "ok",
    started_at: START,
    ended_at: START + 90_000,
    duration_ms: 90_000,
    stop_reason: "completed",
    worker_name: "general",
    agent_names: ["coder"],
    models: ["claude-a"],
    input_tokens: 1200,
    output_tokens: 600,
    cache_read_tokens: 300,
    cache_creation_tokens: 200,
    total_tokens: 1800,
    cost_usd: 0.06,
    span_count: 8,
    turn_count: 2,
    tool_count: 2,
    error_count: 0,
    error_types: [],
    first_error_span_id: null,
    root_operation: "scheduler.execution",
    root_attributes: {},
    ...overrides,
  };
}

function span(
  id: string,
  parent: string | null,
  operation: string,
  attributes: TraceSpan["attributes"] = {},
  overrides: Partial<TraceSpan> = {},
): TraceSpan {
  return {
    trace_id: "trace-1",
    span_id: id,
    parent_span_id: parent,
    producer: "worker",
    origin: "observed",
    operation,
    start_time: START,
    end_time: START + 90_000,
    status: "Ok",
    attributes,
    events: [],
    links: [],
    text_ids: [],
    created_at: START,
    ...overrides,
  };
}

function spans(): readonly TraceSpan[] {
  return [
    span("root", null, "scheduler.execution"),
    span(
      "phase",
      "root",
      "worker.phase",
      { "kanthord.phase": "execute" },
      { start_time: START + 1 },
    ),
    span("task", "phase", "worker.task", { "kanthord.task.id": "t1" }, { start_time: START + 2 }),
    span(
      "session",
      "task",
      "agent.session",
      { "kanthord.agent.name": "coder" },
      { start_time: START + 3 },
    ),
    span(
      "turn1",
      "task",
      "agent.turn",
      {
        "kanthord.turn.index": 1,
        "gen_ai.conversation.id": "session",
        "gen_ai.usage.input_tokens": 1000,
        "gen_ai.usage.output_tokens": 500,
        "kanthord.usage.cost_usd": 0.05,
      },
      { start_time: START + 4 },
    ),
    span(
      "turn2",
      "task",
      "agent.turn",
      {
        "kanthord.turn.index": 2,
        "gen_ai.conversation.id": "session",
        "gen_ai.usage.input_tokens": 200,
        "gen_ai.usage.output_tokens": 100,
        "kanthord.usage.cost_usd": 0.01,
      },
      { start_time: START + 5 },
    ),
    span("tool1", "turn1", "agent.tool", { "gen_ai.tool.name": "bash" }, { start_time: START + 6 }),
    span(
      "tool2",
      "turn2",
      "agent.tool",
      { "gen_ai.tool.name": "read" },
      { start_time: START + 7, status: "Error" },
    ),
    span(
      "git",
      "root",
      "worker.git",
      { "kanthord.git.step": "commit" },
      { start_time: START + 8, end_time: null },
    ),
  ];
}

function project(): Project {
  return {
    id: "prj-1",
    name: "kanthord",
    binding_set_version: 1,
    created_at: 1,
    paused_at: null,
    workspace_directory: "/state/prj-1",
  };
}

function Probe() {
  const location = useLocation();
  return <p>{`at ${location.pathname}${location.search}`}</p>;
}

function mount(entry = "/traces/trace-1?tab=steps") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/traces" element={<p>Traces list</p>} />
        <Route path="/traces/:traceId" element={<TraceScreen />} />
      </Routes>
      <Probe />
    </MemoryRouter>,
  );
}

function rowOf(label: string): HTMLElement {
  const row = screen
    .getAllByRole("treeitem")
    .find((item) => within(item).queryByText(label) !== null);
  if (row === undefined) throw new Error(`No row ${label}`);
  return row;
}

function labelsOfRows(): readonly (string | null)[] {
  return screen.getAllByRole("treeitem").map((item) => item.getAttribute("aria-label"));
}

function openMore() {
  fireEvent.click(screen.getByRole("button", { name: "More" }));
}

async function mountExpanded(entry?: string) {
  const view = mount(entry);
  await screen.findByRole("tree", { name: "Spans" });
  openMore();
  fireEvent.click(await screen.findByRole("button", { name: "Expand all" }));
  return view;
}

async function mountOpened() {
  const view = await mountExpanded();
  fireEvent.click(screen.getByRole("button", { name: "Expand Turns 1-2" }));
  return view;
}

function matchLargeScreen(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => {
  matchLargeScreen(true);
  vi.mocked(readTrace).mockResolvedValue(summary());
  vi.mocked(listTraceSpans).mockResolvedValue(spans());
  vi.mocked(listProjects).mockResolvedValue([project()]);
  vi.mocked(listNodeAttempts).mockResolvedValue([]);
  vi.mocked(readMissionNode).mockResolvedValue({
    content: { name: "Build the page" },
  } as MissionNodeRecord);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("TraceScreen timeline", () => {
  it("expands the root and the phases on the first render", async () => {
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    expect(labelsOfRows()).toEqual(["Execution", "Phase execute", "Task t1", "Git commit"]);
  });

  it("folds the turns into one collapsed group row", async () => {
    await mountExpanded();

    expect(labelsOfRows()).toEqual([
      "Execution",
      "Phase execute",
      "Task t1",
      "Session coder",
      "Turns 1-2",
      "Git commit",
    ]);
    const group = rowOf("Turns 1-2");
    expect(group).toHaveAttribute("aria-expanded", "false");
    expect(within(group).getByText("2 turns")).toBeInTheDocument();
    expect(within(group).getByText("1 tool error")).toBeInTheDocument();
    expect(within(group).getByText("2 min")).toBeInTheDocument();
  });

  it("opens a group to show its turns and a tool under its turn", async () => {
    await mountOpened();

    expect(labelsOfRows()).toEqual([
      "Execution",
      "Phase execute",
      "Task t1",
      "Session coder",
      "Turns 1-2",
      "Turn 1",
      "bash",
      "Turn 2",
      "read",
      "Git commit",
    ]);
    expect(rowOf("bash")).toHaveAttribute("aria-level", "6");
    expect(rowOf("Phase execute")).toHaveAttribute("aria-expanded", "true");
    expect(rowOf("Turns 1-2")).toHaveAttribute("aria-expanded", "true");
  });

  it("shows the duration and no tokens or cost on a row", async () => {
    await mountOpened();

    expect(within(rowOf("Turn 1")).getByText("1 min")).toBeInTheDocument();
    const tree = screen.getByRole("tree", { name: "Spans" });
    expect(within(tree).queryByText(/tokens/)).not.toBeInTheDocument();
    expect(within(tree).queryByText(/Est\. cost/)).not.toBeInTheDocument();
  });

  it("shows the name of the task of a worker.task row", async () => {
    vi.mocked(listNodeAttempts).mockResolvedValue([
      { attempt: 2, node_revision: 3 } as MissionAttempt,
    ]);
    vi.mocked(readNodeRevision).mockResolvedValue({
      tasks: [{ id: "t1", content: { name: "Build the page" } }],
    } as unknown as MissionRevision);
    mount();

    await waitFor(() =>
      expect(labelsOfRows()).toEqual([
        "Execution",
        "Phase execute",
        "Build the page",
        "Git commit",
      ]),
    );
  });

  it("marks the causal span with Cause and keeps its Error status", async () => {
    await mountOpened();

    expect(within(rowOf("read")).getByText("Cause")).toBeInTheDocument();
    expect(within(rowOf("read")).getByText("Error")).toBeInTheDocument();
    expect(within(rowOf("bash")).queryByText("Cause")).not.toBeInTheDocument();
  });

  it("shows a muted recovered text on a recovered error", async () => {
    vi.mocked(listTraceSpans).mockResolvedValue(
      spans().map((item) =>
        item.span_id === "tool1" ? { ...item, status: "Error", end_time: START + 100 } : item,
      ),
    );
    await mountOpened();

    expect(within(rowOf("bash")).getByText("recovered")).toBeInTheDocument();
    expect(within(rowOf("bash")).queryByText("Error")).not.toBeInTheDocument();
    expect(within(rowOf("read")).getByText("Error")).toBeInTheDocument();
  });

  it("shows the depth as a number below the last indent level", async () => {
    const chain = [
      span("root", null, "scheduler.execution"),
      ...[1, 2, 3, 4, 5, 6].map((level) =>
        span(
          `phase_${level}`,
          level === 1 ? "root" : `phase_${level - 1}`,
          "worker.phase",
          { "kanthord.phase": "execute" },
          { start_time: START + level },
        ),
      ),
    ];
    vi.mocked(listTraceSpans).mockResolvedValue(chain);
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    expect(screen.getByLabelText("Depth 6")).toHaveTextContent("6");
    expect(screen.getByLabelText("Depth 5")).toHaveTextContent("5");
    expect(screen.queryByLabelText("Depth 4")).not.toBeInTheDocument();
  });

  it("shows No end recorded in an ok trace", async () => {
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    expect(within(rowOf("Git commit")).getByText("No end recorded")).toBeInTheDocument();
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
  });

  it("shows No end recorded in an error trace", async () => {
    vi.mocked(readTrace).mockResolvedValue(summary({ state: "error" }));
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    expect(within(rowOf("Git commit")).getByText("No end recorded")).toBeInTheDocument();
    expect(screen.queryByText("Running")).not.toBeInTheDocument();
  });

  it("shows Running in an open trace", async () => {
    vi.mocked(readTrace).mockResolvedValue(summary({ state: "open" }));
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    expect(within(rowOf("Git commit")).getByText("Running")).toBeInTheDocument();
    expect(screen.queryByText("No end recorded")).not.toBeInTheDocument();
  });

  it("keeps the causal span and its ancestors with the Errors pill", async () => {
    await mountExpanded();

    fireEvent.click(screen.getByRole("button", { name: "Errors 1" }));

    expect(labelsOfRows()).toEqual(["Execution", "Phase execute", "Task t1", "Turn 2", "read"]);
    expect(within(rowOf("read")).getByText("Error")).toBeInTheDocument();
  });

  it("adds the recovered errors with All errors", async () => {
    vi.mocked(listTraceSpans).mockResolvedValue(
      spans().map((item) =>
        item.span_id === "tool1" ? { ...item, status: "Error", end_time: START + 100 } : item,
      ),
    );
    await mountExpanded();

    fireEvent.click(screen.getByRole("button", { name: "Errors 1" }));
    expect(labelsOfRows()).not.toContain("bash");
    fireEvent.click(screen.getByRole("button", { name: "All errors" }));

    expect(labelsOfRows()).toEqual([
      "Execution",
      "Phase execute",
      "Task t1",
      "Turn 1",
      "bash",
      "Turn 2",
      "read",
    ]);
  });

  it("keeps the matching tool span and its ancestors for the search bash", async () => {
    await mountExpanded();

    fireEvent.change(screen.getByRole("textbox", { name: "Search spans" }), {
      target: { value: "bash" },
    });

    expect(labelsOfRows()).toEqual(["Execution", "Phase execute", "Task t1", "Turn 1", "bash"]);
  });

  it("shows a message when no span matches", async () => {
    await mountExpanded();

    fireEvent.change(screen.getByRole("textbox", { name: "Search spans" }), {
      target: { value: "nothing like this" },
    });

    expect(screen.getByText("No spans match these filters.")).toBeInTheDocument();
    expect(screen.queryByRole("tree")).not.toBeInTheDocument();
  });

  it("filters by the Git pill and by the Agent pill", async () => {
    await mountExpanded();

    fireEvent.click(screen.getByRole("button", { name: "Git" }));
    expect(labelsOfRows()).toEqual(["Execution", "Git commit"]);

    fireEvent.click(screen.getByRole("button", { name: "Agent" }));
    expect(labelsOfRows()).toEqual([
      "Execution",
      "Phase execute",
      "Task t1",
      "Session coder",
      "Turn 1",
      "bash",
      "Turn 2",
      "read",
    ]);
  });

  it("collapses every row with Collapse all", async () => {
    await mountExpanded();

    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));

    expect(labelsOfRows()).toEqual(["Execution"]);
  });

  it("moves, expands and collapses with the keyboard", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    await user.click(rowOf("Execution"));
    expect(rowOf("Execution")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(rowOf("Phase execute")).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowDown}");
    expect(rowOf("Task t1")).toHaveAttribute("aria-selected", "true");
    expect(rowOf("Task t1")).toHaveAttribute("aria-expanded", "false");

    await user.keyboard("{ArrowRight}");
    expect(rowOf("Task t1")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("treeitem", { name: /Session coder/ })).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(rowOf("Task t1")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: /Session coder/ })).not.toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(rowOf("Phase execute")).toHaveAttribute("aria-selected", "true");

    await user.keyboard("{ArrowUp}");
    expect(rowOf("Execution")).toHaveAttribute("aria-selected", "true");
    expect(rowOf("Execution")).toHaveFocus();
  });

  it("selects the first row with Enter when no row is selected", async () => {
    const user = userEvent.setup();
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    rowOf("Execution").focus();
    await user.keyboard("{Enter}");

    expect(rowOf("Execution")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/at \/traces\/trace-1\?tab=steps&span=root/)).toBeInTheDocument();
  });

  it("selects the span of the query string and expands its ancestors", async () => {
    mount("/traces/trace-1?tab=span_tree&span=tool1");

    await screen.findByRole("tree", { name: "Spans" });
    expect(rowOf("bash")).toHaveAttribute("aria-selected", "true");
    expect(rowOf("Turn 1")).toBeInTheDocument();
    expect(rowOf("Turns 1-2")).toHaveAttribute("aria-expanded", "true");
    expect(rowOf("Task t1")).toHaveAttribute("aria-expanded", "true");
  });
});
