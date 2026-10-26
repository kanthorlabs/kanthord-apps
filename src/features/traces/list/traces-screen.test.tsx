import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";

vi.mock("@/api/resources/tracking", () => ({
  listTracePage: vi.fn(),
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
import { listTracePage, readTraceFacets } from "@/api/resources/tracking";
import type { MissionNodeRecord, Project, TraceListItem } from "@/api/types";
import { durationText, utcDateTime } from "@/lib/format";

import { TracesScreen } from "./traces-screen";

const STARTED_AT = Date.UTC(2026, 4, 2, 10, 30);
const SEVEN_DAYS_MS = 7 * 24 * 3_600_000;

function trace(id: string, overrides: Partial<TraceListItem> = {}): TraceListItem {
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
    root_operation: null,
    root_attributes: null,
    cause: null,
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

function matchLargeScreen(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

beforeEach(() => {
  matchLargeScreen(true);
  vi.mocked(listTracePage).mockResolvedValue({ items: [], next_cursor: null });
  vi.mocked(readTraceFacets).mockResolvedValue({
    worker_names: ["general"],
    agent_names: ["coder"],
    models: ["claude-a"],
    error_types: ["Timeout"],
    cause_categories: ["llm_provider", "unattributed"],
  });
  vi.mocked(listProjects).mockResolvedValue([project("prj-1", "kanthord")]);
  vi.mocked(readMissionNode).mockRejectedValue(new ApiError("not_found", "No node.", 404));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("TracesScreen", () => {
  it("shows the title, the state badges and the fields of a row", async () => {
    vi.mocked(listTracePage).mockResolvedValue({
      items: [
        trace("trc-1", { node_id: "node-1" }),
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
    for (const [label, value] of [
      ["Worker", "general"],
      ["Attempt", "1"],
      ["Duration", durationText(90_000)],
      ["API price", "$0.2500"],
      ["Started", utcDateTime(STARTED_AT)],
      ["Turns", "4"],
      ["Errors (incl. recovered)", "0"],
    ] as const) {
      expect(within(row).getByText(label).nextElementSibling).toHaveTextContent(value);
    }
    expect(screen.getByText("exec-trc-2")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("titles a trace with no node and no execution with its root label on the first render", async () => {
    vi.mocked(listTracePage).mockResolvedValue({
      items: [
        trace("trc-env", {
          execution_id: null,
          attempt: null,
          state: "error",
          root_operation: "project.environment",
          root_attributes: { "project.binding.name": "main" },
        }),
        trace("trc-1", { root_operation: "scheduler.execution", root_attributes: {} }),
        trace("trc-2", { execution_id: null, attempt: null }),
      ],
      next_cursor: null,
    });
    mount();

    const list = await screen.findByRole("list", { name: "Traces" });
    expect(within(list).getByText("Environment main")).toBeInTheDocument();
    expect(within(list).queryByText("trc-env")).toBeNull();
    expect(within(list).getByText("exec-trc-1")).toBeInTheDocument();
    expect(within(list).getByText("trc-2")).toBeInTheDocument();
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

  it("opens the trace page with no span for an error trace", async () => {
    const user = userEvent.setup();
    vi.mocked(listTracePage).mockResolvedValue({
      items: [trace("trc-2", { state: "error", first_error_span_id: "spn-9" })],
      next_cursor: null,
    });
    mount();

    await user.click(await screen.findByRole("button", { name: "Open trace exec-trc-2" }));

    expect(await screen.findByText("at /traces/trc-2")).toBeInTheDocument();
  });

  it("shows the cause line of an llm_provider cause and of an unattributed cause", async () => {
    vi.mocked(listTracePage).mockResolvedValue({
      items: [
        trace("trc-1", {
          state: "error",
          cause: { category: "llm_provider", assigner: "rule", subcategory: "rate_limited" },
        }),
        trace("trc-2", {
          state: "error",
          cause: {
            category: "unattributed",
            assigner: "rule",
            suspects: ["prompt", "model"],
          },
        }),
        trace("trc-3"),
      ],
      next_cursor: null,
    });
    mount();

    const list = await screen.findByRole("list", { name: "Traces" });
    expect(await within(list).findByText("LLM provider - rate limited")).toBeInTheDocument();
    expect(within(list).getByText("Unattributed - suspects Prompt, Model")).toBeInTheDocument();
    const quiet = within(list).getByText("exec-trc-3").closest("[role=listitem]") as HTMLElement;
    expect(within(quiet).queryByText(/ - /)).toBeNull();
  });

  it("shows the elapsed time on an open row", async () => {
    vi.mocked(listTracePage).mockResolvedValue({
      items: [
        trace("trc-1", { state: "open", duration_ms: null, started_at: Date.now() - 120_000 }),
      ],
      next_cursor: null,
    });
    mount();

    expect(await screen.findByText("Open - 2 m")).toBeInTheDocument();
  });

  it("sets state=error with the Failed pill and clears it with All", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(await screen.findByRole("button", { name: "Failed" }));
    await waitFor(() =>
      expect(vi.mocked(listTracePage).mock.calls.at(-1)?.[0]).toMatchObject({ state: "error" }),
    );
    await user.click(screen.getByRole("button", { name: "All" }));

    await waitFor(() =>
      expect(vi.mocked(listTracePage).mock.calls.at(-1)?.[0]).not.toHaveProperty("state"),
    );
  });

  it("sets state=open with the Open pill", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(await screen.findByRole("button", { name: "Open" }));

    await waitFor(() =>
      expect(vi.mocked(listTracePage).mock.calls.at(-1)?.[0]).toMatchObject({ state: "open" }),
    );
  });

  it("lists the cause categories of the facets with their labels", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("button", { name: "More filters" }));
    await user.click(await screen.findByRole("combobox", { name: "Cause category" }));

    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "All cause categories",
      "LLM provider",
      "Unattributed",
    ]);
  });

  it("sets the cause category inline", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("button", { name: "More filters" }));
    await user.click(await screen.findByRole("combobox", { name: "Cause category" }));
    await user.click(await screen.findByRole("option", { name: "LLM provider" }));

    await waitFor(() =>
      expect(vi.mocked(listTracePage).mock.calls.at(-1)?.[0]).toMatchObject({
        cause_category: "llm_provider",
      }),
    );
  });

  it("applies the cause category of the filter sheet only on Apply", async () => {
    matchLargeScreen(false);
    const user = userEvent.setup();
    mount();
    await waitFor(() => expect(listTracePage).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole("button", { name: "Filters" }));
    await user.click(await screen.findByRole("combobox", { name: "Cause category" }));
    await user.click(await screen.findByRole("option", { name: "Unattributed" }));
    await user.type(screen.getByLabelText("Min tokens"), "100");

    expect(listTracePage).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(listTracePage).toHaveBeenCalledTimes(2));
    expect(vi.mocked(listTracePage).mock.calls[1]?.[0]).toMatchObject({
      cause_category: "unattributed",
      min_total_tokens: 100,
    });
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
  });

  it("keeps the inline filters out of compact width", async () => {
    matchLargeScreen(false);
    mount();

    expect(await screen.findByRole("button", { name: "Filters" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More filters" })).toBeNull();
    expect(screen.getByRole("button", { name: "Failed" })).toBeInTheDocument();
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
