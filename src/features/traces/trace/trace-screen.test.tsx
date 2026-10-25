import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { CrumbLabelsProvider } from "@/components/crumb-labels";

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
import { listSessionEntryPage, listTraceSpans, readTrace } from "@/api/resources/tracking";
import type {
  MissionNodeRecord,
  Project,
  TraceSessionEntry,
  TraceSpan,
  TraceSummary,
} from "@/api/types";
import { durationText, utcDateTime } from "@/lib/format";

import { TraceScreen } from "./trace-screen";
import { TRACE_POLL_MS } from "./use-trace";

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

function mountWithBreadcrumb() {
  return render(
    <MemoryRouter initialEntries={["/traces/trace-1"]}>
      <CrumbLabelsProvider>
        <AppBreadcrumb />
        <Routes>
          <Route path="/traces/:traceId" element={<TraceScreen />} />
        </Routes>
      </CrumbLabelsProvider>
    </MemoryRouter>,
  );
}

function currentCrumb(name: string): HTMLElement {
  return within(screen.getByRole("navigation", { name: "breadcrumb" })).getByText(name);
}

function rowOf(label: string): HTMLElement {
  const row = screen
    .getAllByRole("treeitem")
    .find((item) => within(item).queryByText(label) !== null);
  if (row === undefined) throw new Error(`No row ${label}`);
  return row;
}

function labelsOfRows(): readonly (string | null)[] {
  return screen
    .getAllByRole("treeitem")
    .map((item) => item.querySelector("span.font-medium")?.textContent ?? null);
}

