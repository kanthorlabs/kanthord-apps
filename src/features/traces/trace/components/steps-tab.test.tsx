import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
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
}));

import { readMissionNode } from "@/api/resources/mission";
import { listProjects } from "@/api/resources/projects";
import { listTraceSpans, readTrace } from "@/api/resources/tracking";
import type { MissionNodeRecord, Project, TraceSpan, TraceSummary } from "@/api/types";

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
  const navigate = useNavigate();
  return (
    <>
      <p>{`at ${location.pathname}${location.search}`}</p>
      <button type="button" onClick={() => navigate(-1)}>
        System back
      </button>
    </>
  );
}

function mount(entry = "/traces/trace-1") {
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
  vi.mocked(readMissionNode).mockResolvedValue({
    content: { name: "Build the page" },
  } as MissionNodeRecord);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("TraceScreen span detail", () => {
  it("asks for a selection while no span is selected", async () => {
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    const panel = screen.getByRole("complementary", { name: "Span detail" });
    expect(within(panel).getByText("Select a span to see its detail.")).toBeInTheDocument();
  });

  it("shows the detail of a clicked span in the panel on a large screen", async () => {
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    fireEvent.click(rowOf("Task t1"));

    const panel = screen.getByRole("complementary", { name: "Span detail" });
    expect(within(panel).getByRole("heading", { name: "Task t1" })).toBeInTheDocument();
    expect(within(panel).getByText("Duration")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the detail of a clicked span as a stacked level below the large screen", async () => {
    matchLargeScreen(false);
    mount();
    await screen.findByRole("tree", { name: "Spans" });
    expect(screen.queryByRole("button", { name: "Back to steps" })).not.toBeInTheDocument();

    fireEvent.click(rowOf("Task t1"));

    const level = await screen.findByRole("region", { name: "Span detail" });
    expect(within(level).getByRole("heading", { name: "Task t1" })).toBeInTheDocument();
    expect(within(level).getByRole("button", { name: "Back to steps" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("keeps the tree mounted and hidden under the stacked level", async () => {
    matchLargeScreen(false);
    mount();
    await screen.findByRole("tree", { name: "Spans" });
    expect(screen.getByRole("tree", { name: "Spans" })).toBeVisible();

    fireEvent.click(rowOf("Task t1"));

    await screen.findByRole("button", { name: "Back to steps" });
    expect(screen.getByRole("tree", { name: "Spans", hidden: true })).not.toBeVisible();
  });

  it("opens the stacked level above the tree for a deep link with a span", async () => {
    matchLargeScreen(false);
    mount("/traces/trace-1?tab=steps&span=task");

    const level = await screen.findByRole("region", { name: "Span detail" });
    expect(within(level).getByRole("heading", { name: "Task t1" })).toBeInTheDocument();
    expect(screen.getByRole("tree", { name: "Spans", hidden: true })).not.toBeVisible();
  });

  it("clears the span of the query string and shows the tree with Back to steps", async () => {
    matchLargeScreen(false);
    mount("/traces/trace-1?tab=steps&span=task");

    const back = await screen.findByRole("button", { name: "Back to steps" });
    expect(screen.getByText("at /traces/trace-1?tab=steps&span=task")).toBeInTheDocument();
    fireEvent.click(back);

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Back to steps" })).not.toBeInTheDocument(),
    );
    expect(screen.getByText("at /traces/trace-1?tab=steps")).toBeInTheDocument();
    expect(screen.getByRole("tree", { name: "Spans" })).toBeVisible();
  });

  it("closes the stacked level with the system back control", async () => {
    matchLargeScreen(false);
    mount();
    await screen.findByRole("tree", { name: "Spans" });
    fireEvent.click(rowOf("Task t1"));
    await screen.findByRole("button", { name: "Back to steps" });

    fireEvent.click(screen.getByRole("button", { name: "System back" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Back to steps" })).not.toBeInTheDocument(),
    );
    expect(screen.getByText("at /traces/trace-1")).toBeInTheDocument();
  });
});
