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
  it("shows the Traces link, the title, the state badge and one line of facts", async () => {
    mount();

    const title = await screen.findByRole("link", { name: "Build the page" });
    expect(title).toHaveAttribute("href", "/projects/prj-1?node=node-1");
    const header = screen.getByRole("region", { name: "Trace" });
    expect(within(header).getByRole("button", { name: "Traces" })).toHaveAttribute(
      "href",
      "/traces",
    );
    expect(within(header).getByText("OK")).toBeInTheDocument();
    for (const [label, value] of [
      ["Duration", durationText(90_000)],
      ["Tokens", "1.8k"],
      ["Est. cost", "$0.0600"],
      ["Attempt", "2"],
    ] as const) {
      expect(within(header).getByText(label).nextElementSibling).toHaveTextContent(value);
    }
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.queryByText("Worker")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Jump to first error" })).not.toBeInTheDocument();
  });

  it("shows every other fact behind Details", async () => {
    mount();
    await screen.findByText("Duration");
    const header = screen.getByRole("region", { name: "Trace" });
    const details = within(header).getByRole("button", { name: "Details" });
    expect(details).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(details);

    expect(details).toHaveAttribute("aria-expanded", "true");
    await within(header).findByText("kanthord");
    for (const [label, value] of [
      ["Project", "kanthord"],
      ["Execution", "exec-1"],
      ["Worker", "general"],
      ["Started", utcDateTime(START)],
      ["Stop reason", "completed"],
      ["Input tokens", "1.2k"],
      ["Output tokens", "600"],
      ["Cached tokens", "500"],
    ] as const) {
      expect(within(header).getByText(label).nextElementSibling).toHaveTextContent(value);
    }
  });

  it("goes back to the trace list with the Traces link", async () => {
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Traces" }));

    expect(screen.getByText("Traces list")).toBeInTheDocument();
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

  it("gives Retry the compact touch target", async () => {
    vi.mocked(readTrace).mockRejectedValueOnce(new ApiError("unavailable", "Daemon down.", 503));
    mount();

    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(retry.parentElement).toHaveClass("[&>*]:min-h-11");
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

  it("reads the spans once while the summary stays the same", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(readTrace).mockResolvedValue(summary({ state: "open" }));
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    await advance(TRACE_POLL_MS * 3);

    expect(readTrace).toHaveBeenCalledTimes(4);
    expect(listTraceSpans).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["span_count", { span_count: 9 }],
    ["error_count", { error_count: 1 }],
    ["total_tokens", { total_tokens: 2000 }],
    ["ended_at", { ended_at: START + 120_000 }],
  ] as const)("reads the spans again when %s changes", async (_name, change) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(readTrace)
      .mockResolvedValueOnce(summary({ state: "open" }))
      .mockResolvedValue(summary({ state: "open", ...change }));
    mount();
    await screen.findByRole("tree", { name: "Spans" });
    expect(listTraceSpans).toHaveBeenCalledTimes(1);

    await advance(TRACE_POLL_MS);
    expect(listTraceSpans).toHaveBeenCalledTimes(2);

    await advance(TRACE_POLL_MS);
    expect(listTraceSpans).toHaveBeenCalledTimes(2);
  });

  it("holds the poll while the page is hidden and resumes when it shows again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let visibility: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    vi.mocked(readTrace).mockResolvedValue(summary({ state: "open" }));
    try {
      mount();
      await screen.findByRole("tree", { name: "Spans" });
      expect(readTrace).toHaveBeenCalledTimes(1);

      visibility = "hidden";
      document.dispatchEvent(new Event("visibilitychange"));
      await advance(TRACE_POLL_MS * 3);
      expect(readTrace).toHaveBeenCalledTimes(1);

      visibility = "visible";
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(readTrace).toHaveBeenCalledTimes(2);
    } finally {
      Reflect.deleteProperty(document, "visibilityState");
    }
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

  it("lists the tabs Steps and Conversation and writes tab=steps when the human returns", async () => {
    vi.mocked(listSessionEntryPage).mockResolvedValue({ items: [], next_cursor: null });
    mount();
    await screen.findByRole("tree", { name: "Spans" });

    const tabs = within(screen.getByRole("tablist")).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Steps", "Conversation"]);
    expect(screen.getByRole("tab", { name: "Steps" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "Span tree" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "Conversation" }));
    await userEvent.click(screen.getByRole("tab", { name: "Steps" }));

    expect(screen.getByText("at /traces/trace-1?tab=steps")).toBeInTheDocument();
  });

  it("opens the Steps tab for the old value tab=span_tree", async () => {
    mount("/traces/trace-1?tab=span_tree");
    await screen.findByRole("tree", { name: "Spans" });

    expect(screen.getByRole("tab", { name: "Steps" })).toHaveAttribute("aria-selected", "true");
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

    await userEvent.click(await screen.findByRole("button", { name: "Show in steps" }));

    expect(screen.getByText("at /traces/trace-1?tab=steps&span=turn1")).toBeInTheDocument();
    await userEvent.click(await screen.findByRole("button", { name: "Conversation" }));

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