async function mountExpanded(entry?: string) {
  const view = mount(entry);
  await screen.findByRole("tree", { name: "Spans" });
  fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
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
  vi.mocked(readMissionNode).mockResolvedValue({
    content: { name: "Build the page" },
  } as MissionNodeRecord);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("TraceScreen header", () => {
  it("shows the title, the badges and the facts", async () => {
    mount();

    const title = await screen.findByRole("link", { name: "Build the page" });
    expect(title).toHaveAttribute("href", "/projects/prj-1?node=node-1");
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    await screen.findByText("kanthord");
    const header = screen.getByRole("region", { name: "Trace" });
    for (const [label, value] of [
      ["Project", "kanthord"],
      ["Execution", "exec-1"],
      ["Attempt", "2"],
      ["Worker", "general"],
      ["Started", utcDateTime(START)],
      ["Duration", durationText(90_000)],
      ["Input tokens", "1.2k"],
      ["Output tokens", "600"],
      ["Cached tokens", "500"],
      ["Est. cost", "$0.0600"],
    ] as const) {
      expect(within(header).getByText(label).nextElementSibling).toHaveTextContent(value);
    }
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Jump to first error" })).not.toBeInTheDocument();
  });

  it("falls back to the execution identity when the node name is absent", async () => {
    vi.mocked(readMissionNode).mockRejectedValue(new ApiError("not_found", "No node.", 404));
    mount();

    expect(await screen.findByRole("heading", { name: "exec-1" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "exec-1" })).not.toBeInTheDocument();
  });

  it("titles a trace with no node and no execution by its root label in the header and the breadcrumb", async () => {
    vi.mocked(readTrace).mockResolvedValue(
      summary({
        node_id: null,
        execution_id: null,
        root_operation: "project.environment",
        root_attributes: { "project.binding.name": "web" },
      }),
    );
    mountWithBreadcrumb();

    expect(
      await screen.findByRole("heading", { level: 2, name: "Environment web" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Environment web" })).toBeInTheDocument();
    expect(currentCrumb("Environment web")).toHaveAttribute("aria-current", "page");
  });

  it("titles the breadcrumb of a node trace by the node name", async () => {
    mountWithBreadcrumb();

    await screen.findByRole("link", { name: "Build the page" });
    await waitFor(() =>
      expect(currentCrumb("Build the page")).toHaveAttribute("aria-current", "page"),
    );
  });

  it("shows the Live badge and the pause toggle of an open trace", async () => {
    vi.mocked(readTrace).mockResolvedValue(
      summary({ state: "open", duration_ms: null, ended_at: null, stop_reason: null }),
    );
    mount();

    expect(await screen.findByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("Duration").nextElementSibling).toHaveTextContent("running");
    expect(screen.getByRole("button", { name: "Pause updates" })).toBeInTheDocument();
  });

  it("shows the expired message for a not_found read", async () => {
    vi.mocked(readTrace).mockRejectedValue(new ApiError("not_found", "No trace.", 404));
    mount();

    expect(await screen.findByText("This trace is expired or unknown.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to traces" })).toHaveAttribute("href", "/traces");
  });

  it("shows the error message and Retry for another failure", async () => {
    vi.mocked(readTrace).mockRejectedValueOnce(new ApiError("unavailable", "Daemon down.", 503));
    mount();

    expect(await screen.findByText("Daemon down.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("tree", { name: "Spans" })).toBeInTheDocument();
  });
});

describe("TraceScreen timeline", () => {
  it("expands the root and the phases on the first render", async () => {
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    expect(labelsOfRows()).toEqual(["Execution", "Phase execute", "Task t1", "Git commit"]);
  });

  it("shows the task with its session and turns, and a tool under its turn", async () => {
    await mountExpanded();

    expect(labelsOfRows()).toEqual([
      "Execution",
      "Phase execute",
      "Task t1",
      "Session coder",
      "Turn 1",
      "bash",
      "Turn 2",
      "read",
      "Git commit",
    ]);
    expect(rowOf("bash")).toHaveAttribute("aria-level", "5");
    expect(rowOf("Phase execute")).toHaveAttribute("aria-expanded", "true");
  });

  it("shows tokens and cost on a turn and the sums on the task and the session", async () => {
    await mountExpanded();

    expect(
      within(rowOf("Turn 1")).getByText("1.5k tokens · Est. cost $0.0500"),
    ).toBeInTheDocument();
    expect(within(rowOf("Turn 2")).getByText("300 tokens · Est. cost $0.0100")).toBeInTheDocument();
    expect(
      within(rowOf("Task t1")).getByText("1.8k tokens · Est. cost $0.0600"),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Session coder")).getByText("1.8k tokens · Est. cost $0.0600"),
    ).toBeInTheDocument();
  });

  it("shows No end recorded in an ok trace", async () => {
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

  it("keeps the error span and its ancestors with Errors only", async () => {
    await mountExpanded();

    fireEvent.click(screen.getByRole("button", { name: "Errors only" }));

    expect(labelsOfRows()).toEqual(["Execution", "Phase execute", "Task t1", "Turn 2", "read"]);
    expect(within(rowOf("read")).getByText("Error")).toBeInTheDocument();
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

  it("filters by group", async () => {
    await mountExpanded();

    fireEvent.click(screen.getByRole("button", { name: "Tools" }));

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
    expect(screen.getByRole("treeitem", { name: /Turn 1/ })).toBeInTheDocument();

    await user.keyboard("{ArrowLeft}");
    expect(rowOf("Task t1")).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("treeitem", { name: /Turn 1/ })).not.toBeInTheDocument();

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
    expect(screen.getByText(/at \/traces\/trace-1\?tab=span_tree&span=root/)).toBeInTheDocument();
  });

  it("selects the first error span with Jump to first error", async () => {
    vi.mocked(readTrace).mockResolvedValue(
      summary({ state: "error", error_count: 1, first_error_span_id: "tool2" }),
    );
    mount();
    fireEvent.click(await screen.findByRole("button", { name: "Jump to first error" }));

    expect(rowOf("read")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("at /traces/trace-1?tab=span_tree&span=tool2")).toBeInTheDocument();
  });

  it("selects the span of the query string and expands its ancestors", async () => {
    mount("/traces/trace-1?tab=span_tree&span=tool1");

    await screen.findByRole("tree", { name: "Spans" });
    expect(rowOf("bash")).toHaveAttribute("aria-selected", "true");
    expect(rowOf("Turn 1")).toBeInTheDocument();
    expect(rowOf("Task t1")).toHaveAttribute("aria-expanded", "true");
  });
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

  it("shows the detail of a clicked span in a sheet below the large screen", async () => {
    matchLargeScreen(false);
    mount();
    await screen.findByRole("tree", { name: "Spans" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    fireEvent.click(rowOf("Task t1"));

    const sheet = await screen.findByRole("dialog", { name: "Span detail" });
    expect(within(sheet).getByRole("heading", { name: "Task t1" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("clears the span of the query string when the sheet closes", async () => {
    matchLargeScreen(false);
    mount("/traces/trace-1?tab=span_tree&span=task");

    const sheet = await screen.findByRole("dialog", { name: "Span detail" });
    expect(screen.getByText("at /traces/trace-1?tab=span_tree&span=task")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("at /traces/trace-1?tab=span_tree")).toBeInTheDocument();
  });
});

describe("TraceScreen polling", () => {
  function advance(ms: number) {
    return act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it("reads an open trace again after 5 seconds and stops when the human pauses", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(readTrace).mockResolvedValue(summary({ state: "open" }));
    mount();
    await waitFor(() => expect(readTrace).toHaveBeenCalledTimes(1));
    await screen.findByRole("tree", { name: "Spans" });

    await advance(TRACE_POLL_MS);
    expect(readTrace).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: "Pause updates" }));
    expect(screen.getByText("Paused")).toBeInTheDocument();
    await advance(TRACE_POLL_MS * 3);
    expect(readTrace).toHaveBeenCalledTimes(2);
  });

  it("stops reading when the trace ends", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(readTrace)
      .mockResolvedValueOnce(summary({ state: "open" }))
      .mockResolvedValue(summary({ state: "ok" }));
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    await advance(TRACE_POLL_MS);
    expect(readTrace).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Live")).not.toBeInTheDocument();

    await advance(TRACE_POLL_MS * 3);
    expect(readTrace).toHaveBeenCalledTimes(2);
  });

  it("does not read an ok trace again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    await advance(TRACE_POLL_MS * 3);

    expect(readTrace).toHaveBeenCalledTimes(1);
  });
});

describe("TraceScreen conversation", () => {
  function replyEntry(sequence: number): TraceSessionEntry {
    return {
      trace_id: "trace-1",
      session_id: "session",
      entry_id: `reply-${sequence}`,
      parent_entry_id: null,
      sequence,
      entry_type: "message",
      entry_time: START,
      tool_call_id: null,
      truncated: false,
      entry: {
        type: "message",
        message: { role: "assistant", content: [{ type: "text", text: `Answer ${sequence}.` }] },
      },
      created_at: START,
    };
  }

  function withReplyEntry(): readonly TraceSpan[] {
    return spans().map((item) =>
      item.span_id === "turn1"
        ? { ...item, attributes: { ...item.attributes, "kanthord.session.entry_id": "reply-1" } }
        : item,
    );
  }

  it("names the first tab Span tree and writes tab=span_tree when the human returns to it", async () => {
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: [], next_cursor: null });
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    expect(screen.getByRole("tab", { name: "Span tree" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Timeline" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Conversation" }));
    await userEvent.click(screen.getByRole("tab", { name: "Span tree" }));

    expect(screen.getByText("at /traces/trace-1?tab=span_tree")).toBeInTheDocument();
  });

  it("reads no entry before the human opens the Conversation tab", async () => {
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: [], next_cursor: null });
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    expect(listSessionEntryPage).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("tab", { name: "Conversation" }));

    expect(screen.getByText("at /traces/trace-1?tab=conversation")).toBeInTheDocument();
    expect(listSessionEntryPage).toHaveBeenCalledWith("trace-1", "session", null, 100);
  });

  it("links an entry to its turn span and the turn span back to the entry", async () => {
    vi.mocked(listTraceSpans).mockResolvedValue(withReplyEntry());
    vi.mocked(listSessionEntryPage).mockResolvedValue({
      items: [replyEntry(1)],
      next_cursor: null,
    });
    mount("/traces/trace-1?tab=conversation");

    await userEvent.click(await screen.findByRole("button", { name: "Show in span tree" }));

    expect(screen.getByText("at /traces/trace-1?tab=span_tree&span=turn1")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Open in conversation" }));

    expect(
      screen.getByText(
        "at /traces/trace-1?tab=conversation&span=turn1&session=session&entry=reply-1",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Answer 1.")).toBeInTheDocument();
  });

  it("adds the new entries of an open trace every 5 seconds without a repeat", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(readTrace).mockResolvedValue(summary({ state: "open" }));
    vi.mocked(listSessionEntryPage)
      .mockResolvedValueOnce({ items: [replyEntry(1)], next_cursor: null })
      .mockResolvedValue({ items: [replyEntry(1), replyEntry(2)], next_cursor: null });
    mount("/traces/trace-1?tab=conversation");
    expect(await screen.findByText("Answer 1.")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(await screen.findByText("Answer 2.")).toBeInTheDocument();
    expect(screen.getAllByText("Answer 1.")).toHaveLength(1);
  });
});
