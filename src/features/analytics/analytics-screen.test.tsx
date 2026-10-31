import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { listProjects } from "@/api/resources/projects";
import { readAnalyticsFlow } from "@/api/resources/tracking";
import type { FlowRead, Project } from "@/api/types";

vi.mock("@/api/resources/tracking");
vi.mock("@/api/resources/projects");

import { textContent } from "../../../test/text-content";

import flowRead from "../../../test/flow-read.json";

import { AnalyticsScreen } from "./analytics-screen";

const FLOW_READ = flowRead as unknown as FlowRead;
const COST_HEADING = "Cost and tokens";

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

async function choose(user: ReturnType<typeof userEvent.setup>, select: string, option: string) {
  await user.click(await screen.findByRole("combobox", { name: select }));
  await user.click(await screen.findByRole("option", { name: option }));
}

beforeEach(() => {
  vi.mocked(readAnalyticsFlow).mockResolvedValue(FLOW_READ);
  vi.mocked(listProjects).mockResolvedValue([project("prj_1", "alpha"), project("prj_2", "zeta")]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe("AnalyticsScreen", () => {
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
    expect(screen.queryByRole("heading", { name: COST_HEADING })).toBeNull();
    await user.click(screen.getByRole("tab", { name: "Cost" }));

    expect(screen.getByRole("tab", { name: "Cost" })).toHaveAttribute("aria-selected", "true");
    expect(await panel().findByRole("heading", { name: COST_HEADING })).toBeInTheDocument();
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

  it("shows the context line, the toolbar and the scorecard on the Cost tab, with no Group by select", async () => {
    mount();

    expect(await screen.findByText(CONTEXT_LINE)).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Project" })).toBeInTheDocument();
    expect(await panel().findByRole("heading", { name: COST_HEADING })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Group by" })).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Measure" })).toBeNull();
    expect(panel().queryByRole("region", { name: "Time" })).toBeNull();
  });

  it("shows no scorecard on the Flow tab", async () => {
    mountAt("/analytics");

    await screen.findByText(CONTEXT_LINE);
    expect(screen.queryByRole("heading", { name: COST_HEADING })).toBeNull();
  });

  it("reads nothing new on a switch from Flow to Cost", async () => {
    const user = userEvent.setup();
    mountAt("/analytics");
    await screen.findByText(CONTEXT_LINE);

    await user.click(screen.getByRole("tab", { name: "Cost" }));

    expect(await panel().findByRole("heading", { name: COST_HEADING })).toBeInTheDocument();
    expect(readAnalyticsFlow).toHaveBeenCalledTimes(1);
  });

  it("reads only the flow again on Refresh", async () => {
    const user = userEvent.setup();
    mount();
    await panel().findByRole("heading", { name: COST_HEADING });

    await user.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => expect(readAnalyticsFlow).toHaveBeenCalledTimes(2));
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
    await panel().findByRole("heading", { name: COST_HEADING });

    expect(screen.getByText(CONTEXT_LINE)).toBe(context);
    expect(screen.getByRole("combobox", { name: "Project" })).toBe(project);
    expect(readAnalyticsFlow).toHaveBeenCalledTimes(1);
  });

  it("stacks the tab list above the tab panel in a flex-col container", async () => {
    mountAt("/analytics");
    await screen.findByText(CONTEXT_LINE);
    const tabs = screen.getByRole("tablist");
    const container = tabs.parentElement;

    expect(tabs.compareDocumentPosition(screen.getByRole("tabpanel"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(container).toContainElement(screen.getByRole("tabpanel"));
    expect(container).toHaveClass("flex-col");
  });

  it("reads nothing on a click on Cost and then on Flow", async () => {
    const user = userEvent.setup();
    mountAt("/analytics");
    await screen.findByText(CONTEXT_LINE);
    const before = vi.mocked(readAnalyticsFlow).mock.calls.length;

    await user.click(screen.getByRole("tab", { name: "Cost" }));
    await user.click(screen.getByRole("tab", { name: "Flow" }));

    expect(screen.getByRole("tab", { name: "Flow" })).toHaveAttribute("aria-selected", "true");
    expect(vi.mocked(readAnalyticsFlow).mock.calls).toHaveLength(before);
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
