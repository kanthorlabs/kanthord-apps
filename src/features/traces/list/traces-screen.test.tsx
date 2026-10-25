import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

vi.mock("@/api/resources/tracking", () => ({
  listTracePage: vi.fn(),
  listTraceSpans: vi.fn(),
  readTraceFacets: vi.fn(),
}));

vi.mock("@/api/resources/projects", () => ({
  listProjects: vi.fn(),
}));

vi.mock("@/api/resources/mission", () => ({
  readMissionNode: vi.fn(),
}));

import { readMissionNode } from "@/api/resources/mission";
import { listProjects } from "@/api/resources/projects";
import { listTracePage, listTraceSpans, readTraceFacets } from "@/api/resources/tracking";
import type { MissionNodeRecord, Project, TraceSpan, TraceSummary } from "@/api/types";
import { durationText, utcDateTime } from "@/lib/format";

import { TracesScreen } from "./traces-screen";

const STARTED_AT = Date.UTC(2026, 4, 2, 10, 30);
const SEVEN_DAYS_MS = 7 * 24 * 3_600_000;

function trace(id: string, overrides: Partial<TraceSummary> = {}): TraceSummary {
  return {
    trace_id: id,
    project_id: "prj-1",
    execution_id: `exec-${id}`,
    node_id: null,
    attempt: 1,
    root_span_id: `root-${id}`,
    created_at: STARTED_AT,
    state: "ok",
    started_at: STARTED_AT,
    ended_at: STARTED_AT + 90_000,
    duration_ms: 90_000,
    stop_reason: null,
    worker_name: "general",
    agent_names: ["coder", "reviewer"],
    models: ["claude-a", "claude-b"],
    input_tokens: 1000,
    output_tokens: 500,
    cache_read_tokens: 0,
    cache_creation_tokens: 0,
    total_tokens: 1500,
    cost_usd: 0.25,
    span_count: 12,
    turn_count: 4,
    tool_count: 7,
    error_count: 0,
    error_types: [],
    first_error_span_id: null,
    ...overrides,
  };
}

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

function Probe() {
  const location = useLocation();
  return <p>{`at ${location.pathname}${location.search}`}</p>;
}

