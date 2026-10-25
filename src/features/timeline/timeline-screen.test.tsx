import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { readMissionNode } from "@/api/resources/mission";
import { listProjects } from "@/api/resources/projects";
import { listTimelinePage, readTraceText } from "@/api/resources/tracking";
import type { MissionNodeRecord, Project, TimelineItem } from "@/api/types";
import { durationText, utcDateTime } from "@/lib/format";

vi.mock("@/api/resources/tracking");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/mission");

import { TimelineScreen } from "./timeline-screen";

const START = Date.UTC(2026, 4, 2, 10, 0);
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const POLL_MS = 5_000;

function span(spanId: string, overrides: Partial<TimelineItem> = {}): TimelineItem {
  return {
    trace_id: "trace_a",
    span_id: spanId,
    parent_span_id: null,
    producer: "scheduler",
    origin: "asserted",
    operation: "scheduler.execution",
    start_time: START,
    end_time: START + 60_000,
    status: "Ok",
    attributes: { "kanthord.execution.kind": "steps" },
    events: [],
    links: [],
    text_ids: [],
    created_at: START,
    depth: 1,
    duration_ms: 60_000,
    project_id: "project_1",
    node_id: "node_1",
    execution_id: "execution_1",
    attempt: 1,
    worker_name: "general",
    ...overrides,
  };
}

function phase(
  spanId: string,
  name: string,
  offset: number,
  overrides: Partial<TimelineItem> = {},
) {
  return span(spanId, {
    depth: 2,
    parent_span_id: "root_a",
    operation: "worker.phase",
    attributes: { "kanthord.phase": name },
    start_time: START + offset,
    end_time: START + offset + 5_000,
    duration_ms: 5_000,
    worker_name: null,
    ...overrides,
  });
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

function mount(entry = "/timeline?node_id=node_1") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/timeline" element={<TimelineScreen />} />
        <Route path="*" element={null} />
      </Routes>
      <Probe />
    </MemoryRouter>,
  );
}

function rowTexts(): readonly string[] {
  const list = screen.getByRole("list", { name: "Timeline" });
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");
}

