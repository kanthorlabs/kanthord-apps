import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { readMissionNode } from "@/api/resources/mission";
import { listProjects } from "@/api/resources/projects";
import {
  readAnalyticsCost,
  readAnalyticsDuration,
  readAnalyticsFlow,
} from "@/api/resources/tracking";
import type {
  AnalyticsCostItem,
  AnalyticsCostQuery,
  AnalyticsDurationItem,
  AnalyticsDurationQuery,
  AnalyticsPage,
  FlowRead,
  MissionNodeRecord,
  Project,
} from "@/api/types";

vi.mock("@/api/resources/tracking");
vi.mock("@/api/resources/projects");
vi.mock("@/api/resources/mission");

import { PRICE_NOTE } from "@/lib/trace-format";
import { textContent } from "../../../test/text-content";

import flowRead from "../../../test/flow-read.json";

import { AnalyticsScreen } from "./analytics-screen";

const FLOW_READ = flowRead as unknown as FlowRead;
const DAY_START = Date.UTC(2026, 4, 4);
const DAY_MS = 86_400_000;
const POLL_MS = 60_000;
const RANGE_INVALID = "tracking.filter.range_invalid";

function item(overrides: Partial<AnalyticsCostItem> = {}): AnalyticsCostItem {
  return {
    key: "claude-sonnet-4-5",
    bucket_start: DAY_START,
    turn_count: 3,
    input_tokens: 1500,
    output_tokens: 250,
    cache_read_tokens: 700,
    cache_creation_tokens: 350,
    total_tokens: 1750,
    cost_usd: 0.0125,
    ...overrides,
  };
}

const TOTALS = item({
  key: null,
  bucket_start: null,
  turn_count: 9,
  input_tokens: 4_000_000,
  output_tokens: 90_000,
  cache_read_tokens: 2_000,
  cache_creation_tokens: 1_000,
  cost_usd: 12.5,
});

function page(
  items: readonly AnalyticsCostItem[],
  truncated = false,
): AnalyticsPage<AnalyticsCostItem> {
  return { items, truncated };
}

function answer(grouped: AnalyticsPage<AnalyticsCostItem>, totals = page([TOTALS])) {
  vi.mocked(readAnalyticsCost).mockImplementation(async (query: AnalyticsCostQuery) =>
    query.group_by === "none" ? totals : grouped,
  );
}

function duration(overrides: Partial<AnalyticsDurationItem> = {}): AnalyticsDurationItem {
  return {
    key: null,
    bucket_start: DAY_START,
    count: 12,
    p50: 1500,
    p90: 90_000,
    p99: 3_600_000,
    mean: 2000,
    max: 5_400_000,
    ...overrides,
  };
}

function durationPage(
  items: readonly AnalyticsDurationItem[],
  truncated = false,
): AnalyticsPage<AnalyticsDurationItem> {
  return { items, truncated };
}

function answerDuration(result: AnalyticsPage<AnalyticsDurationItem>) {
  vi.mocked(readAnalyticsDuration).mockResolvedValue(result);
}

function durationCalls(): readonly AnalyticsDurationQuery[] {
  return vi.mocked(readAnalyticsDuration).mock.calls.map(([query]) => query);
}

function timeRowTexts(): readonly string[] {
  const list = panel().getByRole("list", { name: "Time" });
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");
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
  return <p>{`at ${location.search}`}</p>;
}

function panel() {
  return within(screen.getByRole("tabpanel"));
}

function mount(params = "") {
  return mountAt(params === "" ? "/analytics?tab=cost" : `/analytics?tab=cost&${params}`);
}

function mountAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/analytics" element={<AnalyticsScreen />} />
      </Routes>
      <Probe />
    </MemoryRouter>,
  );
}

function groupedCalls(): readonly AnalyticsCostQuery[] {
  return vi
    .mocked(readAnalyticsCost)
    .mock.calls.map(([query]) => query)
    .filter((query) => query.group_by !== "none");
}

function totalsCalls(): readonly AnalyticsCostQuery[] {
  return vi
    .mocked(readAnalyticsCost)
    .mock.calls.map(([query]) => query)
    .filter((query) => query.group_by === "none");
}