function mount(entry = "/traces") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/traces" element={<TracesScreen />} />
        <Route path="/traces/:traceId" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.mocked(listTracePage).mockResolvedValue({ items: [], next_cursor: null });
  vi.mocked(readTraceFacets).mockResolvedValue({
    worker_names: ["general"],
    agent_names: ["coder"],
    models: ["claude-a"],
    error_types: ["Timeout"],
  });
  vi.mocked(listProjects).mockResolvedValue([project("prj-1", "kanthord")]);
  vi.mocked(readMissionNode).mockRejectedValue(new ApiError("not_found", "No node.", 404));
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("TracesScreen", () => {
  it("shows the title, the state badges and the fields of a row", async () => {
    vi.mocked(listTracePage).mockResolvedValue({
      items: [
        trace("trc-1", { node_id: "node-1", stop_reason: "max_turns" }),
        trace("trc-2", { state: "error", error_count: 2, first_error_span_id: "spn-9" }),
      ],
      next_cursor: null,
    });
    vi.mocked(readMissionNode).mockResolvedValue({
      content: { name: "Build the page" },
    } as MissionNodeRecord);
    mount();

    const list = await screen.findByRole("list", { name: "Traces" });
    const first = await within(list).findByText("Build the page");
    const row = first.closest("[role=listitem]") as HTMLElement;
    expect(within(row).getByText("OK")).toBeInTheDocument();
    expect(within(row).getByText("max_turns")).toBeInTheDocument();
    for (const [label, value] of [
      ["Worker", "general"],
      ["Agent", "coder, reviewer"],
      ["Model", "claude-a, claude-b"],
      ["Started", utcDateTime(STARTED_AT)],
      ["Duration", durationText(90_000)],
      ["Tokens", "1.5k"],
      ["Est. cost", "$0.2500"],
      ["Turns", "4"],
      ["Tools", "7"],
      ["Errors", "0"],
    ] as const) {
      expect(within(row).getByText(label).nextElementSibling).toHaveTextContent(value);
    }
    expect(screen.getByText("exec-trc-2")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("titles a trace with no node and no execution with the label of its root span", async () => {
    const root: TraceSpan = {
      trace_id: "trc-env",
      span_id: "root-trc-env",
      parent_span_id: null,
      producer: "project",
      origin: "asserted",
      operation: "project.environment",
      start_time: STARTED_AT,
      end_time: STARTED_AT + 90_000,
      status: "Error",
      attributes: { "project.binding.name": "main" },
      events: [],
      links: [],
      text_ids: [],
      created_at: STARTED_AT,
    };
    vi.mocked(listTracePage).mockResolvedValue({
      items: [
        trace("trc-env", { execution_id: null, attempt: null, state: "error" }),
        trace("trc-1"),
      ],
      next_cursor: null,
    });
    vi.mocked(listTraceSpans).mockResolvedValue([
      {
        ...root,
        span_id: "spn-build",
        parent_span_id: "root-trc-env",
        operation: "environment.build",
      },
      root,
    ]);
    mount();

    expect(await screen.findByText("Environment main")).toBeInTheDocument();
    expect(screen.queryByText("trc-env")).toBeNull();
    expect(screen.getByText("exec-trc-1")).toBeInTheDocument();
    expect(listTraceSpans).toHaveBeenCalledTimes(1);
    expect(listTraceSpans).toHaveBeenCalledWith("trc-env");
  });

  it("shows running for an open trace and omits an absent worker", async () => {
    vi.mocked(listTracePage).mockResolvedValue({
      items: [trace("trc-1", { state: "open", duration_ms: null, worker_name: null })],
      next_cursor: null,
    });
    mount();

    const row = (await screen.findByText("exec-trc-1")).closest("[role=listitem]") as HTMLElement;
    expect(within(row).getByText("Open")).toBeInTheDocument();
    expect(within(row).getByText("Duration").nextElementSibling).toHaveTextContent("running");
    expect(within(row).queryByText("Worker")).toBeNull();
  });

  it("reads the filters of the query string with the default range", async () => {
    const before = Date.now();
    mount("/traces?project_id=prj-1&state=error");

    await waitFor(() => expect(listTracePage).toHaveBeenCalled());
    const [query, cursor, limit] = vi.mocked(listTracePage).mock.calls[0] ?? [];
    expect(query).toMatchObject({ project_id: "prj-1", state: "error" });
    expect(query?.from).toBeGreaterThanOrEqual(before - SEVEN_DAYS_MS);
    expect(query?.from).toBeLessThanOrEqual(Date.now() - SEVEN_DAYS_MS);
    expect(query).not.toHaveProperty("started_from");
    expect(cursor).toBeNull();
    expect(limit).toBe(50);
    expect(readTraceFacets).toHaveBeenCalledWith("prj-1");
  });

  it("sends no from for All time and never started_from", async () => {
    mount("/traces?range=all");

    await waitFor(() => expect(listTracePage).toHaveBeenCalled());
    const query = vi.mocked(listTracePage).mock.calls[0]?.[0];
    expect(query).not.toHaveProperty("from");
    expect(query).not.toHaveProperty("started_from");
  });

  it("writes a typed search once, 300 ms after the last keystroke", async () => {
    mount();
    await waitFor(() => expect(listTracePage).toHaveBeenCalledTimes(1));
    vi.useFakeTimers();

    fireEvent.change(screen.getByRole("textbox", { name: "Search traces" }), {
      target: { value: "bu" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(listTracePage).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole("textbox", { name: "Search traces" }), {
      target: { value: "build" },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299);
    });
    expect(listTracePage).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    vi.useRealTimers();

    await waitFor(() => expect(listTracePage).toHaveBeenCalledTimes(2));
    expect(vi.mocked(listTracePage).mock.calls[1]?.[0]).toMatchObject({ q: "build" });
  });

  it("shows the facet options that the server answered under More filters", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("button", { name: "More filters" }));
    await user.click(await screen.findByRole("combobox", { name: "Worker" }));

    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "All workers",
      "general",
    ]);
  });

  it("filters by a facet and keeps it in the query", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("button", { name: "More filters" }));
    await user.click(await screen.findByRole("combobox", { name: "Model" }));
    await user.click(await screen.findByRole("option", { name: "claude-a" }));

    await waitFor(() =>
      expect(vi.mocked(listTracePage).mock.calls.at(-1)?.[0]).toMatchObject({ model: "claude-a" }),
    );
  });

  it("converts the minimum duration from seconds to milliseconds", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("button", { name: "More filters" }));
    await user.type(await screen.findByLabelText("Min duration (s)"), "1.5");

    await waitFor(() =>
      expect(vi.mocked(listTracePage).mock.calls.at(-1)?.[0]).toMatchObject({
        min_duration_ms: 1500,
      }),
    );
    expect(screen.getByLabelText("Min duration (s)")).toHaveValue("1.5");
  });

  it("sorts through the query string", async () => {
    const user = userEvent.setup();
    mount("/traces?sort=cost_usd");

    await user.click(screen.getByRole("button", { name: "More filters" }));

    expect(await screen.findByRole("combobox", { name: "Sort" })).toHaveTextContent(
      "Highest est. cost",
    );
    expect(vi.mocked(listTracePage).mock.calls[0]?.[0]).toMatchObject({ sort: "cost_usd" });
  });

  it("opens the span tree at the first error span of an error trace", async () => {
    const user = userEvent.setup();
    vi.mocked(listTracePage).mockResolvedValue({
      items: [trace("trc-2", { state: "error", first_error_span_id: "spn-9" })],
      next_cursor: null,
    });
    mount();

    await user.click(await screen.findByRole("button", { name: "Open trace exec-trc-2" }));

    expect(
      await screen.findByText("at /traces/trc-2?tab=span_tree&span=spn-9"),
    ).toBeInTheDocument();
  });

  it("opens the trace page of a trace without an error", async () => {
    const user = userEvent.setup();
    vi.mocked(listTracePage).mockResolvedValue({ items: [trace("trc-1")], next_cursor: null });
    mount();

    await user.click(await screen.findByRole("button", { name: "Open trace exec-trc-1" }));

    expect(await screen.findByText("at /traces/trc-1")).toBeInTheDocument();
  });

  it("names the next step when no trace exists", async () => {
    mount();

    expect(
      await screen.findByText("No traces yet. A trace opens when a worker claims a node."),
    ).toBeInTheDocument();
  });

  it("says that no trace matches when a filter is set", async () => {
    mount("/traces?state=open");

    expect(await screen.findByText("No traces match these filters.")).toBeInTheDocument();
  });

  it("offers Retry after an error and reads the page again", async () => {
    const user = userEvent.setup();
    vi.mocked(listTracePage).mockRejectedValueOnce(new ApiError("unavailable", "Down.", 503));
    vi.mocked(listTracePage).mockResolvedValue({ items: [trace("trc-1")], next_cursor: null });
    mount();

    expect(await screen.findByText("Down.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("exec-trc-1")).toBeInTheDocument();
  });
});