beforeEach(() => {
  vi.mocked(listTimelinePage).mockResolvedValue({ items: [], next_cursor: null });
  vi.mocked(listProjects).mockResolvedValue([
    project("project_2", "zeta"),
    project("project_1", "alpha"),
  ]);
  vi.mocked(readMissionNode).mockResolvedValue({
    content: { name: "Audit log" },
  } as MissionNodeRecord);
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("TimelineScreen", () => {
  it("lists the roots in the order of the trace start with the depth 2 rows after each root", async () => {
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [
        span("root_b", { trace_id: "trace_b", attempt: 2, start_time: START + 600_000 }),
        phase("phase_b", "review", 1_000, { trace_id: "trace_b", parent_span_id: "root_b" }),
        span("root_a"),
        phase("phase_late", "tasks", 20_000),
        phase("phase_early", "setup", 10_000),
      ],
      next_cursor: null,
    });
    mount();

    await screen.findByText("Phase setup");
    const texts = rowTexts();
    expect(texts).toHaveLength(5);
    expect(texts[0]).toContain("Execution attempt 1");
    expect(texts[1]).toContain("Phase setup");
    expect(texts[2]).toContain("Phase tasks");
    expect(texts[3]).toContain("Execution attempt 2");
    expect(texts[4]).toContain("Phase review");
  });

  it("shows a depth 2 item of a trace with no stored root under a root not stored group", async () => {
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [phase("phase_x", "tasks", 1_000, { trace_id: "trace_x", parent_span_id: "root_x" })],
      next_cursor: null,
    });
    mount();

    await screen.findByText("Phase tasks");
    const texts = rowTexts();
    expect(texts[0]).toContain("root not stored");
    expect(texts[1]).toContain("Phase tasks");
  });

  it("loads the next page with the cursor and joins the items of a cut trace to its group", async () => {
    vi.mocked(listTimelinePage)
      .mockResolvedValueOnce({
        items: [span("root_a"), phase("phase_one", "setup", 1_000)],
        next_cursor: "cursor_1",
      })
      .mockResolvedValueOnce({
        items: [
          phase("phase_two", "tasks", 2_000),
          span("root_b", { trace_id: "trace_b", attempt: 2, start_time: START + 600_000 }),
        ],
        next_cursor: null,
      });
    const user = userEvent.setup();
    mount();

    await user.click(await screen.findByRole("button", { name: "Load more" }));

    await screen.findByText("Phase tasks");
    expect(listTimelinePage).toHaveBeenLastCalledWith({ node_id: "node_1" }, "cursor_1", 200);
    const texts = rowTexts();
    expect(texts).toHaveLength(4);
    expect(texts[0]).toContain("Execution attempt 1");
    expect(texts[1]).toContain("Phase setup");
    expect(texts[2]).toContain("Phase tasks");
    expect(texts[3]).toContain("Execution attempt 2");
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("keeps Load more after a page with no item and a cursor", async () => {
    vi.mocked(listTimelinePage)
      .mockResolvedValueOnce({ items: [], next_cursor: "cursor_1" })
      .mockResolvedValueOnce({ items: [span("root_a")], next_cursor: null });
    const user = userEvent.setup();
    mount();

    await user.click(await screen.findByRole("button", { name: "Load more" }));

    expect(await screen.findByText("Execution attempt 1")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("shows the attempt, the kind, the worker, the state and Open trace of an execution", async () => {
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [span("root_a", { attempt: 2 })],
      next_cursor: null,
    });
    mount();

    const row = (await screen.findByText("Execution attempt 2")).closest(
      "[role=listitem]",
    ) as HTMLElement;
    expect(within(row).getByText("steps")).toBeInTheDocument();
    expect(within(row).getByText("general")).toBeInTheDocument();
    expect(within(row).getByText("OK")).toBeInTheDocument();
    expect(within(row).getByText(utcDateTime(START))).toBeInTheDocument();
    expect(within(row).getByText(durationText(60_000))).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Open trace" })).toHaveAttribute(
      "href",
      "/traces/trace_a",
    );
  });

  it("shows an open execution as Open and a revoked one with its stop reason", async () => {
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [
        span("root_a", { end_time: null, duration_ms: null }),
        span("root_b", {
          trace_id: "trace_b",
          attempt: 2,
          start_time: START + 600_000,
          status: "Error",
          attributes: { "kanthord.execution.end": "revoked" },
        }),
      ],
      next_cursor: null,
    });
    mount();

    const open = (await screen.findByText("Execution attempt 1")).closest(
      "[role=listitem]",
    ) as HTMLElement;
    expect(within(open).getByText("Open")).toBeInTheDocument();
    expect(within(open).getByText("running")).toBeInTheDocument();
    const revoked = screen.getByText("Execution attempt 2").closest("[role=listitem]");
    expect(within(revoked as HTMLElement).getByText("Error")).toBeInTheDocument();
    expect(within(revoked as HTMLElement).getByText("revoked")).toBeInTheDocument();
  });

  it.each([
    ["human", "Revoked by a human"],
    ["assessment", "Revoked by a review"],
  ])("shows the revocation by the cause %s on a revoked execution", async (cause, label) => {
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [
        span("root_a", {
          status: "Error",
          attributes: { "kanthord.execution.end": "revoked", "kanthord.revoke.cause": cause },
        }),
      ],
      next_cursor: null,
    });
    mount();

    const row = (await screen.findByText("Execution attempt 1")).closest(
      "[role=listitem]",
    ) as HTMLElement;
    expect(within(row).getByText(label)).toBeInTheDocument();
    expect(within(row).queryByText("revoked")).not.toBeInTheDocument();
  });

  it("shows the node name of an execution in the project scope", async () => {
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [span("root_a")],
      next_cursor: null,
    });
    mount("/timeline?project_id=project_1");

    const row = (await screen.findByText("Execution attempt 1")).closest(
      "[role=listitem]",
    ) as HTMLElement;
    expect(await within(row).findByText("Audit log")).toBeInTheDocument();
  });

  it("shows the label and the detail of a transition at the failure limit", async () => {
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [
        span("root_a"),
        phase("transition_a", "", 59_000, {
          operation: "scheduler.transition",
          attributes: {
            "kanthord.node.state.from": "Executing",
            "kanthord.node.state.to": "Paused",
            "kanthord.transition.rule": "failure_limit",
            "kanthord.transition.count": 3,
            "kanthord.transition.limit": 3,
          },
        }),
      ],
      next_cursor: null,
    });
    mount();

    expect(await screen.findByText("Transition Executing -> Paused")).toBeInTheDocument();
    expect(screen.getByText("Paused at the failure limit: 3 of 3")).toBeInTheDocument();
  });

  it("shows an act by a human and reads its reason on demand", async () => {
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [
        span("act_a", {
          trace_id: "trace_act",
          operation: "mission.node.pause",
          attributes: {},
          text_ids: ["act_a:reason"],
          execution_id: null,
          attempt: null,
          worker_name: null,
          links: [{ trace_id: "trace_exec", span_id: "root_exec" }],
        }),
      ],
      next_cursor: null,
    });
    vi.mocked(readTraceText).mockResolvedValue({
      trace_id: "trace_act",
      text_id: "act_a:reason",
      content: "Hold the audit log until the API freeze is over.",
      created_at: START,
    });
    const user = userEvent.setup();
    mount();

    const row = (await screen.findByText("Paused")).closest("[role=listitem]") as HTMLElement;
    expect(within(row).getByText("by a human")).toBeInTheDocument();
    expect(within(row).getByText(utcDateTime(START))).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Open trace" })).toHaveAttribute(
      "href",
      "/traces/trace_exec",
    );
    expect(readTraceText).not.toHaveBeenCalled();

    await user.click(within(row).getByRole("button", { name: "Show reason" }));

    expect(
      await within(row).findByText("Hold the audit log until the API freeze is over."),
    ).toBeInTheDocument();
    expect(readTraceText).toHaveBeenCalledWith("trace_act", "act_a:reason");
  });

  it("offers no reason and no trace link for an act without them", async () => {
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [span("act_a", { operation: "mission.node.resume", attributes: {} })],
      next_cursor: null,
    });
    mount();

    const row = (await screen.findByText("Resumed")).closest("[role=listitem]") as HTMLElement;
    expect(within(row).queryByRole("button", { name: "Show reason" })).toBeNull();
    expect(within(row).queryByRole("button", { name: "Open trace" })).toBeNull();
  });

  it("shows the label and the duration of another depth 2 span", async () => {
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [span("root_a"), phase("phase_a", "tasks", 1_000)],
      next_cursor: null,
    });
    mount();

    const row = (await screen.findByText("Phase tasks")).closest("[role=listitem]") as HTMLElement;
    expect(within(row).getByText(durationText(5_000))).toBeInTheDocument();
  });

  it("shows No end recorded and no duration for a span with no end under an ended root", async () => {
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [
        span("root_a", { status: "Error" }),
        phase("phase_a", "tasks", 1_000, { end_time: null, duration_ms: null }),
      ],
      next_cursor: null,
    });
    mount();

    const row = (await screen.findByText("Phase tasks")).closest("[role=listitem]") as HTMLElement;
    expect(within(row).getByText("No end recorded")).toBeInTheDocument();
    expect(screen.queryByText("running")).toBeNull();
  });

  it("shows running for a span with no end under an open root", async () => {
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [
        span("root_a", { end_time: null, duration_ms: null }),
        phase("phase_a", "tasks", 1_000, { end_time: null, duration_ms: null }),
      ],
      next_cursor: null,
    });
    mount();

    const row = (await screen.findByText("Phase tasks")).closest("[role=listitem]") as HTMLElement;
    expect(within(row).getByText("running")).toBeInTheDocument();
    expect(screen.queryByText("No end recorded")).toBeNull();
  });

  it("shows the labels of an environment run and an Error badge on a failed span", async () => {
    const environment = {
      trace_id: "trace_env",
      producer: "project",
      node_id: null,
      execution_id: null,
      attempt: null,
      worker_name: null,
    };
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [
        span("env_root", {
          ...environment,
          operation: "project.environment",
          status: "Error",
          attributes: { "project.binding.name": "main" },
        }),
        span("env_build", {
          ...environment,
          depth: 2,
          parent_span_id: "env_root",
          operation: "environment.build",
          attributes: {},
        }),
        span("env_setup", {
          ...environment,
          depth: 2,
          parent_span_id: "env_root",
          operation: "environment.setup",
          attributes: {},
          start_time: START + 1_000,
        }),
        span("env_proof", {
          ...environment,
          depth: 2,
          parent_span_id: "env_root",
          operation: "environment.proof",
          status: "Error",
          attributes: {},
          start_time: START + 2_000,
        }),
      ],
      next_cursor: null,
    });
    mount("/timeline?project_id=project_1");

    await screen.findByText("Environment main");
    const texts = rowTexts();
    expect(texts).toHaveLength(4);
    expect(texts[0]).toContain("Environment main");
    expect(texts[0]).toContain("Error");
    expect(texts[1]).toContain("Build");
    expect(texts[1]).not.toContain("Error");
    expect(texts[2]).toContain("Setup");
    expect(texts[3]).toContain("Proof");
    expect(texts[3]).toContain("Error");
  });

  it("defaults the node scope to All time and sends no from", async () => {
    mount("/timeline?node_id=node_1");

    await waitFor(() => expect(listTimelinePage).toHaveBeenCalled());
    expect(listTimelinePage).toHaveBeenCalledWith({ node_id: "node_1" }, null, 200);
    expect(await screen.findByRole("combobox", { name: "Time range" })).toHaveTextContent(
      "All time",
    );
  });

  it("defaults the project scope to Last 24 hours", async () => {
    const before = Date.now();
    mount("/timeline?project_id=project_2");

    await waitFor(() => expect(listTimelinePage).toHaveBeenCalled());
    const query = vi.mocked(listTimelinePage).mock.calls[0]?.[0];
    expect(query).toMatchObject({ project_id: "project_2" });
    expect(query?.from).toBeGreaterThanOrEqual(before - DAY_MS);
    expect(query?.from).toBeLessThanOrEqual(Date.now() - DAY_MS);
    expect(await screen.findByRole("combobox", { name: "Time range" })).toHaveTextContent(
      "Last 24 hours",
    );
  });

  it("selects the first project in name order when the query holds no scope", async () => {
    mount("/timeline");

    await waitFor(() => expect(listTimelinePage).toHaveBeenCalled());
    expect(vi.mocked(listTimelinePage).mock.calls[0]?.[0]).toMatchObject({
      project_id: "project_1",
    });
    expect(await screen.findByRole("combobox", { name: "Project" })).toHaveTextContent("alpha");
  });

  it("writes the range to the query string and reads again", async () => {
    const user = userEvent.setup();
    mount("/timeline?project_id=project_1");
    await waitFor(() => expect(listTimelinePage).toHaveBeenCalledTimes(1));

    await user.click(await screen.findByRole("combobox", { name: "Time range" }));
    await user.click(await screen.findByRole("option", { name: "Last 7 days" }));

    expect(await screen.findByText(/range=7d/)).toBeInTheDocument();
    await waitFor(() => expect(listTimelinePage).toHaveBeenCalledTimes(2));
    const query = vi.mocked(listTimelinePage).mock.calls[1]?.[0];
    expect(query?.from).toBeLessThanOrEqual(Date.now() - 7 * DAY_MS);
  });

  it("writes the project to the query string", async () => {
    const user = userEvent.setup();
    mount("/timeline?project_id=project_1");

    await user.click(await screen.findByRole("combobox", { name: "Project" }));
    await user.click(await screen.findByRole("option", { name: "zeta" }));

    expect(await screen.findByText(/project_id=project_2/)).toBeInTheDocument();
  });

  it("shows the node name with a link to the node and Show project in the node scope", async () => {
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [span("root_a")],
      next_cursor: null,
    });
    mount("/timeline?node_id=node_1");

    expect(await screen.findByRole("link", { name: "Audit log" })).toHaveAttribute(
      "href",
      "/projects/project_1?node=node_1",
    );
    expect(await screen.findByRole("button", { name: "Show project" })).toHaveAttribute(
      "href",
      "/timeline?project_id=project_1",
    );
    expect(screen.queryByRole("combobox", { name: "Project" })).toBeNull();
  });

  it("reads the loaded pages again after 5 seconds while a root span is open", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [span("root_a", { end_time: null, duration_ms: null })],
      next_cursor: null,
    });
    mount();
    await screen.findByText("Execution attempt 1");
    expect(listTimelinePage).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS - 1);
    });
    expect(listTimelinePage).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(listTimelinePage).toHaveBeenCalledTimes(2);
  });

  describe("Load more during a poll read", () => {
    const OPEN_PAGE = {
      items: [span("root_a", { end_time: null, duration_ms: null })],
      next_cursor: "cursor_1" as string | null,
    };
    const NEXT_PAGE = {
      items: [span("root_b", { trace_id: "trace_b", attempt: 2, start_time: START + 600_000 })],
      next_cursor: null,
    };

    function cursorCalls(cursor: string): number {
      return vi.mocked(listTimelinePage).mock.calls.filter(([, call]) => call === cursor).length;
    }

    async function pressDuringPoll() {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      const poll: {
        resolve: (page: typeof OPEN_PAGE) => void;
        reject: (cause: unknown) => void;
      } = { resolve: () => undefined, reject: () => undefined };
      vi.mocked(listTimelinePage)
        .mockResolvedValueOnce(OPEN_PAGE)
        .mockImplementationOnce(
          () =>
            new Promise((resolve, reject) => {
              poll.resolve = resolve;
              poll.reject = reject;
            }),
        )
        .mockResolvedValueOnce(NEXT_PAGE);
      const user = userEvent.setup();
      const view = mount();
      const more = await screen.findByRole("button", { name: "Load more" });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(POLL_MS);
      });
      expect(listTimelinePage).toHaveBeenCalledTimes(2);
      await user.click(more);
      return { poll, more, view };
    }

    it("disables Load more while the press waits and loads the next page after the poll read", async () => {
      const { poll, more } = await pressDuringPoll();
      expect(more).toBeDisabled();

      await act(async () => {
        poll.resolve(OPEN_PAGE);
        await Promise.resolve();
      });

      expect(await screen.findByText("Execution attempt 2")).toBeInTheDocument();
      expect(listTimelinePage).toHaveBeenCalledTimes(3);
      expect(cursorCalls("cursor_1")).toBe(1);
      expect(listTimelinePage).toHaveBeenLastCalledWith({ node_id: "node_1" }, "cursor_1", 200);
    });

    it("loads the next page once after a poll read that fails", async () => {
      const { poll } = await pressDuringPoll();

      await act(async () => {
        poll.reject(new ApiError("unavailable", "The daemon is down.", 503));
        await Promise.resolve();
      });

      expect(await screen.findByText("Execution attempt 2")).toBeInTheDocument();
      expect(listTimelinePage).toHaveBeenCalledTimes(3);
      expect(cursorCalls("cursor_1")).toBe(1);
    });

    it("reads nothing more when the poll read answers no next page", async () => {
      const { poll } = await pressDuringPoll();

      await act(async () => {
        poll.resolve({ ...OPEN_PAGE, next_cursor: null });
        await Promise.resolve();
      });

      await waitFor(() => expect(screen.queryByRole("button", { name: "Load more" })).toBeNull());
      expect(listTimelinePage).toHaveBeenCalledTimes(2);
    });

    it("reads nothing more after an unmount", async () => {
      const { poll, view } = await pressDuringPoll();
      view.unmount();

      await act(async () => {
        poll.resolve(OPEN_PAGE);
        await Promise.resolve();
      });

      expect(listTimelinePage).toHaveBeenCalledTimes(2);
    });
  });

  it("reads once when no root span is open", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [span("root_a")],
      next_cursor: null,
    });
    mount();
    await screen.findByText("Execution attempt 1");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * POLL_MS);
    });

    expect(listTimelinePage).toHaveBeenCalledTimes(1);
  });

  it("stops reading and shows No end recorded once the open root span gets an end", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    const openPhase = phase("phase_a", "tasks", 1_000, { end_time: null, duration_ms: null });
    vi.mocked(listTimelinePage)
      .mockResolvedValueOnce({
        items: [span("root_a", { end_time: null, duration_ms: null }), openPhase],
        next_cursor: null,
      })
      .mockResolvedValue({
        items: [span("root_a", { status: "Error" }), openPhase],
        next_cursor: null,
      });
    mount();
    await screen.findByText("Phase tasks");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    const row = screen.getByText("Phase tasks").closest("[role=listitem]") as HTMLElement;
    expect(within(row).getByText("No end recorded")).toBeInTheDocument();
    expect(screen.queryByText("running")).toBeNull();
    expect(listTimelinePage).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * POLL_MS);
    });
    expect(listTimelinePage).toHaveBeenCalledTimes(2);
  });

  it("reads once when every root span has an end and a child span has no end", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    vi.mocked(listTimelinePage).mockResolvedValue({
      items: [
        span("root_a", { status: "Error" }),
        phase("phase_a", "tasks", 1_000, { end_time: null, duration_ms: null }),
      ],
      next_cursor: null,
    });
    mount();
    await screen.findByText("Phase tasks");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * POLL_MS);
    });

    expect(listTimelinePage).toHaveBeenCalledTimes(1);
  });

  it("shows the empty text", async () => {
    mount();

    expect(await screen.findByText("No history in this range.")).toBeInTheDocument();
  });

  it("shows the error and reads again on Retry", async () => {
    vi.mocked(listTimelinePage)
      .mockRejectedValueOnce(new ApiError("unavailable", "The daemon is down.", 503))
      .mockResolvedValueOnce({ items: [span("root_a")], next_cursor: null });
    const user = userEvent.setup();
    mount();

    expect(await screen.findByText("The daemon is down.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("Execution attempt 1")).toBeInTheDocument();
  });
});