async function choose(user: ReturnType<typeof userEvent.setup>, select: string, option: string) {
  await user.click(await screen.findByRole("combobox", { name: select }));
  await user.click(await screen.findByRole("option", { name: option }));
}

function rowTexts(): readonly string[] {
  const list = panel().getByRole("list", { name: "Cost" });
  return within(list)
    .getAllByRole("listitem")
    .map((row) => row.textContent ?? "");
}

beforeEach(() => {
  vi.mocked(readAnalyticsFlow).mockResolvedValue(FLOW_READ);
  answer(page([]));
  answerDuration(durationPage([]));
  vi.mocked(listProjects).mockResolvedValue([project("prj_1", "alpha"), project("prj_2", "zeta")]);
  vi.mocked(readMissionNode).mockResolvedValue({
    content: { name: "Audit log" },
  } as MissionNodeRecord);
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("AnalyticsScreen", () => {
  it("reads the cost of the last 7 days by model and day and shows a row for each group and bucket", async () => {
    answer(
      page([
        item(),
        item({ key: "gpt-5", cost_usd: 0.005, turn_count: 1 }),
        item({ key: "gpt-5", bucket_start: DAY_START + DAY_MS, cost_usd: 0.002 }),
      ]),
    );
    mount();

    await panel().findByText("claude-sonnet-4-5");
    const [query] = groupedCalls();
    expect(query).toMatchObject({ group_by: "model", bucket: "day" });
    expect((query?.to ?? 0) - (query?.from ?? 0)).toBe(7 * DAY_MS);
    expect(query).not.toHaveProperty("project_id");
    const texts = rowTexts();
    expect(texts).toHaveLength(3);
    expect(texts[0]).toContain("claude-sonnet-4-5");
    expect(texts[0]).toContain("2026-05-04");
    expect(panel().getAllByText(PRICE_NOTE)).toHaveLength(1);
    expect(texts[0]).toContain("Turns3");
    expect(texts[0]).toContain("Input1.5k");
    expect(texts[0]).toContain("Output250");
    expect(texts[0]).toContain("Cache read700");
    expect(texts[0]).toContain("Cache write350");
    expect(texts[0]).toContain("Cache hit47%");
    expect(texts[0]).toContain("API price$0.0125");
    expect(texts[2]).toContain("2026-05-05");
  });

  it("shows the totals of the range from the read with no group and no bucket", async () => {
    answer(page([item()]));
    mount();

    await panel().findByText("claude-sonnet-4-5");
    const [query] = totalsCalls();
    expect(query).toMatchObject({ group_by: "none", bucket: "none" });
    expect(query?.from).toBe(groupedCalls()[0]?.from);
    const totals = panel().getByRole("list", { name: "Cost totals" });
    expect(totals).toHaveTextContent("Turns9");
    expect(totals).toHaveTextContent("Input4.0M");
    expect(totals).toHaveTextContent("API price$12.50");
  });

  it("shows the totals also when the grouped read is truncated", async () => {
    answer(page([item()], true));
    mount();

    expect(
      await panel().findByText("The range holds more groups. Narrow the range or the filter."),
    ).toBeInTheDocument();
    expect(panel().getByRole("list", { name: "Cost totals" })).toHaveTextContent("API price$12.50");
  });

  it("shows no truncated message for a complete read", async () => {
    answer(page([item()]));
    mount();

    await panel().findByText("claude-sonnet-4-5");
    expect(panel().queryByText(/The range holds more groups/)).toBeNull();
  });

  it("reads again by Agent and writes the query string", async () => {
    answer(page([item()]));
    const user = userEvent.setup();
    mount();
    await panel().findByText("claude-sonnet-4-5");

    await choose(user, "Group by", "Agent");

    await waitFor(() => expect(groupedCalls().at(-1)).toMatchObject({ group_by: "agent_name" }));
    expect(screen.getByText("at ?tab=cost&group_by=agent_name")).toBeInTheDocument();
  });

  it("reads the Week bucket of the query string and reads again on 30d", async () => {
    answer(page([item()]));
    const user = userEvent.setup();
    mount("bucket=week");
    await panel().findByText("claude-sonnet-4-5");
    expect(groupedCalls().at(-1)).toMatchObject({ bucket: "week" });

    await user.click(screen.getByRole("button", { name: "30d" }));

    await waitFor(() => {
      const last = groupedCalls().at(-1);
      expect((last?.to ?? 0) - (last?.from ?? 0)).toBe(30 * DAY_MS);
    });
    expect(groupedCalls().at(-1)).toMatchObject({ bucket: "week" });
    expect(screen.getByText("at ?tab=cost&bucket=week&range=30d")).toBeInTheDocument();
  });

  it("reads a project from the query string and offers All projects first", async () => {
    answer(page([item()]));
    const user = userEvent.setup();
    mount("project_id=prj_2&range=24h&bucket=hour&group_by=provider_name");

    await panel().findByText("claude-sonnet-4-5");
    expect(groupedCalls()[0]).toMatchObject({
      project_id: "prj_2",
      bucket: "hour",
      group_by: "provider_name",
    });
    expect(totalsCalls()[0]).toMatchObject({ project_id: "prj_2" });
    await user.click(screen.getByRole("combobox", { name: "Project" }));
    expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
      "All projects",
      "alpha",
      "zeta",
    ]);
  });

  it("selects a project and clears it with All projects", async () => {
    answer(page([item()]));
    const user = userEvent.setup();
    mount();
    await panel().findByText("claude-sonnet-4-5");

    await choose(user, "Project", "alpha");
    await waitFor(() => expect(groupedCalls().at(-1)).toMatchObject({ project_id: "prj_1" }));
    expect(screen.getByText("at ?tab=cost&project_id=prj_1")).toBeInTheDocument();
    await choose(user, "Project", "All projects");

    await waitFor(() => expect(groupedCalls().at(-1)).not.toHaveProperty("project_id"));
    expect(screen.getByText("at ?tab=cost")).toBeInTheDocument();
  });

  it("shows the node name in a node group row and Unknown for a null key", async () => {
    answer(page([item({ key: "node_1" }), item({ key: null })]));
    mount("group_by=node_id");

    expect(await panel().findByText("Audit log")).toBeInTheDocument();
    expect(vi.mocked(readMissionNode).mock.calls[0]?.[0]).toBe("node_1");
    expect(panel().getByText("Unknown")).toBeInTheDocument();
  });

  it("links a cost row grouped by model to the filtered trace list", async () => {
    answer(page([item({ key: "gpt-5" })]));
    mount();

    const list = await panel().findByRole("list", { name: "Cost" });
    expect(await within(list).findByRole("button", { name: "Traces" })).toHaveAttribute(
      "href",
      "/traces?model=gpt-5",
    );
  });

  it("shows the project name in a project group row", async () => {
    answer(page([item({ key: "prj_2" })]));
    mount("group_by=project_id");

    expect(await panel().findByText("zeta")).toBeInTheDocument();
  });

  it("gives each bar an accessible name that repeats the cost of its row", async () => {
    answer(page([item(), item({ key: "gpt-5", cost_usd: 0.005 })]));
    mount();

    await panel().findByText("gpt-5");

    const bars = panel().getAllByRole("progressbar");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveAccessibleName(expect.stringContaining("$0.0125"));
    expect(bars[0]).toHaveAccessibleName(expect.stringContaining("claude-sonnet-4-5"));
    expect(bars[1]).toHaveAccessibleName(expect.stringContaining("$0.0050"));
    expect(bars[0]).toHaveAttribute("aria-valuenow", "0.0125");
    expect(bars[1]).toHaveAttribute("aria-valuemax", "0.0125");
  });

  it("shows the empty text when no span is in the range", async () => {
    answer(page([]), page([]));
    mount();

    const region = await panel().findByRole("region", { name: "Cost" });
    expect(await within(region).findByText("No spans in this range.")).toBeInTheDocument();
    expect(panel().queryByRole("list", { name: "Cost totals" })).toBeNull();
  });

  it("shows the error with Retry and reads again on Retry", async () => {
    vi.mocked(readAnalyticsCost).mockRejectedValueOnce(
      new ApiError("malformed", "The range is more than 31 days.", 400),
    );
    answer(page([item()]));
    const user = userEvent.setup();
    mount();

    expect(await panel().findByText("The range is more than 31 days.")).toBeInTheDocument();
    await user.click(panel().getByRole("button", { name: "Retry" }));

    expect(await panel().findByText("claude-sonnet-4-5")).toBeInTheDocument();
    expect(panel().queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("shows a range error with no Retry", async () => {
    vi.mocked(readAnalyticsCost).mockRejectedValue(
      new ApiError("malformed", "The range is longer than 31 days.", 400, RANGE_INVALID),
    );
    mount();

    const cost = await panel().findByRole("region", { name: "Cost" });
    expect(await within(cost).findByText("The range is longer than 31 days.")).toBeInTheDocument();
    expect(within(cost).queryByRole("button", { name: "Retry" })).toBeNull();
  });

  it("reads again on Refresh", async () => {
    answer(page([item()]));
    const user = userEvent.setup();
    mount();
    await panel().findByText("claude-sonnet-4-5");
    const before = groupedCalls().length;

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(groupedCalls()).toHaveLength(before + 1));
    expect(totalsCalls()).toHaveLength(before + 1);
    await waitFor(() => expect(readAnalyticsFlow).toHaveBeenCalledTimes(2));
  });

  it("reads nothing on a timer", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    answer(page([item()]));
    mount();
    await panel().findByText("claude-sonnet-4-5");
    const reads = vi.mocked(readAnalyticsCost).mock.calls.length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 10);
    });

    expect(readAnalyticsCost).toHaveBeenCalledTimes(reads);
  });

  describe("Time section", () => {
    it("reads span_duration with no group at the page load and shows the count and the percentiles", async () => {
      answerDuration(durationPage([duration()]));
      mount();

      await panel().findByText("All");
      const [query] = durationCalls();
      expect(query).toMatchObject({ measure: "span_duration", group_by: "none", bucket: "day" });
      expect((query?.to ?? 0) - (query?.from ?? 0)).toBe(7 * DAY_MS);
      expect(query).not.toHaveProperty("project_id");
      const [row] = timeRowTexts();
      expect(row).toContain("2026-05-04");
      expect(row).toContain("Count12");
      expect(row).toContain("p501 s");
      expect(row).toContain("p901 min");
      expect(row).toContain("p991 h");
      expect(row).toContain("Max1 h 30 min");
      expect(screen.getByRole("combobox", { name: "Measure" })).toHaveTextContent("Span duration");
      expect(screen.getByRole("combobox", { name: "Time group by" })).toHaveTextContent("None");
    });

    it("offers the measures and the groups of the section", async () => {
      const user = userEvent.setup();
      mount();

      await user.click(await screen.findByRole("combobox", { name: "Measure" }));
      expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
        "Span duration",
        "Tool latency",
        "Verification time",
        "Queue wait",
        "Review wait",
        "Revision turns",
        "Test floor share",
      ]);
      await user.keyboard("{Escape}");
      await user.click(screen.getByRole("combobox", { name: "Time group by" }));
      expect((await screen.findAllByRole("option")).map((option) => option.textContent)).toEqual([
        "None",
        "Operation",
        "Tool",
        "Agent",
        "Model",
        "Worker",
        "Node",
        "Project",
      ]);
    });

    it("reads Tool latency by Tool and writes the query string", async () => {
      answerDuration(durationPage([duration({ key: "read_file" })]));
      const user = userEvent.setup();
      mount();
      await panel().findByText("All");

      await choose(user, "Measure", "Tool latency");
      await choose(user, "Time group by", "Tool");

      await waitFor(() =>
        expect(durationCalls().at(-1)).toMatchObject({
          measure: "tool_latency",
          group_by: "tool_name",
        }),
      );
      expect(
        screen.getByText("at ?tab=cost&time_measure=tool_latency&time_group_by=tool_name"),
      ).toBeInTheDocument();
      expect(await panel().findByText("read_file")).toBeInTheDocument();
    });

    it("reads the measure and the group from the query string", async () => {
      mount("time_measure=queue_wait&time_group_by=worker_name");

      await waitFor(() => expect(durationCalls()).toHaveLength(1));
      expect(durationCalls()[0]).toMatchObject({
        measure: "queue_wait",
        group_by: "worker_name",
      });
    });

    it("shows Revision turns as counts with no unit of time", async () => {
      answerDuration(durationPage([duration({ p50: 1, p90: 2, p99: 4, max: 7 })]));
      mount("time_measure=revision_turns");

      await panel().findByText("All");
      const [row] = timeRowTexts();
      expect(row).toContain("p501");
      expect(row).toContain("p902");
      expect(row).toContain("p994");
      expect(row).toContain("Max7");
      expect(row).not.toMatch(/\d (s|min|h)\b/);
    });

    it("shows Test floor share as a percent with one bar from 0 to 1", async () => {
      vi.mocked(readAnalyticsDuration).mockResolvedValue({
        items: [{ key: null, bucket_start: null, count: 3, share: 0.25 }],
        truncated: false,
      });
      mount("time_measure=test_floor_share");

      await panel().findByText("All");
      const [row] = timeRowTexts();
      expect(row).toContain("Count3");
      expect(row).toContain("25%");
      expect(row).not.toContain("p50");
      const list = panel().getByRole("list", { name: "Time" });
      const bar = within(list).getByRole("progressbar");
      expect(bar).toHaveAttribute("aria-valuenow", "0.25");
      expect(bar).toHaveAttribute("aria-valuemax", "1");
    });

    it("gives each bar an accessible name that repeats p50, p90, p99 and max of its row", async () => {
      answerDuration(
        durationPage([
          duration({ key: "read_file" }),
          duration({ key: "edit_file", p50: 500, p90: 2000, p99: 3000, max: 4000 }),
        ]),
      );
      mount("time_group_by=tool_name");

      await panel().findByText("edit_file");

      const bars = panel().getAllByRole("progressbar");
      expect(bars).toHaveLength(2);
      expect(bars[0]).toHaveAccessibleName(
        "Time of read_file 2026-05-04: p50 1 s, p90 1 min, p99 1 h, max 1 h 30 min",
      );
      expect(bars[1]).toHaveAccessibleName(
        "Time of edit_file 2026-05-04: p50 500 ms, p90 2 s, p99 3 s, max 4 s",
      );
      expect(bars[0]).toHaveAttribute("aria-valuenow", "5400000");
      expect(bars[1]).toHaveAttribute("aria-valuemax", "5400000");
    });

    it("shows the node name, the project name and Unknown for a null key", async () => {
      answerDuration(durationPage([duration({ key: "node_1" }), duration({ key: null })]));
      mount("time_group_by=node_id");

      expect(await panel().findByText("Audit log")).toBeInTheDocument();
      expect(panel().getByText("Unknown")).toBeInTheDocument();
    });

    it("links a time row grouped by node to the filtered trace list", async () => {
      answerDuration(durationPage([duration({ key: "node_1" }), duration({ key: null })]));
      mount("time_group_by=node_id");

      const list = await panel().findByRole("list", { name: "Time" });
      expect(await within(list).findByRole("button", { name: "Traces" })).toHaveAttribute(
        "href",
        "/traces?node_id=node_1",
      );
      expect(within(list).getAllByRole("button", { name: "Traces" })).toHaveLength(1);
    });

    it("shows the project name in a project group row", async () => {
      answerDuration(durationPage([duration({ key: "prj_2" })]));
      mount("time_group_by=project_id");

      expect(await panel().findByText("zeta")).toBeInTheDocument();
    });

    it("reads both sections again on a change of the toolbar and on Refresh", async () => {
      const user = userEvent.setup();
      mount();
      await waitFor(() => expect(durationCalls()).toHaveLength(1));

      await choose(user, "Project", "alpha");
      await waitFor(() => expect(durationCalls().at(-1)).toMatchObject({ project_id: "prj_1" }));
      expect(groupedCalls().at(-1)).toMatchObject({ project_id: "prj_1" });
      await user.click(screen.getByRole("button", { name: "24h" }));
      await waitFor(() => {
        const last = durationCalls().at(-1);
        expect((last?.to ?? 0) - (last?.from ?? 0)).toBe(DAY_MS);
      });
      const before = durationCalls().length;
      await user.click(screen.getByRole("button", { name: "Refresh" }));

      await waitFor(() => expect(durationCalls()).toHaveLength(before + 1));
    });

    it("shows the truncated message", async () => {
      answerDuration(durationPage([duration()], true));
      mount();

      expect(
        await panel().findByText("The range holds more groups. Narrow the range or the filter."),
      ).toBeInTheDocument();
    });

    it("shows the empty text", async () => {
      mount();

      const region = await panel().findByRole("region", { name: "Time" });
      expect(await within(region).findByText("No spans in this range.")).toBeInTheDocument();
    });

    it("shows the error with Retry and reads again on Retry", async () => {
      vi.mocked(readAnalyticsDuration).mockRejectedValueOnce(
        new ApiError("malformed", "The measure is closed.", 400),
      );
      answerDuration(durationPage([duration()]));
      const user = userEvent.setup();
      mount();

      expect(await panel().findByText("The measure is closed.")).toBeInTheDocument();
      await user.click(panel().getByRole("button", { name: "Retry" }));

      expect(await panel().findByText("All")).toBeInTheDocument();
      expect(panel().queryByRole("button", { name: "Retry" })).toBeNull();
    });

    it("shows a range error with no Retry", async () => {
      vi.mocked(readAnalyticsDuration).mockRejectedValue(
        new ApiError("malformed", "The range is longer than 31 days.", 400, RANGE_INVALID),
      );
      mount();

      const time = await panel().findByRole("region", { name: "Time" });
      expect(
        await within(time).findByText("The range is longer than 31 days."),
      ).toBeInTheDocument();
      expect(within(time).queryByRole("button", { name: "Retry" })).toBeNull();
    });
  });

  describe("Flow and Cost tabs", () => {
    const NOW = Date.UTC(2026, 9, 30, 14, 12);
    const CONTEXT_LINE =
      "All projects · all workers · Oct 24 00:00 – Oct 30 14:12 UTC (today partial) · vs Oct 17 – Oct 23 to the same hour · counted by claim time";

    function flowQueries() {
      return vi.mocked(readAnalyticsFlow).mock.calls.map(([query]) => query);
    }

    it("opens on the Flow tab and writes tab=cost on a click on Cost", async () => {
      const user = userEvent.setup();
      mountAt("/analytics");

      expect(screen.getByRole("tab", { name: "Flow" })).toHaveAttribute("aria-selected", "true");
      expect(screen.queryByRole("region", { name: "Cost" })).toBeNull();
      await user.click(screen.getByRole("tab", { name: "Cost" }));

      expect(screen.getByRole("tab", { name: "Cost" })).toHaveAttribute("aria-selected", "true");
      expect(await panel().findByRole("region", { name: "Cost" })).toBeInTheDocument();
      expect(screen.getByText("at ?tab=cost")).toBeInTheDocument();
    });

    it("falls back to the Flow tab for an unknown tab", () => {
      mountAt("/analytics?tab=time");

      expect(screen.getByRole("tab", { name: "Flow" })).toHaveAttribute("aria-selected", "true");
    });

    it("shows one Project combobox and no Bucket combobox on the Cost tab", () => {
      mount();

      expect(screen.getAllByRole("combobox", { name: "Project" })).toHaveLength(1);
      expect(screen.queryByRole("combobox", { name: "Bucket" })).toBeNull();
      expect(screen.queryByRole("combobox", { name: "Time range" })).toBeNull();
    });

    it("shows the context line and the toolbar above the tab list on both tabs, with one read", async () => {
      const user = userEvent.setup();
      mountAt("/analytics");
      const context = await screen.findByText(CONTEXT_LINE);
      const project = screen.getByRole("combobox", { name: "Project" });
      const tabs = screen.getByRole("tablist");
      const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

      expect(context.compareDocumentPosition(tabs) & FOLLOWING).toBeTruthy();
      expect(project.compareDocumentPosition(tabs) & FOLLOWING).toBeTruthy();
      await user.click(screen.getByRole("tab", { name: "Cost" }));
      await panel().findByRole("region", { name: "Cost" });

      expect(screen.getByText(CONTEXT_LINE)).toBe(context);
      expect(screen.getByRole("combobox", { name: "Project" })).toBe(project);
      expect(readAnalyticsFlow).toHaveBeenCalledTimes(1);
    });

    it("reads the flow of 7d by day with the previous window", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      mountAt("/analytics");

      await screen.findByText(CONTEXT_LINE);
      expect(flowQueries()).toEqual([
        { from: Date.UTC(2026, 9, 24), to: NOW, bucket: "day", compare: "previous" },
      ]);
    });

    it("reads the flow of 24h by hour with the previous window", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      mountAt("/analytics?range=24h");

      await screen.findByText(CONTEXT_LINE);
      expect(flowQueries()).toEqual([
        { from: Date.UTC(2026, 9, 29, 15), to: NOW, bucket: "hour", compare: "previous" },
      ]);
    });

    it("reads the project, the worker and the range of the query string", async () => {
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(NOW);
      mountAt("/analytics?project_id=prj_2&worker_name=coder@1&range=30d");

      await waitFor(() => expect(readAnalyticsFlow).toHaveBeenCalledTimes(1));
      expect(flowQueries()).toEqual([
        {
          from: Date.UTC(2026, 9, 1),
          to: NOW,
          bucket: "day",
          project_id: "prj_2",
          worker_name: "coder@1",
          compare: "previous",
        },
      ]);
    });

    it("writes the project to the URL and reads again", async () => {
      const user = userEvent.setup();
      mountAt("/analytics");
      await screen.findByText(CONTEXT_LINE);

      await choose(user, "Project", "alpha");

      await waitFor(() => expect(flowQueries().at(-1)).toMatchObject({ project_id: "prj_1" }));
      expect(screen.getByText("at ?project_id=prj_1")).toBeInTheDocument();
    });

    it("writes the worker to the URL and reads again", async () => {
      const user = userEvent.setup();
      mountAt("/analytics");
      await screen.findByText(CONTEXT_LINE);

      await choose(user, "Worker", "coder@1");

      await waitFor(() => expect(flowQueries().at(-1)).toMatchObject({ worker_name: "coder@1" }));
      expect(screen.getByText("at ?worker_name=coder%401")).toBeInTheDocument();
    });

    it("writes the range to the URL and reads again", async () => {
      const user = userEvent.setup();
      mountAt("/analytics");
      await screen.findByText(CONTEXT_LINE);

      await user.click(screen.getByRole("button", { name: "24h" }));

      await waitFor(() => expect(flowQueries().at(-1)).toMatchObject({ bucket: "hour" }));
      expect(screen.getByText("at ?range=24h")).toBeInTheDocument();
    });

    it("shows the context line and the live state links", async () => {
      mountAt("/analytics");

      expect(await screen.findByText(CONTEXT_LINE)).toBeInTheDocument();
      expect(screen.getByText(textContent("Live state: Overview · Scheduler"))).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("href", "/");
      expect(screen.getByRole("link", { name: "Scheduler" })).toHaveAttribute("href", "/scheduler");
    });

    it("prints the project name in the context line", async () => {
      mountAt("/analytics?project_id=prj_2");

      expect(await screen.findByText(/^zeta · all workers · Oct 24 00:00/)).toBeInTheDocument();
    });

    it("shows the rebuild banner for a read with a rebuild", async () => {
      vi.mocked(readAnalyticsFlow).mockResolvedValue({
        ...FLOW_READ,
        rebuild: { pending_until: Date.UTC(2026, 9, 26) },
      });
      mountAt("/analytics");

      expect(
        await screen.findByText(
          "Aggregates rebuild in progress. Numbers before Oct 26 are incomplete.",
        ),
      ).toBeInTheDocument();
    });

    it("shows no rebuild banner for a read with no rebuild", async () => {
      mountAt("/analytics");

      await screen.findByText(CONTEXT_LINE);
      expect(screen.queryByText(/Aggregates rebuild in progress/)).toBeNull();
    });
  });
});
